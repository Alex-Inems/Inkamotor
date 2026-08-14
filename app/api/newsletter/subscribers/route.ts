import { jsonError } from "@/lib/api";
import {
  listBrevoSubscribers,
  missingBrevoEnv,
  upsertSubscriber,
} from "@/lib/brevo";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = [
    ...missingBrevoEnv(),
    ...(process.env.BREVO_LIST_ID?.trim() ? [] : ["BREVO_LIST_ID"]),
  ];
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Email list isn’t connected yet. Ask your admin to finish setup.",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const data = await listBrevoSubscribers(100, 0);
    return Response.json({
      subscribers: data.contacts,
      total: data.total,
      listId: data.listId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load subscribers";
    return jsonError(502, { error: message, code: "sync_failed" });
  }
}

/** Manually add a subscriber to the list. */
export async function POST(request: Request) {
  const missing = [
    ...missingBrevoEnv(),
    ...(process.env.BREVO_LIST_ID?.trim() ? [] : ["BREVO_LIST_ID"]),
  ];
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Email list isn’t connected yet.",
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
    const result = await upsertSubscriber({
      email,
      name: body.name,
      source: "manual",
    });
    if (result.skipped) {
      return jsonError(400, {
        error: "That address can’t be added to the list",
        code: "send_failed",
      });
    }
    return Response.json({ ok: true, email: result.email });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not add subscriber",
      code: "send_failed",
    });
  }
}
