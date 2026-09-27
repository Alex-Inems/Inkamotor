import { listAttachmentsByReplyIds } from "@/lib/mail/attachments";
import {
  normalizeProviderMessageId,
  type DeliveryStatus,
} from "@/lib/mail/delivery";
import { isMissingColumnError } from "@/lib/mail/schema-compat";
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
  providerMessageId: string | null;
  deliveryStatus: DeliveryStatus | null;
  deliveredAt: string | null;
  openedAt: string | null;
  attachments: MailReplyAttachment[];
};

export type MailReplyAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REPLY_SELECT_BASE =
  "id, to_name, to_email, subject, body_text, related_mail_id, related_inquiry_id, sent_at";

const REPLY_SELECT = `${REPLY_SELECT_BASE}, provider_message_id, delivery_status, delivered_at, opened_at`;

function asUuid(value?: string | null): string | null {
  const v = value?.trim();
  return v && UUID_RE.test(v) ? v : null;
}

function mapRow(
  row: Record<string, unknown>,
  attachments: MailReplyAttachment[] = [],
): MailReply {
  const status = row.delivery_status;
  return {
    id: String(row.id),
    toName: (row.to_name as string) || null,
    toEmail: String(row.to_email),
    subject: String(row.subject ?? ""),
    bodyText: String(row.body_text ?? ""),
    relatedMailId: (row.related_mail_id as string) || null,
    relatedInquiryId: (row.related_inquiry_id as string) || null,
    sentAt: String(row.sent_at),
    providerMessageId: (row.provider_message_id as string) || null,
    deliveryStatus:
      typeof status === "string" && status
        ? (status as DeliveryStatus)
        : null,
    deliveredAt: (row.delivered_at as string) || null,
    openedAt: (row.opened_at as string) || null,
    attachments,
  };
}

async function withAttachments(rows: MailReply[]): Promise<MailReply[]> {
  const attachmentMap = await listAttachmentsByReplyIds(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    attachments: (attachmentMap.get(row.id) ?? []).map((file) => ({
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
    })),
  }));
}

async function selectReplies(
  build: (
    select: string,
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
) {
  const withDelivery = await build(REPLY_SELECT);
  if (!withDelivery.error) return withDelivery;
  if (!isMissingColumnError(withDelivery.error)) return withDelivery;
  return build(REPLY_SELECT_BASE);
}

export async function listMailReplies(limit = 100): Promise<MailReply[]> {
  const supabase = getSupabase();
  const { data, error } = await selectReplies((select) =>
    supabase
      .from("mail_replies")
      .select(select)
      .order("sent_at", { ascending: false })
      .limit(limit),
  );
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  return withAttachments(rows);
}

/** Sent CRM replies for one client email, newest first. */
export async function listMailRepliesForEmail(
  email: string,
  limit = 200,
): Promise<MailReply[]> {
  const key = email.trim().toLowerCase();
  if (!key.includes("@")) return [];
  const supabase = getSupabase();
  const { data, error } = await selectReplies((select) =>
    supabase
      .from("mail_replies")
      .select(select)
      .ilike("to_email", key)
      .order("sent_at", { ascending: false })
      .limit(limit),
  );
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  return withAttachments(rows);
}

type SaveInput = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  bodyText: string;
  relatedMailId?: string | null;
  relatedInquiryId?: string | null;
  providerMessageId?: string | null;
  deliveryStatus?: DeliveryStatus | null;
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
  const providerMessageId = normalizeProviderMessageId(input.providerMessageId);
  const deliveryStatus = input.deliveryStatus ?? "sent";
  const toEmail = input.toEmail.trim().toLowerCase();
  const fromEmail =
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.IMAP_USER?.trim() ||
    "contact@inkamototours.com";
  const fromName = process.env.BREVO_SENDER_NAME?.trim() || "Inkamoto Tours";
  const preview = input.bodyText.replace(/\s+/g, " ").trim().slice(0, 240);

  const supabase = getSupabase();
  const basePayload = {
    to_email: toEmail,
    to_name: input.toName ?? null,
    subject: input.subject,
    body_text: input.bodyText,
    related_mail_id: relatedMailId,
    related_inquiry_id: input.relatedInquiryId ?? null,
    sent_at: sentAt,
  };
  const deliveryPayload = {
    provider_message_id: providerMessageId,
    delivery_status: deliveryStatus,
  };

  async function insertReply(
    related: string | null,
    withDelivery: boolean,
  ) {
    const payload = withDelivery
      ? { ...basePayload, related_mail_id: related, ...deliveryPayload }
      : { ...basePayload, related_mail_id: related };
    return supabase
      .from("mail_replies")
      .insert(payload)
      .select(withDelivery ? REPLY_SELECT : REPLY_SELECT_BASE)
      .single();
  }

  let reply: MailReply | null = null;
  let inserted = await insertReply(relatedMailId, true);

  if (inserted.error && isMissingColumnError(inserted.error)) {
    inserted = await insertReply(relatedMailId, false);
  }

  if (inserted.error && relatedMailId) {
    let retry = await insertReply(null, true);
    if (retry.error && isMissingColumnError(retry.error)) {
      retry = await insertReply(null, false);
    }
    if (!retry.error && retry.data) {
      reply = mapRow(retry.data as Record<string, unknown>);
    }
  } else if (!inserted.error && inserted.data) {
    reply = mapRow(inserted.data as Record<string, unknown>);
  }

  const copyId = reply?.id ?? crypto.randomUUID();
  const messageBase = {
    message_id: `crm-sent-${copyId}`,
    folder: "SENT",
    from_name: fromName,
    from_email: fromEmail,
    to_email: toEmail,
    subject: input.subject,
    preview,
    body_text: input.bodyText.slice(0, 20000),
    received_at: sentAt,
    is_read: true,
    synced_at: sentAt,
  };

  let copyError = (
    await supabase.from("mail_messages").upsert(
      { ...messageBase, ...deliveryPayload },
      { onConflict: "message_id" },
    )
  ).error;

  if (copyError && isMissingColumnError(copyError)) {
    copyError = (
      await supabase
        .from("mail_messages")
        .upsert(messageBase, { onConflict: "message_id" })
    ).error;
  }

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
      toEmail,
      subject: input.subject,
      bodyText: input.bodyText,
      relatedMailId,
      relatedInquiryId: input.relatedInquiryId ?? null,
      sentAt,
      providerMessageId,
      deliveryStatus,
      deliveredAt: null,
      openedAt: null,
      attachments: [],
    }
  );
}
