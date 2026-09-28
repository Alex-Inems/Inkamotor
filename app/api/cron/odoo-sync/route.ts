import { jsonError } from "@/lib/api";
import { missingOdooSessionEnv } from "@/lib/odoo/session";
import { syncOdooAll } from "@/lib/odoo/sync-all";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/** Hourly Odoo → CRM sync (sales, contacts, recent messages). */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return jsonError(401, { error: "Unauthorized", code: "unauthorized" });
  }

  const missing = [...missingSupabaseEnv(), ...missingOdooSessionEnv()];
  if (missing.length > 0) {
    return jsonError(503, {
      error:
        "Add ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_PASSWORD (and Supabase) for hourly sync.",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const stats = await syncOdooAll({ days: 3 });
    return Response.json({ ok: true, ...stats });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Odoo sync failed",
      code: "sync_failed",
    });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
