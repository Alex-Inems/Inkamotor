import { jsonError } from "@/lib/api";
import { actorFromClaims } from "@/lib/auth-actor";
import { getSessionClaims } from "@/lib/auth-request";
import {
  createMailNote,
  deleteMailNote,
  listMailNotes,
  updateMailNote,
} from "@/lib/mail/notes";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (missingSupabaseEnv().length) {
    return Response.json({ ok: true, notes: [] });
  }
  const email = new URL(request.url).searchParams.get("email")?.trim() || "";
  if (!email) {
    return jsonError(400, { error: "email required", code: "bad_request" });
  }
  try {
    const notes = await listMailNotes(email);
    return Response.json({ ok: true, notes });
  } catch (err) {
    return jsonError(500, {
      error: err instanceof Error ? err.message : "Could not load notes",
      code: "db_error",
    });
  }
}

export async function POST(request: Request) {
  if (missingSupabaseEnv().length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
    });
  }
  const body = (await request.json()) as {
    threadEmail?: string;
    bodyText?: string;
    bodyHtml?: string;
    relatedSaleId?: string;
  };
  try {
    const note = await createMailNote({
      threadEmail: body.threadEmail ?? "",
      bodyText: body.bodyText ?? "",
      bodyHtml: body.bodyHtml,
      relatedSaleId: body.relatedSaleId,
      actor: actorFromClaims(await getSessionClaims()),
    });
    return Response.json({ ok: true, note });
  } catch (err) {
    return jsonError(400, {
      error: err instanceof Error ? err.message : "Could not save note",
      code: "db_error",
    });
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    bodyText?: string;
    bodyHtml?: string;
  };
  if (!body.id || !body.bodyText?.trim()) {
    return jsonError(400, { error: "id and bodyText required", code: "bad_request" });
  }
  try {
    const note = await updateMailNote(body.id, body.bodyText, body.bodyHtml);
    return Response.json({ ok: true, note });
  } catch (err) {
    return jsonError(400, {
      error: err instanceof Error ? err.message : "Could not update note",
      code: "db_error",
    });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return jsonError(400, { error: "id required", code: "bad_request" });
  }
  try {
    await deleteMailNote(id);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(400, {
      error: err instanceof Error ? err.message : "Could not delete note",
      code: "db_error",
    });
  }
}
