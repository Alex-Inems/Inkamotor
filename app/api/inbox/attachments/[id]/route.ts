import { jsonError } from "@/lib/api";
import { getReplyAttachmentFile } from "@/lib/mail/attachments";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing,
    });
  }

  const { id } = await params;
  const file = await getReplyAttachmentFile(id);
  if (!file) {
    return jsonError(404, { error: "Attachment not found", code: "send_failed" });
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const safeName = file.meta.fileName.replace(/[^\w.\-()+ ]/g, "_");
  const body = new Uint8Array(file.data);
  const lowerName = file.meta.fileName.toLowerCase();
  const storedMime = (file.meta.mimeType || "").trim().toLowerCase();
  // Force a previewable type when the filename is clearly a PDF/image — some
  // uploads land as octet-stream and browsers then refuse inline preview.
  let contentType = storedMime || "application/octet-stream";
  if (lowerName.endsWith(".pdf") && !contentType.includes("pdf")) {
    contentType = "application/pdf";
  } else if (
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName) &&
    !contentType.startsWith("image/")
  ) {
    const ext = lowerName.slice(lowerName.lastIndexOf(".") + 1);
    contentType =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "svg"
          ? "image/svg+xml"
          : `image/${ext}`;
  } else if (
    (!contentType || contentType === "application/octet-stream") &&
    lowerName.endsWith(".pdf")
  ) {
    contentType = "application/pdf";
  }

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `${
        download ? "attachment" : "inline"
      }; filename="${safeName}"`,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      Accept: "*/*",
    },
  });
}
