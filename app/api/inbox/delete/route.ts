import { jsonError } from "@/lib/api";
import {
  deleteInboxConversation,
  deleteInboxMessage,
} from "@/lib/mail/delete-mail";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body =
  | { action: "message"; key: string }
  | { action: "conversation"; email: string };

export async function POST(request: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing,
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, { error: "Invalid JSON body", code: "send_failed" });
  }

  try {
    if (body.action === "message") {
      const key = body.key?.trim();
      if (!key) {
        return jsonError(400, { error: "Message key is required", code: "send_failed" });
      }
      await deleteInboxMessage(key);
      return Response.json({ ok: true });
    }

    if (body.action === "conversation") {
      const email = body.email?.trim();
      if (!email) {
        return jsonError(400, { error: "Email is required", code: "send_failed" });
      }
      await deleteInboxConversation(email);
      return Response.json({ ok: true });
    }

    return jsonError(400, { error: "Unknown action", code: "send_failed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete";
    return jsonError(500, { error: message, code: "db_error" });
  }
}
