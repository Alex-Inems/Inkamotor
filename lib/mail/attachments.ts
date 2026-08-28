import { decodeBytea, encodeByteaHex } from "@/lib/mail/bytea";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export type MailAttachmentMeta = {
  id: string;
  replyId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

function mapMeta(row: Record<string, unknown>): MailAttachmentMeta {
  return {
    id: String(row.id),
    replyId: String(row.reply_id),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type ?? "application/pdf"),
    byteSize: Number(row.byte_size ?? 0),
  };
}

export async function saveReplyAttachment(input: {
  replyId: string;
  fileName: string;
  mimeType?: string;
  base64: string;
}): Promise<MailAttachmentMeta | null> {
  if (missingSupabaseEnv().length > 0) return null;

  const bytes = Buffer.from(input.base64, "base64");
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mail_reply_attachments")
    .insert({
      reply_id: input.replyId,
      file_name: input.fileName,
      mime_type: input.mimeType ?? "application/pdf",
      file_data: encodeByteaHex(bytes),
      byte_size: bytes.length,
    })
    .select("id, reply_id, file_name, mime_type, byte_size")
    .single();

  if (error || !data) return null;
  return mapMeta(data as Record<string, unknown>);
}

export async function listAttachmentsByReplyIds(
  replyIds: string[],
): Promise<Map<string, MailAttachmentMeta[]>> {
  const map = new Map<string, MailAttachmentMeta[]>();
  if (replyIds.length === 0 || missingSupabaseEnv().length > 0) return map;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mail_reply_attachments")
    .select("id, reply_id, file_name, mime_type, byte_size")
    .in("reply_id", replyIds)
    .order("created_at", { ascending: true });

  if (error || !data) return map;

  for (const row of data) {
    const meta = mapMeta(row as Record<string, unknown>);
    const bucket = map.get(meta.replyId) ?? [];
    bucket.push(meta);
    map.set(meta.replyId, bucket);
  }
  return map;
}

export async function getReplyAttachmentFile(id: string) {
  if (missingSupabaseEnv().length > 0) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mail_reply_attachments")
    .select("id, reply_id, file_name, mime_type, byte_size, file_data")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const buffer = decodeBytea(row.file_data);
  if (!buffer?.length) return null;

  return {
    meta: mapMeta(row),
    data: buffer,
  };
}
