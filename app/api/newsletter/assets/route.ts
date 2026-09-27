import { createHash } from "node:crypto";
import { jsonError } from "@/lib/api";
import { missingSupabaseEnv } from "@/lib/supabase/server";
import {
  supabaseHttps,
  supabasePublicObjectUrl,
} from "@/lib/supabase/https";

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

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
  };
}

async function ensureBucket(baseUrl: string) {
  const list = await supabaseHttps({
    url: `${baseUrl}/storage/v1/bucket`,
    method: "GET",
    headers: { ...authHeaders(), Accept: "application/json" },
  });
  if (list.status >= 400) {
    throw new Error(`Could not list storage buckets (${list.status}): ${list.text.slice(0, 200)}`);
  }
  let buckets: { name?: string }[] = [];
  try {
    buckets = JSON.parse(list.text) as { name?: string }[];
  } catch {
    throw new Error("Could not parse storage bucket list");
  }
  if (buckets.some((b) => b.name === BUCKET)) return;

  const created = await supabaseHttps({
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
      public: true,
      file_size_limit: MAX_BYTES,
    }),
  });
  if (
    created.status >= 400 &&
    !/already exists|duplicate/i.test(created.text)
  ) {
    throw new Error(
      `Could not create ${BUCKET} bucket (${created.status}): ${created.text.slice(0, 240)}`,
    );
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

  const baseUrl = process.env.SUPABASE_URL!.trim().replace(/\/$/, "");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, {
      error: "Expected multipart form data",
      code: "send_failed",
    });
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
    await ensureBucket(baseUrl);
    const buf = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha1").update(buf).digest("hex").slice(0, 20);
    const path = `uploads/${hash}${extFor(type, file.name || "")}`;

    const uploaded = await supabaseHttps({
      url: `${baseUrl}/storage/v1/object/${BUCKET}/${path}`,
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": type,
        "x-upsert": "true",
      },
      body: buf,
    });
    if (uploaded.status >= 400) {
      throw new Error(
        `Upload failed (${uploaded.status}): ${uploaded.text.slice(0, 240)}`,
      );
    }

    return Response.json({
      ok: true,
      url: supabasePublicObjectUrl(baseUrl, BUCKET, path),
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
