import { jsonError } from "@/lib/api";
import {
  listDbSubscribers,
  setDbSubscriberBlocked,
  upsertDbSubscriber,
} from "@/lib/crm/subscribers";
import { autoSubscribeEnabled } from "@/lib/mail/auto-subscribe";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to load subscribers.",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const subscribers = await listDbSubscribers();
    return Response.json({
      subscribers,
      total: subscribers.length,
      autoSubscribe: autoSubscribeEnabled(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load subscribers";
    return jsonError(502, { error: message, code: "sync_failed" });
  }
}

export async function POST(request: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to add subscribers.",
      code: "missing_credentials",
      missing,
    });
  }

  let body: { email?: string; name?: string };
  try {
    body = (await request.json()) as { email?: string; name?: string };
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "send_failed" });
  }

  const email = body.email?.trim();
  if (!email) {
    return jsonError(400, { error: "Email is required", code: "send_failed" });
  }

  try {
    await upsertDbSubscriber({ email, name: body.name, source: "manual" });
    return Response.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not add subscriber";
    return jsonError(502, { error: message, code: "send_failed" });
  }
}

export async function PATCH(request: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to update subscribers.",
      code: "missing_credentials",
      missing,
    });
  }

  let body: { email?: string; blocked?: boolean };
  try {
    body = (await request.json()) as { email?: string; blocked?: boolean };
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "send_failed" });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || typeof body.blocked !== "boolean") {
    return jsonError(400, {
      error: "email and blocked are required",
      code: "send_failed",
    });
  }

  try {
    await setDbSubscriberBlocked(email, body.blocked);
    return Response.json({ ok: true, email, blocked: body.blocked });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not update subscriber";
    return jsonError(502, { error: message, code: "send_failed" });
  }
}
