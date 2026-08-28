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

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.meta.mimeType,
      "Content-Length": String(file.data.length),
      "Content-Disposition": `${
        download ? "attachment" : "inline"
      }; filename="${safeName}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
