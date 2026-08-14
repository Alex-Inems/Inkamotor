import { jsonError } from "@/lib/api";
import { missingSupabaseEnv } from "@/lib/supabase/server";
import { applyCrmMutation, loadCrmSnapshot, type CrmMutation } from "@/lib/crm/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = missingSupabaseEnv();
  if (missing.length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing,
    });
  }
  try {
    const data = await loadCrmSnapshot();
    return Response.json(data);
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not load CRM data",
      code: "db_error",
    });
  }
}

export async function POST(request: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing,
    });
  }

  let body: CrmMutation;
  try {
    body = (await request.json()) as CrmMutation;
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "db_error" });
  }

  if (!body || typeof body !== "object" || !("op" in body)) {
    return jsonError(400, { error: "Missing mutation op", code: "db_error" });
  }

  try {
    const data = await applyCrmMutation(body);
    return Response.json(data);
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Mutation failed",
      code: "db_error",
    });
  }
}
