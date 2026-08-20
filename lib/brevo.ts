import https from "node:https";
import { missingEnv } from "@/lib/api";

const BREVO_KEYS = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL"] as const;

export type BrevoCampaign = {
  id: number;
  name: string;
  subject?: string;
  status?: string;
  scheduledAt?: string;
  sentDate?: string;
  statistics?: {
    globalStats?: {
      delivered?: number;
      uniqueOpens?: number;
      uniqueClicks?: number;
      unsubscriptions?: number;
    };
  };
  recipients?: { lists?: number[] };
  previewText?: string;
  htmlContent?: string;
};

export function missingBrevoEnv(): string[] {
  return missingEnv(BREVO_KEYS);
}

function brevo<T>(
  path: string,
  init?: { method?: string; body?: string },
): Promise<T> {
  const method = init?.method ?? "GET";
  const body = init?.body;
  const headers: Record<string, string> = {
    accept: "application/json",
    "api-key": process.env.BREVO_API_KEY!.trim(),
  };
  if (body) headers["content-type"] = "application/json";

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.brevo.com",
        path: `/v3${path}`,
        method,
        headers,
        family: 4,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          if (status >= 400) {
            reject(new Error(`Brevo ${status}: ${text.slice(0, 400)}`));
            return;
          }
          if (status === 204 || !text.trim()) {
            resolve(undefined as T);
            return;
          }
          try {
            resolve(JSON.parse(text) as T);
          } catch {
            reject(new Error(`Brevo: invalid JSON (${text.slice(0, 120)})`));
          }
        });
      },
    );
    req.on("error", (err) => {
      const cause =
        err instanceof Error && "cause" in err
          ? String((err as Error & { cause?: unknown }).cause ?? "")
          : "";
      reject(
        new Error(
          cause
            ? `${err.message} (${cause})`
            : err instanceof Error
              ? err.message
              : "Brevo request failed",
        ),
      );
    });
    if (body) req.write(body);
    req.end();
  });
}

export function sender() {
  return {
    email: process.env.BREVO_SENDER_EMAIL!.trim(),
    name: process.env.BREVO_SENDER_NAME?.trim() || "Inkamoto Tours",
  };
}

export function subscriberListId(): number | null {
  const raw = process.env.BREVO_LIST_ID?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export type BrevoContact = {
  id: number;
  email: string;
  emailBlacklisted?: boolean;
  createdAt?: string;
  modifiedAt?: string;
  attributes?: Record<string, unknown>;
};

export type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  blocked: boolean;
  addedAt: string | null;
};

