import { jsonError } from "@/lib/api";
import { COMPOSE_MAX_FILE_BYTES } from "@/lib/mail/compose-attachments";
import { isMissingColumnError } from "@/lib/mail/schema-compat";
import { deleteStagedFiles, saveStagedFile } from "@/lib/mail/staged-files";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STAGE_MAX_FILE_BYTES = 15 * 1024 * 1024;
const CHUNK_MAX_BYTES = COMPOSE_MAX_FILE_BYTES;

function isMissingTable(message: string) {
  return /relation .* does not exist|could not find the table/i.test(message);
}

function chunkFileName(uploadId: string, index: number, total: number) {
  return `chunk:${uploadId}:${index}:${total}`;
}

/**
 * Upload one attachment (or one chunk of a larger file) before sending the reply.
 * Keeps each HTTP body under the platform ~4.5 MB limit.
 */
export async function POST(request: Request) {
  if (missingSupabaseEnv().length > 0) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing: missingSupabaseEnv(),
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, { error: "Invalid upload", code: "send_failed" });
  }

  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return jsonError(400, { error: "Missing file", code: "send_failed" });
  }
  if (file.size > CHUNK_MAX_BYTES) {
    return jsonError(400, {
      error: `Each upload piece must be under ${Math.round(CHUNK_MAX_BYTES / (1024 * 1024))} MB`,
      code: "send_failed",
    });
  }

  const uploadId = String(form.get("uploadId") ?? "").trim();
  const chunkIndex = Number(form.get("chunkIndex") ?? "0");
  const chunkTotal = Number(form.get("chunkTotal") ?? "1");
  const fileName =
    String(form.get("fileName") ?? "").trim() || file.name || "attachment";
  const mimeType =
    String(form.get("mimeType") ?? "").trim() ||
    file.type ||
    "application/octet-stream";
  const bytes = Buffer.from(await file.arrayBuffer());

  // Whole file in one request.
  if (!uploadId || chunkTotal <= 1) {
    if (bytes.length > STAGE_MAX_FILE_BYTES) {
      return jsonError(400, {
        error: "File is too large (max 15 MB)",
        code: "send_failed",
      });
    }
    const saved = await saveStagedFile({ fileName, mimeType, bytes });
    if ("error" in saved) {
      return jsonError(502, { error: saved.error, code: "send_failed" });
    }
    return Response.json({ ok: true, id: saved.id, byteSize: bytes.length });
  }

  if (
    !Number.isFinite(chunkIndex) ||
    !Number.isFinite(chunkTotal) ||
    chunkTotal < 2 ||
    chunkIndex < 0 ||
    chunkIndex >= chunkTotal
  ) {
    return jsonError(400, {
      error: "Invalid chunk metadata",
      code: "send_failed",
    });
  }

  const savedChunk = await saveStagedFile({
    fileName: chunkFileName(uploadId, chunkIndex, chunkTotal),
    mimeType: "application/octet-stream",
    bytes,
  });
  if ("error" in savedChunk) {
    return jsonError(502, { error: savedChunk.error, code: "send_failed" });
  }

  if (chunkIndex < chunkTotal - 1) {
    return Response.json({ ok: true, complete: false, chunkId: savedChunk.id });
  }

  const prefix = `chunk:${uploadId}:`;
  const { data: chunkRows, error: listError } = await getSupabase()
    .from("mail_staged_files")
    .select("id, file_name")
    .like("file_name", `${prefix}%`);

  if (listError) {
    if (isMissingTable(listError.message) || isMissingColumnError(listError)) {
      return jsonError(502, {
        error:
          "Run supabase/mail_staged_files.sql in Supabase to enable large attachments.",
        code: "send_failed",
      });
    }
    return jsonError(502, { error: listError.message, code: "send_failed" });
  }

  const idByIndex = new Map<number, string>();
  for (const row of chunkRows ?? []) {
    const name = String(row.file_name);
    const parts = name.split(":");
    // chunk : uploadId : index : total
    if (parts.length < 4 || parts[0] !== "chunk") continue;
    const idx = Number(parts[parts.length - 2]);
    const total = Number(parts[parts.length - 1]);
    if (total !== chunkTotal || !Number.isFinite(idx)) continue;
    idByIndex.set(idx, String(row.id));
  }

  const chunkIds = [...idByIndex.values()];
  const { loadStagedFiles } = await import("@/lib/mail/staged-files");
  const loaded = await loadStagedFiles(chunkIds);
  const byId = new Map(loaded.map((file) => [file.id, file]));

  const assembledParts: Buffer[] = [];
  let totalBytes = 0;
  for (let i = 0; i < chunkTotal; i++) {
    const id = idByIndex.get(i);
    const file = id ? byId.get(id) : undefined;
    if (!file) {
      return jsonError(502, {
        error: "Missing upload chunks — try again",
        code: "send_failed",
      });
    }
    const part = Buffer.from(file.base64, "base64");
    totalBytes += part.length;
    if (totalBytes > STAGE_MAX_FILE_BYTES) {
      await deleteStagedFiles(chunkIds);
      return jsonError(400, {
        error: "File is too large (max 15 MB)",
        code: "send_failed",
      });
    }
    assembledParts.push(part);
  }

  const assembled = Buffer.concat(assembledParts);
  const saved = await saveStagedFile({ fileName, mimeType, bytes: assembled });
  await deleteStagedFiles(chunkIds);

  if ("error" in saved) {
    return jsonError(502, { error: saved.error, code: "send_failed" });
  }

  return Response.json({
    ok: true,
    id: saved.id,
    byteSize: assembled.length,
    complete: true,
  });
}
