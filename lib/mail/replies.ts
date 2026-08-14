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

export async function saveMailReply(input: {
  toEmail: string;
  toName?: string | null;
  subject: string;
  bodyText: string;
  relatedMailId?: string | null;
  relatedInquiryId?: string | null;
}): Promise<MailReply> {
  if (missingSupabaseEnv().length > 0) {
    throw new Error("Supabase is not configured — cannot store sent reply.");
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mail_replies")
    .insert({
      to_email: input.toEmail,
      to_name: input.toName ?? null,
      subject: input.subject,
      body_text: input.bodyText,
      related_mail_id: input.relatedMailId ?? null,
      related_inquiry_id: input.relatedInquiryId ?? null,
      sent_at: new Date().toISOString(),
    })
    .select(
      "id, to_name, to_email, subject, body_text, related_mail_id, related_inquiry_id, sent_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}
