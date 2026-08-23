import https from "node:https";
import { missingEnv } from "@/lib/api";
import { formatBrevoUtc, toBrevoScheduledAt } from "@/lib/newsletter/html";
import { unsubscribeLink } from "@/lib/newsletter/unsubscribe";
import {
  addDays,
  chunkEmails,
  waveCampaignName,
} from "@/lib/newsletter/waves";

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
    campaignStats?: {
      delivered?: number;
      uniqueViews?: number;
      uniqueClicks?: number;
      unsubscriptions?: number;
    }[];
  };
  recipients?: { lists?: number[] };
  previewText?: string;
  htmlContent?: string;
};

export function missingBrevoEnv(): string[] {
  return missingEnv(BREVO_KEYS);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(header: string | string[] | undefined, attempt: number) {
  const raw = Array.isArray(header) ? header[0] : header;
  const seconds = raw ? Number(raw) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(15_000, Math.max(400, seconds * 1000));
  }
  return Math.min(8_000, 600 * 2 ** attempt);
}

function brevo<T>(
  path: string,
  init?: { method?: string; body?: string },
  attempt = 0,
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
          if (status === 429 && attempt < 5) {
            const wait = retryAfterMs(res.headers["retry-after"], attempt);
            sleep(wait)
              .then(() => brevo<T>(path, init, attempt + 1))
              .then(resolve, reject);
            return;
          }
          if (status >= 400) {
            reject(
              new Error(
                status === 429
                  ? "Brevo is busy. Wait a minute and try again."
                  : `Brevo ${status}: ${text.slice(0, 400)}`,
              ),
            );
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

export function isBrevoBusyError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return /\b429\b|too many requests|brevo is busy/i.test(message);
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

const CONTACT_PAGE = 500;
const CONTACT_TTL_MS = 3 * 60 * 1000;

type ContactCache = {
  listId: number;
  at: number;
  contacts: BrevoContact[];
  total: number;
};

let contactCache: ContactCache | null = null;
let contactInflight: Promise<{ contacts: BrevoContact[]; total: number }> | null =
  null;

export function invalidateBrevoContactCache() {
  contactCache = null;
}

async function fetchContactPage(listId: number, offset: number) {
  return brevo<{ contacts?: BrevoContact[]; count?: number }>(
    `/contacts/lists/${listId}/contacts?limit=${CONTACT_PAGE}&offset=${offset}&sort=desc`,
  );
}

async function loadAllContacts(listId: number) {
  const first = await fetchContactPage(listId, 0);
  const contacts = [...(first.contacts ?? [])];
  const reported = first.count ?? contacts.length;
  for (
    let offset = CONTACT_PAGE;
    offset < reported && offset <= 20_000;
    offset += CONTACT_PAGE
  ) {
    const page = await fetchContactPage(listId, offset);
    contacts.push(...(page.contacts ?? []));
  }
  const total = reported || contacts.length;
  contactCache = { listId, at: Date.now(), contacts, total };
  return { contacts, total };
}

export async function listBrevoContacts() {
  const listId = subscriberListId();
  if (listId === null) {
    throw new Error(
      "Set BREVO_LIST_ID to see subscribers (Brevo → Contacts → Lists → list id).",
    );
  }
  if (
    contactCache &&
    contactCache.listId === listId &&
    Date.now() - contactCache.at < CONTACT_TTL_MS
  ) {
    return { contacts: contactCache.contacts, total: contactCache.total };
  }
  if (contactInflight) return contactInflight;
  contactInflight = loadAllContacts(listId).finally(() => {
    contactInflight = null;
  });
  return contactInflight;
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
  invalidateBrevoContactCache();
}

/** Import many contacts onto the subscriber list (Brevo batches of up to 150). */
export async function importContactsToList(
  contacts: { email: string; name?: string | null }[],
) {
  const listId = subscriberListId();
  if (listId === null) {
    throw new Error("Set BREVO_LIST_ID before adding subscribers.");
  }

  const unique = new Map<string, { email: string; name?: string | null }>();
  for (const contact of contacts) {
    const email = contact.email.trim().toLowerCase();
    if (!email.includes("@")) continue;
    unique.set(email, { email, name: contact.name });
  }
  const rows = [...unique.values()];
  const size = 150;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size).map((contact) => {
      const [first, ...rest] = (contact.name ?? "").trim().split(/\s+/);
      const attributes: Record<string, string> = { SOURCE: "import" };
      if (first && !first.includes("@")) attributes.FIRSTNAME = first;
      if (rest.length) attributes.LASTNAME = rest.join(" ");
      return { email: contact.email, attributes };
    });
    await brevo("/contacts/import", {
      method: "POST",
      body: JSON.stringify({
        jsonBody: chunk,
        listIds: [listId],
        updateExistingContacts: true,
        emptyContactsAttributes: false,
      }),
    });
  }
  invalidateBrevoContactCache();
  return rows.length;
}

const CAMPAIGN_PAGE = 50;

