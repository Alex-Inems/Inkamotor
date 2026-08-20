import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export type MailReply = {
  id: string;
  toName: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  relatedMailId: string | null;
  relatedInquiryId: string | null;
  sentAt: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value?: string | null): string | null {
  const v = value?.trim();
  return v && UUID_RE.test(v) ? v : null;
}

function mapRow(row: Record<string, unknown>): MailReply {
  return {
    id: String(row.id),
    toName: (row.to_name as string) || null,
    toEmail: String(row.to_email),
    subject: String(row.subject ?? ""),
    bodyText: String(row.body_text ?? ""),
    relatedMailId: (row.related_mail_id as string) || null,
    relatedInquiryId: (row.related_inquiry_id as string) || null,
    sentAt: String(row.sent_at),
  };
}

export async function listMailReplies(limit = 100): Promise<MailReply[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mail_replies")
    .select(
      "id, to_name, to_email, subject, body_text, related_mail_id, related_inquiry_id, sent_at",
    )
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

type SaveInput = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  bodyText: string;
  relatedMailId?: string | null;
  relatedInquiryId?: string | null;
};

/**
 * Persist an outbound reply so it always shows in conversation history.
 * Writes mail_replies (sent log) and a SENT row in mail_messages (the table
 * the inbox already reads). Either table is enough for the UI.
 */
export async function saveMailReply(input: SaveInput): Promise<MailReply> {
  if (missingSupabaseEnv().length > 0) {
    throw new Error("Supabase is not configured — cannot store sent reply.");
  }

  const sentAt = new Date().toISOString();
  const relatedMailId = asUuid(input.relatedMailId);
  const fromEmail =
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.IMAP_USER?.trim() ||
    "contact@inkamototours.com";
  const fromName = process.env.BREVO_SENDER_NAME?.trim() || "Inkamoto Tours";
  const preview = input.bodyText.replace(/\s+/g, " ").trim().slice(0, 240);

  const supabase = getSupabase();
  const payload = {
    to_email: input.toEmail,
    to_name: input.toName ?? null,
    subject: input.subject,
    body_text: input.bodyText,
    related_mail_id: relatedMailId,
    related_inquiry_id: input.relatedInquiryId ?? null,
    sent_at: sentAt,
  };

  let reply: MailReply | null = null;
  const inserted = await supabase
    .from("mail_replies")
    .insert(payload)
    .select(
      "id, to_name, to_email, subject, body_text, related_mail_id, related_inquiry_id, sent_at",
    )
    .single();

  if (inserted.error && relatedMailId) {
    const retry = await supabase
      .from("mail_replies")
      .insert({ ...payload, related_mail_id: null })
      .select(
        "id, to_name, to_email, subject, body_text, related_mail_id, related_inquiry_id, sent_at",
      )
      .single();
    if (!retry.error && retry.data) {
      reply = mapRow(retry.data as Record<string, unknown>);
    }
  } else if (!inserted.error && inserted.data) {
    reply = mapRow(inserted.data as Record<string, unknown>);
  }

  const copyId = reply?.id ?? crypto.randomUUID();
  const { error: copyError } = await supabase.from("mail_messages").upsert(
    {
      message_id: `crm-sent-${copyId}`,
      folder: "SENT",
      from_name: fromName,
      from_email: fromEmail,
      to_email: input.toEmail,
      subject: input.subject,
      preview,
      body_text: input.bodyText.slice(0, 20000),
      received_at: sentAt,
      is_read: true,
      synced_at: sentAt,
    },
    { onConflict: "message_id" },
  );

  if (!reply && copyError) {
    throw new Error(
      inserted.error?.message ||
        copyError.message ||
        "Could not save reply to history",
    );
  }

  return (
    reply ?? {
      id: copyId,
      toName: input.toName ?? null,
      toEmail: input.toEmail,
      subject: input.subject,
      bodyText: input.bodyText,
      relatedMailId,
      relatedInquiryId: input.relatedInquiryId ?? null,
      sentAt,
    }
  );
}