function attrString(
  attributes: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = attributes?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function mapBrevoContact(c: BrevoContact): Subscriber {
  const first = attrString(c.attributes, "FIRSTNAME");
  const last = attrString(c.attributes, "LASTNAME");
  const name = [first, last].filter(Boolean).join(" ").trim();
  return {
    id: String(c.id),
    email: c.email,
    name: name || null,
    source: attrString(c.attributes, "SOURCE"),
    blocked: Boolean(c.emailBlacklisted),
    addedAt: c.createdAt ?? null,
  };
}

export async function listBrevoContacts(limit = 200) {
  const listId = subscriberListId();
  if (listId === null) {
    throw new Error(
      "Set BREVO_LIST_ID to see subscribers (Brevo → Contacts → Lists → list id).",
    );
  }
  const data = await brevo<{ contacts?: BrevoContact[]; count?: number }>(
    `/contacts/lists/${listId}/contacts?limit=${limit}&offset=0&sort=desc`,
  );
  return {
    contacts: data?.contacts ?? [],
    total: data?.count ?? (data?.contacts?.length ?? 0),
  };
}

/**
 * Add (or update) a contact on the subscriber list.
 * Existing contacts are kept — `updateEnabled` only tops up list membership.
 */
export async function addContactToList(input: {
  email: string;
  name?: string | null;
  source?: string;
}) {
  const listId = subscriberListId();
  if (listId === null) {
    throw new Error("Set BREVO_LIST_ID before adding subscribers.");
  }

  const [first, ...rest] = (input.name ?? "").trim().split(/\s+/);
  const attributes: Record<string, string> = {};
  if (first) attributes.FIRSTNAME = first;
  if (rest.length) attributes.LASTNAME = rest.join(" ");
  if (input.source) attributes.SOURCE = input.source;

  const email = input.email.trim().toLowerCase();
  const base = { email, listIds: [listId], updateEnabled: true };

  try {
    await brevo("/contacts", {
      method: "POST",
      body: JSON.stringify(
        Object.keys(attributes).length ? { ...base, attributes } : base,
      ),
    });
  } catch (err) {
    // Brevo rejects attributes that don't exist on the account — still subscribe
    if (!Object.keys(attributes).length) throw err;
    await brevo("/contacts", {
      method: "POST",
      body: JSON.stringify(base),
    });
  }
}

export async function listBrevoCampaigns(limit = 50) {
  const data = await brevo<{ campaigns?: BrevoCampaign[] }>(
    `/emailCampaigns?limit=${limit}&sort=desc&excludeHtmlContent=true`,
  );
  return data?.campaigns ?? [];
}

async function subscriberFolderId() {
  const id = subscriberListId();
  if (id == null) return 1;
  try {
    const list = await brevo<{ folderId?: number }>(`/contacts/lists/${id}`);
    return list?.folderId || 1;
  } catch {
    return 1;
  }
}

export async function createBrevoList(name: string) {
  const created = await brevo<{ id: number }>("/contacts/lists", {
    method: "POST",
    body: JSON.stringify({
      name: name.slice(0, 50),
      folderId: await subscriberFolderId(),
    }),
  });
  if (!created?.id) throw new Error("Could not create a recipient list.");
  return created.id;
}

export async function addEmailsToList(listId: number, emails: string[]) {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 150) {
    const slice = unique.slice(i, i + 150);
    await brevo(`/contacts/lists/${listId}/contacts/add`, {
      method: "POST",
      body: JSON.stringify({ emails: slice }),
    });
  }
}

export async function createAndSendCampaign(input: {
  name: string;
  subject: string;
  htmlContent: string;
  previewText?: string;
  listId?: number;
  emails?: string[];
}) {
  let listId = input.listId;
  const emails = (input.emails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length > 0) {
    listId = await createBrevoList(
      `${input.name} · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    );
    await addEmailsToList(listId, emails);
  } else {
    listId =
      listId ??
      (process.env.BREVO_LIST_ID?.trim()
        ? Number(process.env.BREVO_LIST_ID.trim())
        : NaN);
  }

  if (!Number.isFinite(listId)) {
    throw new Error(
      "Set BREVO_LIST_ID in .env.local (Brevo → Contacts → Lists → list id).",
    );
  }

  const created = await brevo<{ id: number }>("/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      subject: input.subject,
      sender: sender(),
      htmlContent: input.htmlContent,
      previewText: input.previewText || input.subject,
      recipients: { listIds: [listId] },
    }),
  });

  await brevo(`/emailCampaigns/${created.id}/sendNow`, { method: "POST" });
  return created.id;
}

export async function sendTransactionalEmail(input: {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}) {
  await brevo("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender: sender(),
      to: [{ email: input.toEmail, name: input.toName }],
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
    }),
  });
}

export function mapBrevoCampaign(c: BrevoCampaign) {
  const stats = c.statistics?.globalStats;
  const statusRaw = (c.status || "draft").toLowerCase();
  const status =
    statusRaw.includes("sent") || statusRaw === "sent"
      ? "sent"
      : statusRaw.includes("queue") || statusRaw.includes("schedule")
        ? "scheduled"
        : statusRaw.includes("archive") || statusRaw.includes("suspend")
          ? "archived"
          : "draft";

  return {
    id: String(c.id),
    brevoId: String(c.id),
    name: c.name,
    subject: c.subject || c.name,
    status,
    audience: "Brevo list",
    recipients: stats?.delivered ?? 0,
    opens: stats?.uniqueOpens ?? 0,
    clicks: stats?.uniqueClicks ?? 0,
    unsubscribes: stats?.unsubscriptions ?? 0,
    scheduledAt: c.scheduledAt ?? null,
    sentAt: c.sentDate ?? null,
    preview: c.previewText || "",
  };
}
