import { jsonError } from "@/lib/api";
import { updateMailReplyBody } from "@/lib/mail/replies";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Edit outbound reply body locally — does not re-send. */
export async function PATCH(request: Request) {
  if (missingSupabaseEnv().length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
    });
  }
  const body = (await request.json()) as {
    id?: string;
    bodyText?: string;
    bodyHtml?: string;
  };
  if (!body.id || body.bodyText == null) {
    return jsonError(400, {
      error: "id and bodyText required",
      code: "bad_request",
    });
  }
  try {
    const reply = await updateMailReplyBody(
      body.id,
      body.bodyText,
      body.bodyHtml,
    );
    return Response.json({ ok: true, reply });
  } catch (err) {
    return jsonError(400, {
      error: err instanceof Error ? err.message : "Could not edit message",
      code: "send_failed",
    });
  }
}
