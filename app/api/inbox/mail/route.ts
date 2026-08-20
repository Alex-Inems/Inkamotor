import { jsonError } from "@/lib/api";
import { localeFromRequest } from "@/lib/i18n/request-locale";
import { listMailMessages, missingImapEnv, syncImapInbox } from "@/lib/mail/imap";
import { translateMailList } from "@/lib/mail/translate-mailbox";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run supabase/schema.sql.",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const locale = localeFromRequest(req);
    const messages = await listMailMessages();
    const localized = await translateMailList(messages, locale);
    return Response.json({
      messages: localized.messages,
      locale,
      translation: localized.stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load mail";
    return jsonError(500, {
      error: `${message}. If tables are missing, run supabase/schema.sql.`,
      code: "db_error",
    });
  }
}

export async function POST(req: Request) {
  const missing = [...missingSupabaseEnv(), ...missingImapEnv()];
  if (missing.length > 0) {
    return jsonError(503, {
      error:
        "Inbox isn’t connected yet. Ask your admin to finish mail setup.",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const locale = localeFromRequest(req);
    const result = await syncImapInbox();
    const messages = await listMailMessages();
    const localized = await translateMailList(messages, locale);
    return Response.json({
      ...result,
      messages: localized.messages,
      locale,
      translation: localized.stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "IMAP sync failed";
    return jsonError(502, { error: message, code: "sync_failed" });
  }
}
