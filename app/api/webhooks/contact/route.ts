import { jsonError } from "@/lib/api";
import { insertSiteInquiry } from "@/lib/crm/repository";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Public Webflow/contact webhook. Header: x-webhook-secret = WEBHOOK_SECRET */
export async function POST(request: Request) {
  const expected = process.env.WEBHOOK_SECRET?.trim();
  if (!expected) {
    return jsonError(503, {
      error: "Set WEBHOOK_SECRET to accept form submissions",
      code: "missing_credentials",
      missing: ["WEBHOOK_SECRET"],
    });
  }

  const provided =
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missing = missingSupabaseEnv();
  if (missing.length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing,
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "db_error" });
  }

  const first = String(body.firstName ?? body.prenom ?? body.Prénom ?? "").trim();
  const last = String(body.lastName ?? body.nom ?? body.Nom ?? "").trim();
  const name =
    String(body.name ?? body.Name ?? "").trim() ||
    [first, last].filter(Boolean).join(" ").trim();
  const email = String(body.email ?? body.Email ?? "").trim();
  if (!name || !email) {
    return jsonError(400, {
      error: "name and email are required",
      code: "db_error",
    });
  }

  try {
    const id = await insertSiteInquiry({
      name,
      email,
      subject: String(body.subject ?? body.Sujet ?? "Website inquiry"),
      message: String(body.message ?? body.Message ?? body.phone ?? body.Telephone ?? ""),
      page: String(body.page ?? body.path ?? "/"),
      channel: "contact_form",
    });
    return Response.json({ ok: true, id });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not save inquiry",
      code: "db_error",
    });
  }
}
