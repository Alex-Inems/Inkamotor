import { jsonError } from "@/lib/api";
import {
  addContactToList,
  listBrevoContacts,
  mapBrevoContact,
  missingBrevoEnv,
  subscriberListId,
} from "@/lib/brevo";
import { autoSubscribeEnabled } from "@/lib/mail/auto-subscribe";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = missingBrevoEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Email sending isn’t configured yet.",
      code: "missing_credentials",
      missing,
    });
  }

  if (subscriberListId() === null) {
    return jsonError(503, {
      error: "Set BREVO_LIST_ID to load the subscriber list.",
      code: "missing_credentials",
      missing: ["BREVO_LIST_ID"],
    });
  }

  try {
    const { contacts, total } = await listBrevoContacts();
    return Response.json({
      subscribers: contacts.map(mapBrevoContact),
      total,
      autoSubscribe: autoSubscribeEnabled(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load subscribers";
    return jsonError(502, { error: message, code: "sync_failed" });
  }
}

export async function POST(request: Request) {
  const missing = missingBrevoEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Email sending isn’t configured yet.",
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
    await addContactToList({ email, name: body.name, source: "manual" });
    return Response.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not add subscriber";
    return jsonError(502, { error: message, code: "send_failed" });
  }
}
