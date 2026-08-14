import { jsonError } from "@/lib/api";
import { listMailReplies } from "@/lib/mail/replies";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add Supabase env, then run supabase/schema.sql (includes mail_replies).",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const replies = await listMailReplies();
    return Response.json({ replies });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load sent replies";
    return jsonError(500, {
      error: `${message}. If mail_replies is missing, run the SQL in supabase/schema.sql.`,
      code: "db_error",
    });
  }
}