export async function listBrevoCampaigns() {
  const campaigns: BrevoCampaign[] = [];
  let offset = 0;
  for (;;) {
    const data = await brevo<{ campaigns?: BrevoCampaign[] }>(
      `/emailCampaigns?limit=${CAMPAIGN_PAGE}&offset=${offset}&sort=desc&excludeHtmlContent=true&statistics=globalStats`,
    );
    const batch = data?.campaigns ?? [];
    campaigns.push(...batch);
    if (batch.length < CAMPAIGN_PAGE) break;
    offset += CAMPAIGN_PAGE;
    if (offset >= 200) break;
  }
  return campaigns;
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

async function waitForImport(processId: number) {
  const deadline = Date.now() + 90_000;
  let delay = 400;
  while (Date.now() < deadline) {
    const data = await brevo<{ status?: string }>(`/processes/${processId}`);
    const status = (data?.status ?? "").toLowerCase();
    if (status === "completed") return;
    if (status === "error" || status === "failed") {
      throw new Error("Brevo could not add those recipients to the send list.");
    }
    await sleep(delay);
    delay = Math.min(3000, delay + 200);
  }
  throw new Error("Timed out adding recipients in Brevo. Try a smaller send.");
}

export async function addEmailsToList(listId: number, emails: string[]) {
  const unique = [
    ...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  ];
  for (let i = 0; i < unique.length; i += 150) {
    const jsonBody = unique.slice(i, i + 150).map((email) => ({ email }));
    const result = await brevo<{ processId?: number }>("/contacts/import", {
      method: "POST",
      body: JSON.stringify({
        jsonBody,
        listIds: [listId],
        updateExistingContacts: true,
        emptyContactsAttributes: false,
      }),
    });
    if (result?.processId) await waitForImport(result.processId);
  }
}

async function waitForListCount(listId: number, expected: number) {
  const deadline = Date.now() + 90_000;
  let delay = 500;
  let last = 0;
  while (Date.now() < deadline) {
    const list = await brevo<{
      uniqueSubscribers?: number;
      totalSubscribers?: number;
    }>(`/contacts/lists/${listId}`);
    last = list.uniqueSubscribers ?? list.totalSubscribers ?? 0;
    if (last >= expected) return last;
    await sleep(delay);
    delay = Math.min(4000, delay + 250);
  }
  throw new Error(
    `Only ${last} of ${expected} people were added in Brevo. Try again in a minute.`,
  );
}

export async function setContactBlacklisted(email: string, blocked: boolean) {
  const identifier = encodeURIComponent(email.trim().toLowerCase());
  await brevo(`/contacts/${identifier}`, {
    method: "PUT",
    body: JSON.stringify({ emailBlacklisted: blocked }),
  });
  invalidateBrevoContactCache();
}

export async function createAndSendCampaign(input: {
  name: string;
  subject: string;
  htmlContent: string;
  previewText?: string;
  listId?: number;
  emails?: string[];
  /** UTC `YYYY-MM-DD HH:mm:ss`. Omit to send immediately. */
  scheduledAt?: string;
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
    await waitForListCount(listId, emails.length);
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
  if (!created?.id) throw new Error("Brevo did not return a campaign id.");

  if (input.scheduledAt) {
    await brevo(`/emailCampaigns/${created.id}`, {
      method: "PUT",
      body: JSON.stringify({ scheduledAt: input.scheduledAt }),
    });
    return { id: created.id, scheduled: true as const };
  }

  await brevo(`/emailCampaigns/${created.id}/sendNow`, { method: "POST" });
  return { id: created.id, scheduled: false as const };
}

export async function sendNewsletterSmtp(input: {
  subject: string;
  htmlContent: string;
  textContent?: string;
  emails: string[];
  origin: string;
}) {
  const unique = [
    ...new Set(input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  ];
  let sent = 0;
  const failed: string[] = [];
  let lastError = "";
  for (const email of unique) {
    const html = input.htmlContent.replace(
      /\{\{\s*unsubscribe\s*\}\}/gi,
      await unsubscribeLink(input.origin, email),
    );
    try {
      await sendTransactionalEmail({
        toEmail: email,
        subject: input.subject,
        htmlContent: html,
        textContent: input.textContent,
        tags: ["newsletter"],
      });
      sent += 1;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Send failed";
      failed.push(email);
    }
  }
  if (sent === 0) {
    throw new Error(
      lastError || "The newsletter did not go out. Check the sender address in Brevo.",
    );
  }
  if (failed.length > 0) {
    throw new Error(
      `Sent to ${sent} people, but ${failed.length} did not go out. ${lastError}`,
    );
  }
}

export async function sendCampaignWaves(input: {
  name: string;
  subject: string;
  htmlContent: string;
  previewText?: string;
  emails: string[];
  origin: string;
  /** datetime-local for the first wave. Omit to send wave 1 now. */
  firstAtLocal?: string;
}) {
  const chunks = chunkEmails(input.emails);
  if (chunks.length === 0) {
    throw new Error("Select at least one recipient.");
  }
  const total = chunks.length;
  const baseName = input.name.trim() || input.subject;
  const firstAt = input.firstAtLocal
    ? new Date(input.firstAtLocal)
    : new Date();
  if (input.firstAtLocal) {
    toBrevoScheduledAt(input.firstAtLocal);
  }

  const results: { id: number; scheduled: boolean; recipients: number }[] = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const emails = chunks[i]!;
      const sendNow = i === 0 && !input.firstAtLocal;
      if (sendNow) {
        await sendNewsletterSmtp({
          subject: input.subject,
          htmlContent: input.htmlContent,
          textContent: input.previewText,
          emails,
          origin: input.origin,
        });
        results.push({ id: 0, scheduled: false, recipients: emails.length });
        continue;
      }
      const created = await createAndSendCampaign({
        name: waveCampaignName(baseName, i + 1, total),
        subject: input.subject,
        htmlContent: input.htmlContent,
        previewText: input.previewText,
        emails,
        scheduledAt: formatBrevoUtc(addDays(firstAt, i)),
      });
      results.push({
        id: created.id,
        scheduled: created.scheduled,
        recipients: emails.length,
      });
    }
  } catch (err) {
    const done = results.length;
    if (done === 0) throw err;
    const reason = err instanceof Error ? err.message : "Send failed";
    throw new Error(`Sent ${done} of ${total} parts, then stopped: ${reason}`);
  }

  return {
    ids: results.map((row) => row.id).filter((id) => id > 0),
    days: total,
    waves: total,
    scheduled: results.some((row) => row.scheduled),
    recipients: input.emails.length,
  };
}

export async function sendTransactionalEmail(input: {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  tags?: string[];
}) {
  await brevo("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender: sender(),
      to: [{ email: input.toEmail, name: input.toName }],
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
      tags: input.tags,
    }),
  });
}

