import { jsonError } from "@/lib/api";
import { missingOdooEnv } from "@/lib/odoo/client";
import { importOdooClientMessages } from "@/lib/odoo/import-messages";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Pull Odoo chatter/email history for CRM contacts into mail_messages. */
export async function POST(req: Request) {
  const missing = [...missingSupabaseEnv(), ...missingOdooEnv()];
  if (missing.length > 0) {
    return jsonError(503, {
      error:
        "Add ODOO_URL, ODOO_DB, and ODOO_API_KEY to .env.local (Odoo 19 JSON-2 API).",
      code: "missing_credentials",
      missing,
    });
  }

  let body: { email?: string; limitPartners?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body is fine */
  }

  try {
    const stats = await importOdooClientMessages({
      emails: body.email?.trim() ? [body.email.trim()] : undefined,
      limitPartners: body.limitPartners,
    });
    return Response.json({ ok: true, ...stats });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Odoo message sync failed",
      code: "sync_failed",
    });
  }
}
