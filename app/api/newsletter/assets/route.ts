import { createHash } from "node:crypto";
import { jsonError } from "@/lib/api";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUCKET = "mailing-assets";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

function extFor(type: string, name: string) {
  if (type.includes("png")) return ".png";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  if (type.includes("gif")) return ".gif";
  if (type.includes("webp")) return ".webp";
  if (type.includes("svg")) return ".svg";
  const m = name.toLowerCase().match(/\.(png|jpe?g|gif|webp|svg)$/);
  return m ? `.${m[1]!.replace("jpeg", "jpg")}` : ".bin";
}

async function ensureBucket() {
  const sb = getSupabase();
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(error.message);
    }
  }
}

export async function POST(req: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length) {
    return jsonError(503, {
      error: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      code: "missing_credentials",
      missing,
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, { error: "Expected multipart form data", code: "send_failed" });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, { error: "file is required", code: "send_failed" });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return jsonError(400, {
      error: "Image must be between 1 byte and 8 MB",
      code: "send_failed",
    });
  }
  const type = (file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED.has(type)) {
    return jsonError(400, {
      error: "Use a PNG, JPG, GIF, WebP, or SVG image",
      code: "send_failed",
    });
  }

  try {
    await ensureBucket();
    const buf = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha1").update(buf).digest("hex").slice(0, 20);
    const path = `uploads/${hash}${extFor(type, file.name || "")}`;
    const sb = getSupabase();
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType: type,
      upsert: true,
    });
    if (error) throw new Error(error.message);
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return Response.json({
      ok: true,
      url: data.publicUrl,
      path,
      bytes: buf.length,
      contentType: type,
    });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Upload failed",
      code: "send_failed",
    });
  }
}
