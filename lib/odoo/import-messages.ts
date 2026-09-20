import { connectOdoo, type OdooClient } from "@/lib/odoo/client";
import { getSupabase } from "@/lib/supabase/server";

export type OdooMessageImportStats = {
  partners: number;
  fetched: number;
  upserted: number;
  skipped: number;
  errors: string[];
};

type PartnerRow = {
  id: number;
  name: string;
  email: string;
};

type OdooMailMessage = {
  id: number;
  date: string;
  subject: string | false;
  body: string | false;
  email_from: string | false;
  message_type: string;
  author_id: [number, string] | false;
  partner_ids: number[];
  model: string | false;
  res_id: number | false;
};

const OWN_HINTS = [
  "inkamototours.com",
  "inkamoto",
  "contact@inkamototours",
];

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmail(raw: string | false | null | undefined): string | null {
  if (!raw || raw === false) return null;
  const match = String(raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? null;
}

function isOwnEmail(email: string | null, ownEmails: string[]) {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (ownEmails.some((x) => x === lower)) return true;
  return OWN_HINTS.some((hint) => lower.includes(hint));
}

function asIso(value: string | false | null | undefined) {
  if (!value || value === false) return new Date().toISOString();
  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function loadCrmEmails(): Promise<string[]> {
  const sb = getSupabase();
  const emails = new Set<string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await sb
      .from("leads")
      .select("email")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const email = String((row as { email?: string }).email ?? "")
        .trim()
        .toLowerCase();
      if (email.includes("@")) emails.add(email);
    }
    if (rows.length < page) break;
    from += page;
  }
  return [...emails];
}

async function fetchPartnersByEmail(
  client: OdooClient,
  emails: string[],
): Promise<PartnerRow[]> {
  const partners: PartnerRow[] = [];
  for (const batch of chunk(emails, 80)) {
    const rows = await client.executeKw<
      { id: number; name: string; email: string | false }[]
    >("res.partner", "search_read", [[["email", "in", batch]]], {
      fields: ["id", "name", "email"],
      limit: batch.length,
    });
    for (const row of rows) {
      const email = extractEmail(row.email);
      if (!email) continue;
      partners.push({ id: row.id, name: row.name || email, email });
    }
  }
  return partners;
}

async function fetchMessagesForPartners(
  client: OdooClient,
  partnerIds: number[],
): Promise<OdooMailMessage[]> {
  const messages: OdooMailMessage[] = [];
  for (const batch of chunk(partnerIds, 40)) {
    const domain = [
      "&",
      ["message_type", "in", ["email", "comment"]],
      "|",
      ["partner_ids", "in", batch],
      "&",
      ["model", "=", "res.partner"],
      ["res_id", "in", batch],
    ];
    let offset = 0;
    const pageSize = 200;
    for (;;) {
      const rows = await client.executeKw<OdooMailMessage[]>(
        "mail.message",
        "search_read",
        [domain],
        {
          fields: [
            "id",
            "date",
            "subject",
            "body",
            "email_from",
            "message_type",
            "author_id",
            "partner_ids",
            "model",
            "res_id",
          ],
          limit: pageSize,
          offset,
          order: "date asc",
        },
      );
      messages.push(...rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
  }
  return messages;
}

function resolveClientEmail(
  msg: OdooMailMessage,
  partnersById: Map<number, PartnerRow>,
  ownEmails: string[],
): string | null {
  for (const pid of msg.partner_ids || []) {
    const partner = partnersById.get(pid);
    if (partner && !isOwnEmail(partner.email, ownEmails)) return partner.email;
  }
  if (msg.model === "res.partner" && typeof msg.res_id === "number") {
    const partner = partnersById.get(msg.res_id);
    if (partner && !isOwnEmail(partner.email, ownEmails)) return partner.email;
  }
  const from = extractEmail(msg.email_from);
  if (from && !isOwnEmail(from, ownEmails)) return from;
  return null;
}

export async function importOdooClientMessages(options?: {
  emails?: string[];
  limitPartners?: number;
}): Promise<OdooMessageImportStats> {
  const client = await connectOdoo();
  const ownEmails = [
    process.env.IMAP_USER?.trim().toLowerCase(),
    process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase(),
    "contact@inkamototours.com",
  ].filter(Boolean) as string[];

  let emails = options?.emails?.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!emails?.length) emails = await loadCrmEmails();
  if (options?.limitPartners) emails = emails.slice(0, options.limitPartners);

  const stats: OdooMessageImportStats = {
    partners: 0,
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: [],
  };

  if (!emails.length) return stats;

  const partners = await fetchPartnersByEmail(client, emails);
  stats.partners = partners.length;
  if (!partners.length) return stats;

  const partnersById = new Map(partners.map((p) => [p.id, p]));
  const messages = await fetchMessagesForPartners(
    client,
    partners.map((p) => p.id),
  );
  stats.fetched = messages.length;

  const sb = getSupabase();
  const companyFrom =
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.IMAP_USER?.trim() ||
    "contact@inkamototours.com";
  const companyName = process.env.BREVO_SENDER_NAME?.trim() || "Inkamoto Tours";

  for (const msg of messages) {
    try {
      const clientEmail = resolveClientEmail(msg, partnersById, ownEmails);
      if (!clientEmail) {
        stats.skipped += 1;
        continue;
      }
      const bodyHtml = typeof msg.body === "string" ? msg.body : "";
      const bodyText = stripHtml(bodyHtml).slice(0, 20000);
      if (!bodyText && !(typeof msg.subject === "string" && msg.subject.trim())) {
        stats.skipped += 1;
        continue;
      }
      const fromEmail = extractEmail(msg.email_from);
      const outbound = isOwnEmail(fromEmail, ownEmails) || !fromEmail;
      const subject =
        (typeof msg.subject === "string" && msg.subject.trim()) ||
        (msg.message_type === "comment" ? "Note" : "(no subject)");
      const preview = bodyText.replace(/\s+/g, " ").trim().slice(0, 240);
      const receivedAt = asIso(msg.date);
      const partner = partners.find((p) => p.email === clientEmail);

      const { error } = await sb.from("mail_messages").upsert(
        {
          message_id: `odoo-msg-${msg.id}`,
          folder: outbound ? "SENT" : "INBOX",
          from_name: outbound
            ? companyName
            : partner?.name || fromEmail || null,
          from_email: outbound ? companyFrom : fromEmail || clientEmail,
          to_email: outbound ? clientEmail : companyFrom,
          subject:
            msg.message_type === "comment" && !String(msg.subject || "").trim()
              ? `[Odoo] ${subject}`
              : subject,
          preview: preview || subject,
          body_text: bodyText || subject,
          received_at: receivedAt,
          is_read: true,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "message_id" },
      );
      if (error) {
        stats.errors.push(`#${msg.id}: ${error.message}`);
        continue;
      }
      stats.upserted += 1;
    } catch (err) {
      stats.errors.push(
        `#${msg.id}: ${err instanceof Error ? err.message : "failed"}`,
      );
    }
  }

  return stats;
}
