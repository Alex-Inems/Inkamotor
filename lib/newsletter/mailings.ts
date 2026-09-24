import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";
import { builtinTemplates } from "@/lib/newsletter/templates";

export type MailingStatus = "draft" | "in_queue" | "sending" | "sent";

export type NewsletterMailing = {
  id: string;
  name: string;
  subject: string;
  preview: string;
  html: string;
  status: MailingStatus;
  recipientTag: string | null;
  emails: string[];
  scheduledAt: string | null;
  responsible: string;
  templateId: string | null;
  odooId: number | null;
  mailingDate: string | null;
  sentCount: number;
  deliveredPct: number;
  openPct: number;
  clickPct: number;
  replyPct: number;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  name: string;
  subject: string;
  preview: string;
  html: string;
  status: string;
  recipient_tag: string | null;
  emails: unknown;
  scheduled_at: string | null;
  responsible: string;
  template_id: string | null;
  odoo_id?: number | null;
  mailing_date?: string | null;
  sent_count?: number | null;
  delivered_pct?: number | null;
  open_pct?: number | null;
  click_pct?: number | null;
  reply_pct?: number | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLS =
  "id, name, subject, preview, html, status, recipient_tag, emails, scheduled_at, responsible, template_id, odoo_id, mailing_date, sent_count, delivered_pct, open_pct, click_pct, reply_pct, created_at, updated_at";

function isMissingTable(message: string) {
  return /newsletter_mailings|schema cache|does not exist/i.test(message);
}

function asEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((row) => String(row ?? "").trim().toLowerCase())
        .filter((email) => email.includes("@")),
    ),
  ];
}

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapRow(row: Row): NewsletterMailing {
  const status = (["draft", "in_queue", "sending", "sent"].includes(row.status)
    ? row.status
    : "draft") as MailingStatus;
  return {
    id: row.id,
    name: row.name,
    subject: row.subject ?? "",
    preview: row.preview ?? "",
    html: row.html ?? "",
    status,
    recipientTag: row.recipient_tag,
    emails: asEmails(row.emails),
    scheduledAt: row.scheduled_at,
    responsible: row.responsible || "Team",
    templateId: row.template_id,
    odooId: row.odoo_id ?? null,
    mailingDate: row.mailing_date ?? null,
    sentCount: Math.max(0, Math.round(num(row.sent_count))),
    deliveredPct: num(row.delivered_pct),
    openPct: num(row.open_pct),
    clickPct: num(row.click_pct),
    replyPct: num(row.reply_pct),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function emptyMailingDraft(
  responsible = "Team",
): Omit<NewsletterMailing, "id" | "createdAt" | "updatedAt"> {
  const seed = builtinTemplates[0]!;
  return {
    name: seed.name,
    subject: seed.subject,
    preview: seed.preview,
    html: seed.html,
    status: "draft",
    recipientTag: null,
    emails: [],
    scheduledAt: null,
    responsible,
    templateId: seed.id,
    odooId: null,
    mailingDate: null,
    sentCount: 0,
    deliveredPct: 0,
    openPct: 0,
    clickPct: 0,
    replyPct: 0,
  };
}

export async function listMailings(): Promise<NewsletterMailing[]> {
  if (missingSupabaseEnv().length) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from("newsletter_mailings")
    .select(SELECT_COLS)
    .order("updated_at", { ascending: false })
    .order("mailing_date", { ascending: false, nullsFirst: false });
  if (error) {
    if (isMissingTable(error.message)) {
      throw new Error(
        "Run supabase/newsletter_mailings.sql in Supabase to enable Email Marketing drafts.",
      );
    }
    // Older DBs before stats columns — fall back without them
    if (/odoo_id|mailing_date|sent_count|delivered_pct|column/i.test(error.message)) {
      const legacy = await sb
        .from("newsletter_mailings")
        .select(
          "id, name, subject, preview, html, status, recipient_tag, emails, scheduled_at, responsible, template_id, created_at, updated_at",
        )
        .order("updated_at", { ascending: false });
      if (legacy.error) throw new Error(legacy.error.message);
      return (legacy.data ?? []).map((row) => mapRow(row as Row));
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapRow(row as Row));
}

export async function getMailing(id: string): Promise<NewsletterMailing | null> {
  if (missingSupabaseEnv().length) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("newsletter_mailings")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error.message)) {
      throw new Error(
        "Run supabase/newsletter_mailings.sql in Supabase to enable Email Marketing drafts.",
      );
    }
    if (/odoo_id|mailing_date|sent_count|delivered_pct|column/i.test(error.message)) {
      const legacy = await sb
        .from("newsletter_mailings")
        .select(
          "id, name, subject, preview, html, status, recipient_tag, emails, scheduled_at, responsible, template_id, created_at, updated_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (legacy.error) throw new Error(legacy.error.message);
      return legacy.data ? mapRow(legacy.data as Row) : null;
    }
    throw new Error(error.message);
  }
  return data ? mapRow(data as Row) : null;
}

export type MailingWrite = {
  name: string;
  subject: string;
  preview?: string;
  html: string;
  status?: MailingStatus;
  recipientTag?: string | null;
  emails?: string[];
  scheduledAt?: string | null;
  responsible?: string;
  templateId?: string | null;
  odooId?: number | null;
  mailingDate?: string | null;
  sentCount?: number;
  deliveredPct?: number;
  openPct?: number;
  clickPct?: number;
  replyPct?: number;
};

export async function upsertMailing(
  input: MailingWrite,
  id?: string,
): Promise<NewsletterMailing> {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const mailingId = id?.trim() || `mail_${Date.now()}`;
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    id: mailingId,
    name: input.name.trim() || input.subject.trim() || "Untitled mailing",
    subject: input.subject.trim(),
    preview: (input.preview ?? "").trim(),
    html: input.html,
    status: input.status ?? "draft",
    recipient_tag: input.recipientTag?.trim() || null,
    emails: input.emails ?? [],
    scheduled_at: input.scheduledAt || null,
    responsible: input.responsible?.trim() || "Team",
    template_id: input.templateId ?? null,
    updated_at: now,
  };

  if (input.odooId !== undefined) payload.odoo_id = input.odooId;
  if (input.mailingDate !== undefined) payload.mailing_date = input.mailingDate;
  if (input.sentCount !== undefined) payload.sent_count = input.sentCount;
  if (input.deliveredPct !== undefined) payload.delivered_pct = input.deliveredPct;
  if (input.openPct !== undefined) payload.open_pct = input.openPct;
  if (input.clickPct !== undefined) payload.click_pct = input.clickPct;
  if (input.replyPct !== undefined) payload.reply_pct = input.replyPct;

  const sb = getSupabase();
  if (id) {
    const { data, error } = await sb
      .from("newsletter_mailings")
      .update(payload)
      .eq("id", mailingId)
      .select(SELECT_COLS)
      .single();
    if (error) {
      if (isMissingTable(error.message)) {
        throw new Error(
          "Run supabase/newsletter_mailings.sql in Supabase to enable Email Marketing drafts.",
        );
      }
      throw new Error(error.message);
    }
    return mapRow(data as Row);
  }

  const { data, error } = await sb
    .from("newsletter_mailings")
    .insert({ ...payload, created_at: now, mailing_date: input.mailingDate ?? now })
    .select(SELECT_COLS)
    .single();
  if (error) {
    if (isMissingTable(error.message)) {
      throw new Error(
        "Run supabase/newsletter_mailings.sql in Supabase to enable Email Marketing drafts.",
      );
    }
    throw new Error(error.message);
  }
  return mapRow(data as Row);
}

export async function deleteMailing(id: string) {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const { error } = await getSupabase()
    .from("newsletter_mailings")
    .delete()
    .eq("id", id);
  if (error) {
    if (isMissingTable(error.message)) {
      throw new Error(
        "Run supabase/newsletter_mailings.sql in Supabase to enable Email Marketing drafts.",
      );
    }
    throw new Error(error.message);
  }
}

export async function seedBuiltinMailingDraftsIfEmpty(responsible = "Team") {
  const existing = await listMailings();
  if (existing.length > 0) return existing;
  const created: NewsletterMailing[] = [];
  for (const tpl of builtinTemplates) {
    created.push(
      await upsertMailing({
        name: tpl.name,
        subject: tpl.subject,
        preview: tpl.preview,
        html: tpl.html,
        status: "draft",
        responsible,
        templateId: tpl.id,
      }),
    );
  }
  return created;
}
