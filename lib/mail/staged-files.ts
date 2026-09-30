import { encodeByteaHex, decodeBytea } from "@/lib/mail/bytea";
import { isMissingColumnError } from "@/lib/mail/schema-compat";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export type StagedFile = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  base64: string;
};

const BUCKET = "mail-staging";

function isMissingTable(message: string) {
  return /relation .* does not exist|could not find the table/i.test(message);
}

function isMissingBucket(message: string) {
  return /bucket|not found|row-level security/i.test(message);
}

function safeStorageName(name: string) {
  return name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120) || "file.bin";
}

async function ensureBucket() {
  const sb = getSupabase();
  const { data } = await sb.storage.listBuckets();
  if (data?.some((b) => b.name === BUCKET || b.id === BUCKET)) return;
  await sb.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 15 * 1024 * 1024,
  });
}

export async function saveStagedFile(input: {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<{ id: string } | { error: string }> {
  if (missingSupabaseEnv().length > 0) {
    return { error: "Supabase is not configured" };
  }
  if (!input.bytes.length) return { error: "Empty file" };

  const sb = getSupabase();
  const id = crypto.randomUUID();
  const storagePath = `${id}/${safeStorageName(input.fileName)}`;

  try {
    await ensureBucket();
    const { error: upError } = await sb.storage.from(BUCKET).upload(
      storagePath,
      input.bytes,
      {
        contentType: input.mimeType || "application/octet-stream",
        upsert: true,
      },
    );
    if (upError) {
      // Fall back to bytea if storage bucket is not available.
      if (!isMissingBucket(upError.message)) {
        return { error: upError.message };
      }
    } else {
      const { error } = await sb.from("mail_staged_files").insert({
        id,
        file_name: input.fileName,
        mime_type: input.mimeType || "application/octet-stream",
        storage_path: storagePath,
        byte_size: input.bytes.length,
      });
      if (error) {
        if (isMissingTable(error.message)) {
          return {
            error:
              "Run supabase/mail_staged_files.sql in Supabase to enable large attachments.",
          };
        }
        // Older table without storage_path — still keep the storage object and
        // fall through to bytea metadata insert.
        if (!isMissingColumnError(error)) {
          return { error: error.message };
        }
      } else {
        return { id };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    if (!isMissingBucket(message)) {
      /* try bytea below */
    }
  }

  const { data, error } = await sb
    .from("mail_staged_files")
    .insert({
      file_name: input.fileName,
      mime_type: input.mimeType || "application/octet-stream",
      file_data: encodeByteaHex(input.bytes),
      byte_size: input.bytes.length,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error.message) || isMissingColumnError(error)) {
      return {
        error:
          "Run supabase/mail_staged_files.sql in Supabase to enable large attachments.",
      };
    }
    return { error: error.message };
  }
  return { id: String(data.id) };
}

export async function loadStagedFiles(ids: string[]): Promise<StagedFile[]> {
  if (!ids.length || missingSupabaseEnv().length > 0) return [];
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return [];

  const sb = getSupabase();
  const { data, error } = await sb
    .from("mail_staged_files")
    .select("id, file_name, mime_type, byte_size, file_data, storage_path")
    .in("id", unique);

  if (error || !data) {
    // Retry without storage_path for older schemas.
    const retry = await sb
      .from("mail_staged_files")
      .select("id, file_name, mime_type, byte_size, file_data")
      .in("id", unique);
    if (retry.error || !retry.data) return [];
    return mapByteaRows(retry.data as Record<string, unknown>[]);
  }

  const out: StagedFile[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const storagePath =
      typeof row.storage_path === "string" ? row.storage_path.trim() : "";
    if (storagePath) {
      const { data: blob, error: dlError } = await sb.storage
        .from(BUCKET)
        .download(storagePath);
      if (dlError || !blob) continue;
      const buffer = Buffer.from(await blob.arrayBuffer());
      if (!buffer.length) continue;
      out.push({
        id: String(row.id),
        fileName: String(row.file_name),
        mimeType: String(row.mime_type ?? "application/octet-stream"),
        byteSize: Number(row.byte_size ?? buffer.length),
        base64: buffer.toString("base64"),
      });
      continue;
    }
    const buffer = decodeBytea(row.file_data);
    if (!buffer?.length) continue;
    out.push({
      id: String(row.id),
      fileName: String(row.file_name),
      mimeType: String(row.mime_type ?? "application/octet-stream"),
      byteSize: Number(row.byte_size ?? buffer.length),
      base64: buffer.toString("base64"),
    });
  }
  return out;
}

function mapByteaRows(rows: Record<string, unknown>[]): StagedFile[] {
  const out: StagedFile[] = [];
  for (const row of rows) {
    const buffer = decodeBytea(row.file_data);
    if (!buffer?.length) continue;
    out.push({
      id: String(row.id),
      fileName: String(row.file_name),
      mimeType: String(row.mime_type ?? "application/octet-stream"),
      byteSize: Number(row.byte_size ?? buffer.length),
      base64: buffer.toString("base64"),
    });
  }
  return out;
}

export async function deleteStagedFiles(ids: string[]) {
  if (!ids.length || missingSupabaseEnv().length > 0) return;
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return;

  const sb = getSupabase();
  const { data } = await sb
    .from("mail_staged_files")
    .select("id, storage_path")
    .in("id", unique);

  const paths = (data ?? [])
    .map((row) =>
      typeof (row as { storage_path?: string }).storage_path === "string"
        ? (row as { storage_path: string }).storage_path.trim()
        : "",
    )
    .filter(Boolean);

  if (paths.length) {
    await sb.storage.from(BUCKET).remove(paths);
  }

  // Also remove any leftover chunk objects for these ids.
  for (const id of unique) {
    const { data: listed } = await sb.storage.from(BUCKET).list(id);
    if (listed?.length) {
      await sb.storage
        .from(BUCKET)
        .remove(listed.map((f) => `${id}/${f.name}`));
    }
  }

  await sb.from("mail_staged_files").delete().in("id", unique);
}
