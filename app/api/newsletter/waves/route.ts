import { jsonError } from "@/lib/api";
import { missingBrevoEnv } from "@/lib/brevo";
import { listTomorrowPriorityEmails } from "@/lib/crm/subscribers";
import { getMailing } from "@/lib/newsletter/mailings";
import {
  loadMailingWaves,
  prioritizeTomorrowWave,
  summarizeWaves,
} from "@/lib/newsletter/wave-progress";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function blocked() {
  const missing = [...missingSupabaseEnv(), ...missingBrevoEnv()];
  if (!missing.length) return null;
  return jsonError(503, {
    error: "Add Supabase and Brevo credentials to load send progress.",
    code: "missing_credentials",
    missing,
  });
}

export async function GET(req: Request) {
  const fail = blocked();
  if (fail) return fail;

  const id = new URL(req.url).searchParams.get("mailingId")?.trim() || "";
  if (!id) {
    return jsonError(400, { error: "mailingId is required", code: "db_error" });
  }

  try {
    const mailing = await getMailing(id);
    if (!mailing) {
      return jsonError(404, { error: "Mailing not found", code: "db_error" });
    }
    const waves = await loadMailingWaves(mailing.name);
    const summary = summarizeWaves(waves);
    const next = summary.next;
    return Response.json({
      mailingId: mailing.id,
      name: mailing.name,
      ...summary,
      nextAt: next?.scheduledAt ?? null,
      nextIndex: next?.index ?? null,
      waves: waves.map((wave) => ({
        id: wave.id,
        index: wave.index,
        total: wave.total,
        status: wave.status,
        scheduledAt: wave.scheduledAt,
        sentAt: wave.sentAt,
        recipients: wave.recipients,
        tomorrowPriority: wave.tomorrowPriority,
      })),
    });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not load send progress",
      code: "sync_failed",
    });
  }
}

export async function POST(req: Request) {
  const fail = blocked();
  if (fail) return fail;

  let body: { mailingId?: string };
  try {
    body = (await req.json()) as { mailingId?: string };
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "send_failed" });
  }

  const id = body.mailingId?.trim() || "";
  if (!id) {
    return jsonError(400, { error: "mailingId is required", code: "send_failed" });
  }

  try {
    const mailing = await getMailing(id);
    if (!mailing) {
      return jsonError(404, { error: "Mailing not found", code: "db_error" });
    }
    const priority = await listTomorrowPriorityEmails();
    const result = await prioritizeTomorrowWave(mailing.name, priority);
    const summary = summarizeWaves(result.waves);
    return Response.json({
      ok: true,
      mailingId: mailing.id,
      moved: result.moved,
      tomorrowPriority: result.tomorrow,
      ...summary,
      waves: result.waves.map((wave) => ({
        id: wave.id,
        index: wave.index,
        total: wave.total,
        status: wave.status,
        scheduledAt: wave.scheduledAt,
        sentAt: wave.sentAt,
        recipients: wave.recipients,
        tomorrowPriority: wave.tomorrowPriority,
      })),
    });
  } catch (err) {
    return jsonError(502, {
      error:
        err instanceof Error ? err.message : "Could not prioritize tomorrow’s wave",
      code: "send_failed",
    });
  }
}
