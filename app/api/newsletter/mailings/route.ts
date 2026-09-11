import { jsonError } from "@/lib/api";
import {
  deleteMailing,
  getMailing,
  listMailings,
  seedBuiltinMailingDraftsIfEmpty,
  upsertMailing,
  type MailingStatus,
  type MailingWrite,
} from "@/lib/newsletter/mailings";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function blocked() {
  const missing = missingSupabaseEnv();
  if (!missing.length) return null;
  return jsonError(503, {
    error: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    code: "missing_credentials",
    missing,
  });
}

export async function GET(req: Request) {
  const fail = blocked();
  if (fail) return fail;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const seed = url.searchParams.get("seed") === "1";

  try {
    if (id) {
      const mailing = await getMailing(id);
      if (!mailing) {
        return jsonError(404, { error: "Mailing not found", code: "db_error" });
      }
      return Response.json({ mailing });
    }
    let mailings = await listMailings();
    if (seed && mailings.length === 0) {
      mailings = await seedBuiltinMailingDraftsIfEmpty();
    }
    return Response.json({ mailings });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not load mailings",
      code: "db_error",
    });
  }
}

export async function POST(req: Request) {
  const fail = blocked();
  if (fail) return fail;

  let body: MailingWrite & { id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "send_failed" });
  }

  if (!body.subject?.trim() && !body.html?.trim() && !body.name?.trim()) {
    return jsonError(400, {
      error: "Name, subject, or body is required",
      code: "send_failed",
    });
  }

  try {
    const mailing = await upsertMailing(
      {
        name: body.name || body.subject || "Untitled mailing",
        subject: body.subject || "",
        preview: body.preview,
        html: body.html || "",
        status: body.status,
        recipientTag: body.recipientTag,
        emails: body.emails,
        scheduledAt: body.scheduledAt,
        responsible: body.responsible,
        templateId: body.templateId,
      },
      body.id,
    );
    return Response.json({ ok: true, mailing });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not save mailing",
      code: "send_failed",
    });
  }
}

export async function PATCH(req: Request) {
  const fail = blocked();
  if (fail) return fail;

  let body: Partial<MailingWrite> & { id?: string; status?: MailingStatus };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "send_failed" });
  }

  const id = body.id?.trim();
  if (!id) {
    return jsonError(400, { error: "id is required", code: "send_failed" });
  }

  try {
    const prev = await getMailing(id);
    if (!prev) {
      return jsonError(404, { error: "Mailing not found", code: "db_error" });
    }
    const mailing = await upsertMailing(
      {
        name: body.name ?? prev.name,
        subject: body.subject ?? prev.subject,
        preview: body.preview ?? prev.preview,
        html: body.html ?? prev.html,
        status: body.status ?? prev.status,
        recipientTag:
          body.recipientTag !== undefined ? body.recipientTag : prev.recipientTag,
        emails: body.emails ?? prev.emails,
        scheduledAt:
          body.scheduledAt !== undefined ? body.scheduledAt : prev.scheduledAt,
        responsible: body.responsible ?? prev.responsible,
        templateId:
          body.templateId !== undefined ? body.templateId : prev.templateId,
      },
      id,
    );
    return Response.json({ ok: true, mailing });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not update mailing",
      code: "send_failed",
    });
  }
}

export async function DELETE(req: Request) {
  const fail = blocked();
  if (fail) return fail;

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return jsonError(400, { error: "id is required", code: "send_failed" });
  }

  try {
    await deleteMailing(id);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not delete mailing",
      code: "send_failed",
    });
  }
}
