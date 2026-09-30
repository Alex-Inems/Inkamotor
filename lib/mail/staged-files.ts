import { encodeByteaHex, decodeBytea } from "@/lib/mail/bytea";
import { isMissingColumnError } from "@/lib/mail/schema-compat";
import { supabaseHttps } from "@/lib/supabase/https";
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

function safeStorageName(name: string) {
  return name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120) || "file.bin";
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

async function ensureBucket() {
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
    /* create below */
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
        file_size_limit: 15 * 1024 * 1024,
      }),
    });
  } catch {
    /* upload may still work if bucket already exists */
  }
}

async function uploadToStorage(
  storagePath: string,
  bytes: Buffer,
  mimeType: string,
): Promise<{ ok: true } | { error: string }> {
  const baseUrl = supabaseBaseUrl();
  if (!baseUrl) return { error: "Supabase is not configured" };

  await ensureBucket();
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
    if (uploaded.status >= 400) {
      return {
        error: `Storage upload failed (${uploaded.status}): ${uploaded.text.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Storage upload failed",
    };
  }
}

async function downloadFromStorage(storagePath: string): Promise<Buffer | null> {
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

  const uploaded = await uploadToStorage(
    storagePath,
    input.bytes,
    input.mimeType,
  );
  if ("ok" in uploaded) {
    const { error } = await sb.from("mail_staged_files").insert({
      id,
      file_name: input.fileName,
      mime_type: input.mimeType || "application/octet-stream",
      storage_path: storagePath,
      byte_size: input.bytes.length,
    });
    if (!error) return { id };
    if (isMissingTable(error.message)) {
      return {
        error:
          "Run supabase/mail_staged_files.sql in Supabase to enable large attachments.",
      };
    }
    // Older table without storage_path — fall through to bytea.
    if (!isMissingColumnError(error)) {
      // Storage object exists; still try bytea metadata as last resort below.
    }
  }

  // Always fall back to bytea when storage is unavailable.
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
    return {
      error:
        ("error" in uploaded ? uploaded.error : null) ||
        error.message,
    };
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
      const buffer = await downloadFromStorage(storagePath);
      if (!buffer?.length) {
        // Fall back to bytea column if present.
        const fromBytea = decodeBytea(row.file_data);
        if (!fromBytea?.length) continue;
        out.push({
          id: String(row.id),
          fileName: String(row.file_name),
          mimeType: String(row.mime_type ?? "application/octet-stream"),
          byteSize: Number(row.byte_size ?? fromBytea.length),
          base64: fromBytea.toString("base64"),
        });
        continue;
      }
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
    await sb.storage.from(BUCKET).remove(paths).catch(() => undefined);
  }

  for (const id of unique) {
    const { data: listed } = await sb.storage.from(BUCKET).list(id);
    if (listed?.length) {
      await sb.storage
        .from(BUCKET)
        .remove(listed.map((f) => `${id}/${f.name}`))
        .catch(() => undefined);
    }
  }

  await sb.from("mail_staged_files").delete().in("id", unique);
}
