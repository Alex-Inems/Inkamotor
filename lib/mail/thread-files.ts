import type { ActorAttribution } from "@/lib/auth-actor";
import { isMissingColumnError } from "@/lib/mail/schema-compat";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export type MailThreadFile = {
  id: string;
  threadEmail: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storagePath: string | null;
  uploadedByEmail: string | null;
  uploadedByName: string | null;
  createdAt: string;
};

function mapFile(row: Record<string, unknown>): MailThreadFile {
  return {
    id: String(row.id),
    threadEmail: String(row.thread_email ?? "").toLowerCase(),
    fileName: String(row.file_name ?? ""),
    mimeType: String(row.mime_type ?? "application/octet-stream"),
    byteSize: Number(row.byte_size ?? 0),
    storagePath: (row.storage_path as string) || null,
    uploadedByEmail: (row.uploaded_by_email as string) || null,
    uploadedByName: (row.uploaded_by_name as string) || null,
    createdAt: String(row.created_at),
  };
}

export async function listThreadFiles(
  threadEmail: string,
): Promise<MailThreadFile[]> {
  if (missingSupabaseEnv().length) return [];
  const key = threadEmail.trim().toLowerCase();
  if (!key) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from("mail_thread_files")
    .select(
      "id, thread_email, file_name, mime_type, byte_size, storage_path, uploaded_by_email, uploaded_by_name, created_at",
    )
    .ilike("thread_email", key)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingColumnError(error) || /relation .* does not exist/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapFile(row as Record<string, unknown>));
}

export async function saveThreadFile(input: {
  threadEmail: string;
  fileName: string;
  mimeType: string;
  base64: string;
  actor?: ActorAttribution | null;
}): Promise<MailThreadFile> {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const bytes = Buffer.from(input.base64, "base64");
  const sb = getSupabase();
  const threadEmail = input.threadEmail.trim().toLowerCase();
  const fileName = input.fileName.trim();
  const storagePath = `thread/${threadEmail}/${Date.now()}-${fileName}`;

  // Prefer Storage when the mail-attachments bucket is available.
  let storedPath: string | null = null;
  try {
    const { error: upErr } = await sb.storage
      .from("mail-attachments")
      .upload(storagePath, bytes, {
        contentType: input.mimeType || "application/octet-stream",
        upsert: false,
      });
    if (!upErr) storedPath = storagePath;
  } catch {
    /* fall through to bytea */
  }

  const payload: Record<string, unknown> = {
    thread_email: threadEmail,
    file_name: fileName,
    mime_type: input.mimeType || "application/octet-stream",
    byte_size: bytes.length,
    storage_path: storedPath,
    uploaded_by_email: input.actor?.email ?? null,
    uploaded_by_name: input.actor?.name ?? null,
  };
  if (!storedPath) {
    payload.file_data = `\\x${bytes.toString("hex")}`;
  }

  const { data, error } = await sb
    .from("mail_thread_files")
    .insert(payload)
    .select(
      "id, thread_email, file_name, mime_type, byte_size, storage_path, uploaded_by_email, uploaded_by_name, created_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return mapFile(data as Record<string, unknown>);
}

export async function deleteThreadFile(id: string): Promise<void> {
  if (missingSupabaseEnv().length) return;
  const sb = getSupabase();
  const { data } = await sb
    .from("mail_thread_files")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  const path = data?.storage_path as string | undefined;
  if (path) {
    await sb.storage.from("mail-attachments").remove([path]).catch(() => undefined);
  }
  const { error } = await sb.from("mail_thread_files").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function readThreadFileBytes(
  id: string,
): Promise<{ fileName: string; mimeType: string; bytes: Buffer } | null> {
  if (missingSupabaseEnv().length) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("mail_thread_files")
    .select("file_name, mime_type, storage_path, file_data")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const fileName = String(data.file_name ?? "file");
  const mimeType = String(data.mime_type ?? "application/octet-stream");
  if (data.storage_path) {
    const { data: blob, error: dlErr } = await sb.storage
      .from("mail-attachments")
      .download(String(data.storage_path));
    if (dlErr || !blob) return null;
    const buf = Buffer.from(await blob.arrayBuffer());
    return { fileName, mimeType, bytes: buf };
  }
  if (data.file_data) {
    const raw = data.file_data as string | Uint8Array;
    const bytes =
      typeof raw === "string"
        ? Buffer.from(raw.replace(/^\\x/, ""), "hex")
        : Buffer.from(raw);
    return { fileName, mimeType, bytes };
  }
  return null;
}