export function mapBrevoCampaign(c: BrevoCampaign) {
  const stats = c.statistics?.globalStats;
  const list = c.statistics?.campaignStats?.[0];
  const delivered = stats?.delivered || list?.delivered || 0;
  const raw = (c.status || "draft").toLowerCase().replace(/[_-]/g, "");
  const status =
    c.sentDate || delivered > 0 || raw === "sent"
      ? "sent"
      : raw.includes("queue") || raw.includes("process") || raw.includes("review")
        ? "sending"
        : raw.includes("schedule")
          ? "scheduled"
          : raw.includes("archive") || raw.includes("suspend") || raw.includes("cancel")
            ? "archived"
            : "draft";

  return {
    id: String(c.id),
    brevoId: String(c.id),
    name: c.name,
    subject: c.subject || c.name,
    status,
    audience: "Brevo list",
    recipients: delivered,
    opens: stats?.uniqueOpens || list?.uniqueViews || 0,
    clicks: stats?.uniqueClicks || list?.uniqueClicks || 0,
    unsubscribes: stats?.unsubscriptions || list?.unsubscriptions || 0,
    scheduledAt: c.scheduledAt ?? null,
    sentAt: c.sentDate ?? null,
    preview: c.previewText || "",
  };
}

type SmtpEvent = {
  email?: string;
  event?: string;
  date?: string;
  subject?: string;
  tag?: string;
  tags?: string[];
};

export async function listNewsletterOutbox() {
  const data = await brevo<{ events?: SmtpEvent[] }>(
    "/smtp/statistics/events?limit=50&sort=desc",
  );
  const groups = new Map<
    string,
    { subject: string; date: string; emails: Set<string>; opens: number }
  >();
  for (const row of data.events ?? []) {
    const subject = (row.subject ?? "").trim();
    if (!subject || /^re:/i.test(subject) || /^invoice\b/i.test(subject)) {
      continue;
    }
    const tags = [
      row.tag,
      ...(Array.isArray(row.tags) ? row.tags : []),
    ]
      .filter(Boolean)
      .map((tag) => String(tag).toLowerCase());
    const newsletter =
      tags.includes("newsletter") ||
      !/^re:/i.test(subject);
    if (!newsletter) continue;
    if (row.event !== "delivered" && row.event !== "opened" && row.event !== "requests") {
      continue;
    }
    const minute = (row.date ?? "").slice(0, 16);
    const key = `${subject.toLowerCase()}|${minute}`;
    const group = groups.get(key) ?? {
      subject,
      date: row.date ?? minute,
      emails: new Set<string>(),
      opens: 0,
    };
    if (row.email) group.emails.add(row.email.toLowerCase());
    if (row.event === "opened") group.opens += 1;
    groups.set(key, group);
  }
  return [...groups.values()].map((group, index) => ({
    id: `out-${group.date}-${index}`,
    brevoId: "",
    name: group.subject,
    subject: group.subject,
    status: "sent" as const,
    audience: "Selected people",
    recipients: group.emails.size,
    opens: group.opens,
    clicks: 0,
    unsubscribes: 0,
    scheduledAt: null as string | null,
    sentAt: group.date,
    preview: "",
  }));
}
