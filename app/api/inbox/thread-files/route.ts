import { jsonError } from "@/lib/api";
import { actorFromClaims } from "@/lib/auth-actor";
import { getSessionClaims } from "@/lib/auth-request";
import {
  deleteThreadFile,
  listThreadFiles,
  readThreadFileBytes,
  saveThreadFile,
} from "@/lib/mail/thread-files";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const downloadId = url.searchParams.get("download")?.trim();
  if (downloadId) {
    const file = await readThreadFileBytes(downloadId);
    if (!file) {
      return jsonError(404, { error: "File not found", code: "bad_request" });
    }
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
      },
    });
  }

  if (missingSupabaseEnv().length) {
    return Response.json({ ok: true, files: [] });
  }
  const email = url.searchParams.get("email")?.trim() || "";
  if (!email) {
    return jsonError(400, { error: "email required", code: "bad_request" });
  }
  try {
    const files = await listThreadFiles(email);
    return Response.json({ ok: true, files });
  } catch (err) {
    return jsonError(500, {
      error: err instanceof Error ? err.message : "Could not load files",
      code: "db_error",
    });
  }
}

export async function POST(request: Request) {
  if (missingSupabaseEnv().length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
    });
  }
  const contentType = request.headers.get("content-type") || "";
  try {
    let threadEmail = "";
    let fileName = "";
    let mimeType = "application/octet-stream";
    let base64 = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      threadEmail = String(form.get("threadEmail") ?? "");
      const file = form.get("file");
      if (!(file instanceof File)) {
        return jsonError(400, { error: "file required", code: "bad_request" });
      }
      fileName = file.name;
      mimeType = file.type || "application/octet-stream";
      const buf = Buffer.from(await file.arrayBuffer());
      base64 = buf.toString("base64");
    } else {
      const body = (await request.json()) as {
        threadEmail?: string;
        fileName?: string;
        mimeType?: string;
        base64?: string;
      };
      threadEmail = body.threadEmail ?? "";
      fileName = body.fileName ?? "";
      mimeType = body.mimeType || "application/octet-stream";
      base64 = body.base64 ?? "";
    }

    const file = await saveThreadFile({
      threadEmail,
      fileName,
      mimeType,
      base64,
      actor: actorFromClaims(await getSessionClaims()),
    });
    return Response.json({ ok: true, file });
  } catch (err) {
    return jsonError(400, {
      error: err instanceof Error ? err.message : "Could not upload file",
      code: "db_error",
    });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return jsonError(400, { error: "id required", code: "bad_request" });
  }
  try {
    await deleteThreadFile(id);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(400, {
      error: err instanceof Error ? err.message : "Could not delete file",
      code: "db_error",
    });
  }
}
