import { jsonError } from "@/lib/api";
import { listMailMessages, missingImapEnv, syncImapInbox } from "@/lib/mail/imap";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run supabase/schema.sql.",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const messages = await listMailMessages();
    return Response.json({ messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load mail";
    return jsonError(500, {
      error: `${message}. If tables are missing, run supabase/schema.sql.`,
      code: "db_error",
    });
  }
}

export async function POST() {
  const missing = [...missingSupabaseEnv(), ...missingImapEnv()];
  if (missing.length > 0) {
    return jsonError(503, {
      error:
        "Add Supabase + IMAP (Namecheap) keys to .env.local, run schema.sql, then Sync inbox.",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const result = await syncImapInbox();
    const messages = await listMailMessages();
    return Response.json({ ...result, messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "IMAP sync failed";
    return jsonError(502, { error: message, code: "sync_failed" });
  }
}
