import { decodeBytea, encodeByteaHex } from "@/lib/mail/bytea";
import { isMissingColumnError } from "@/lib/mail/schema-compat";
import { supabaseHttps } from "@/lib/supabase/https";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export type MailAttachmentMeta = {
  id: string;
  replyId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

const BUCKET = "mail-attachments";
/** Prefer Storage over hex bytea once files get large. */
const STORAGE_THRESHOLD = 512 * 1024;

function mapMeta(row: Record<string, unknown>): MailAttachmentMeta {
  return {
    id: String(row.id),
    replyId: String(row.reply_id),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type ?? "application/pdf"),
    byteSize: Number(row.byte_size ?? 0),
  };
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
  };
}

function supabaseBaseUrl() {
  return (process.env.SUPABASE_URL?.trim() ?? "").replace(/\/$/, "");
}

function safeStorageName(name: string) {
  return name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120) || "file.bin";
}

async function ensureAttachmentsBucket() {
  const baseUrl = supabaseBaseUrl();
  if (!baseUrl) return;
  try {
    const list = await supabaseHttps({
      url: `${baseUrl}/storage/v1/bucket`,
      method: "GET",
      headers: { ...authHeaders(), Accept: "application/json" },
    });
    if (list.status < 400) {
      const buckets = JSON.parse(list.text) as { name?: string; id?: string }[];
      if (buckets.some((b) => b.name === BUCKET || b.id === BUCKET)) return;
    }
  } catch {
    /* create */
  }
  try {
    await supabaseHttps({
      url: `${baseUrl}/storage/v1/bucket`,
      method: "POST",
      headers: {
        ...authHeaders(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: BUCKET,
        name: BUCKET,
        public: false,
        file_size_limit: 20 * 1024 * 1024,
      }),
    });
  } catch {
    /* ignore */
  }
}

async function uploadAttachmentBytes(
  storagePath: string,
  bytes: Buffer,
  mimeType: string,
): Promise<boolean> {
  const baseUrl = supabaseBaseUrl();
  if (!baseUrl) return false;
  await ensureAttachmentsBucket();
  try {
    const uploaded = await supabaseHttps({
      url: `${baseUrl}/storage/v1/object/${BUCKET}/${storagePath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": mimeType || "application/octet-stream",
        "x-upsert": "true",
      },
      body: bytes,
    });
    return uploaded.status < 400;
  } catch {
    return false;
  }
}

async function downloadAttachmentBytes(
  storagePath: string,
): Promise<Buffer | null> {
  try {
    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Save a file on a mail_reply OR mail_message row.
 * `reply_id` has no FK — we reuse it for mail_messages.id for Odoo chatter docs.
 */
export async function saveReplyAttachment(input: {
  replyId: string;
  fileName: string;
  mimeType?: string;
  base64: string;
  /** Skip insert when same file already linked to this message/reply. */
  dedupe?: boolean;
}): Promise<MailAttachmentMeta | null> {
  if (missingSupabaseEnv().length > 0) return null;

  const bytes = Buffer.from(input.base64, "base64");
  if (!bytes.length) return null;
  const supabase = getSupabase();
  const mimeType = input.mimeType ?? "application/pdf";

  if (input.dedupe !== false) {
    const { data: existing } = await supabase
      .from("mail_reply_attachments")
      .select("id, reply_id, file_name, mime_type, byte_size")
      .eq("reply_id", input.replyId)
      .eq("file_name", input.fileName)
      .eq("byte_size", bytes.length)
      .maybeSingle();
    if (existing) return mapMeta(existing as Record<string, unknown>);
  }

  const id = crypto.randomUUID();
  const useStorage = bytes.length >= STORAGE_THRESHOLD;
  let storagePath: string | null = null;

  if (useStorage) {
    storagePath = `${input.replyId}/${id}/${safeStorageName(input.fileName)}`;
    const ok = await uploadAttachmentBytes(storagePath, bytes, mimeType);
    if (!ok) storagePath = null;
  }

  if (storagePath) {
    const { data, error } = await supabase
      .from("mail_reply_attachments")
      .insert({
        id,
        reply_id: input.replyId,
        file_name: input.fileName,
        mime_type: mimeType,
        storage_path: storagePath,
        byte_size: bytes.length,
      })
      .select("id, reply_id, file_name, mime_type, byte_size")
      .single();

    if (!error && data) return mapMeta(data as Record<string, unknown>);
    if (error && !isMissingColumnError(error)) {
      // Fall through to bytea.
    }
  }

  const { data, error } = await supabase
    .from("mail_reply_attachments")
    .insert({
      reply_id: input.replyId,
      file_name: input.fileName,
      mime_type: mimeType,
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
  const chunk = 100;
  for (let i = 0; i < replyIds.length; i += chunk) {
    const slice = replyIds.slice(i, i + chunk);
    const { data, error } = await supabase
      .from("mail_reply_attachments")
      .select("id, reply_id, file_name, mime_type, byte_size")
      .in("reply_id", slice)
      .order("created_at", { ascending: true });

    if (error || !data) continue;

    for (const row of data) {
      const meta = mapMeta(row as Record<string, unknown>);
      const bucket = map.get(meta.replyId) ?? [];
      bucket.push(meta);
      map.set(meta.replyId, bucket);
    }
  }
  return map;
}

export async function getReplyAttachmentFile(id: string) {
  if (missingSupabaseEnv().length > 0) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mail_reply_attachments")
    .select("id, reply_id, file_name, mime_type, byte_size, file_data, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      const retry = await supabase
        .from("mail_reply_attachments")
        .select("id, reply_id, file_name, mime_type, byte_size, file_data")
        .eq("id", id)
        .maybeSingle();
      if (retry.error || !retry.data) return null;
      const row = retry.data as Record<string, unknown>;
      const buffer = decodeBytea(row.file_data);
      if (!buffer?.length) return null;
      return { meta: mapMeta(row), data: buffer };
    }
    return null;
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const storagePath =
    typeof row.storage_path === "string" ? row.storage_path.trim() : "";
  if (storagePath) {
    const buffer = await downloadAttachmentBytes(storagePath);
    if (buffer?.length) {
      return { meta: mapMeta(row), data: buffer };
    }
  }

  const buffer = decodeBytea(row.file_data);
  if (!buffer?.length) return null;

  return {
    meta: mapMeta(row),
    data: buffer,
  };
}

export async function deleteReplyAttachment(id: string): Promise<boolean> {
  if (missingSupabaseEnv().length > 0) return false;
  const supabase = getSupabase();

  const { data } = await supabase
    .from("mail_reply_attachments")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!data) return false;

  const storagePath =
    typeof (data as { storage_path?: string }).storage_path === "string"
      ? (data as { storage_path: string }).storage_path.trim()
      : "";
  if (storagePath) {
    await supabase.storage
      .from(BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
  }

  const { error } = await supabase
    .from("mail_reply_attachments")
    .delete()
    .eq("id", id);
  return !error;
}
