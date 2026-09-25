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

  return new Response(body, {
    headers: {
      "Content-Type": file.meta.mimeType || "application/pdf",
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
