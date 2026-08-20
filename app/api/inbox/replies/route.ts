import { jsonError } from "@/lib/api";
import { localeFromRequest } from "@/lib/i18n/request-locale";
import { listMailReplies } from "@/lib/mail/replies";
import { translateReplyList } from "@/lib/mail/translate-mailbox";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add Supabase env, then run supabase/schema.sql (includes mail_replies).",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const locale = localeFromRequest(req);
    const replies = await listMailReplies();
    const localized = await translateReplyList(replies, locale);
    return Response.json({
      replies: localized.replies,
      locale,
      translation: localized.stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load sent replies";
    return jsonError(500, {
      error: `${message}. If mail_replies is missing, run the SQL in supabase/schema.sql.`,
      code: "db_error",
    });
  }
}
