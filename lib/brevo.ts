import { missingEnv } from "@/lib/api";

const BREVO_KEYS = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL"] as const;
const BASE = "https://api.brevo.com/v3";

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

function headers() {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": process.env.BREVO_API_KEY!.trim(),
  };
}

async function brevo<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo ${res.status}: ${text.slice(0, 400)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function sender() {
  return {
    email: process.env.BREVO_SENDER_EMAIL!.trim(),
    name: process.env.BREVO_SENDER_NAME?.trim() || "Inkamoto Tours",
  };
}

export function listIdFromEnv(): number | null {
  const raw = process.env.BREVO_LIST_ID?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function listBrevoSubscribers(limit = 100, offset = 0) {
  const listId = listIdFromEnv();
  if (listId == null) {
    throw new Error(
      "Set BREVO_LIST_ID to load subscribers (Contacts → Lists → list id).",
    );
  }

  const data = await brevo<{
    contacts?: Array<{
      id?: number;
      email?: string;
      emailBlacklisted?: boolean;
      createdAt?: string;
      modifiedAt?: string;
      attributes?: Record<string, unknown>;
    }>;
    count?: number;
  }>(
    `/contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}&sort=desc`,
  );

  const contacts = (data.contacts ?? []).map((c) => {
    const attrs = c.attributes ?? {};
    const first = String(attrs.FIRSTNAME ?? attrs.PRENOM ?? "").trim();
    const last = String(attrs.LASTNAME ?? attrs.NOM ?? "").trim();
    const name =
      [first, last].filter(Boolean).join(" ") ||
      String(attrs.NAME ?? "").trim() ||
      null;
    return {
      id: String(c.id ?? c.email ?? ""),
      email: (c.email || "").toLowerCase(),
      name,
      blacklisted: Boolean(c.emailBlacklisted),
      createdAt: c.createdAt ?? null,
      modifiedAt: c.modifiedAt ?? null,
    };
  });

  return { contacts, total: data.count ?? contacts.length, listId };
}

/** Create or update a contact and add them to BREVO_LIST_ID. */
export async function upsertSubscriber(input: {
  email: string;
  name?: string | null;
  source?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@") || email.endsWith("@unknown")) {
    return { ok: false as const, skipped: true as const };
  }

  const ours = new Set(
    [
      process.env.IMAP_USER?.trim().toLowerCase(),
      process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase(),
      "contact@inkamototours.com",
    ].filter(Boolean) as string[],
  );
  if (ours.has(email)) {
    return { ok: false as const, skipped: true as const };
  }

  const listId = listIdFromEnv();
  if (listId == null || missingBrevoEnv().length > 0) {
    return { ok: false as const, skipped: true as const };
  }

  const name = (input.name || "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const attributes: Record<string, string> = {};
  if (parts[0]) attributes.FIRSTNAME = parts[0];
  if (parts.length > 1) attributes.LASTNAME = parts.slice(1).join(" ");

  await brevo("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      updateEnabled: true,
      listIds: [listId],
      attributes: Object.keys(attributes).length ? attributes : undefined,
    }),
  });

  return { ok: true as const, skipped: false as const, email };
}

export async function listBrevoCampaigns(limit = 50) {
  const data = await brevo<{ campaigns?: BrevoCampaign[] }>(
    `/emailCampaigns?limit=${limit}&sort=desc`,
  );
  return data.campaigns ?? [];
}

export async function createAndSendCampaign(input: {
  name: string;
  subject: string;
  htmlContent: string;
  previewText?: string;
  listId?: number;
}) {
  const listId =
    input.listId ?? listIdFromEnv() ?? NaN;

  if (!Number.isFinite(listId)) {
    throw new Error(
      "Set BREVO_LIST_ID in .env.local (Contacts → Lists → list id).",
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
    audience: "Subscriber list",
    recipients: stats?.delivered ?? 0,
    opens: stats?.uniqueOpens ?? 0,
    clicks: stats?.uniqueClicks ?? 0,
    unsubscribes: stats?.unsubscriptions ?? 0,
    scheduledAt: c.scheduledAt ?? null,
    sentAt: c.sentDate ?? null,
    preview: c.previewText || "",
  };
}
