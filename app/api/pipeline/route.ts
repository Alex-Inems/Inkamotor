import { jsonError } from "@/lib/api";
import {
  defaultPipelineStages,
  normalizePipelineStages,
  type PipelineStage,
} from "@/lib/crm/pipeline";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadFromDb(): Promise<PipelineStage[] | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("pipeline_stages")
    .select("id, label, sort_order, folded")
    .order("sort_order", { ascending: true });
  if (error) {
    if (/pipeline_stages|schema cache|does not exist/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }
  if (!data?.length) return [];
  return data.map((row) => ({
    id: String(row.id),
    label: String(row.label ?? ""),
    folded: Boolean(row.folded),
  }));
}

async function saveToDb(stages: PipelineStage[]) {
  const sb = getSupabase();
  const { error: delError } = await sb
    .from("pipeline_stages")
    .delete()
    .neq("id", "__none__");
  if (delError) throw new Error(delError.message);
  const rows = stages.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    sort_order: index,
    folded: stage.folded,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await sb.from("pipeline_stages").insert(rows);
  if (error) throw new Error(error.message);
}

export async function GET() {
  const missing = missingSupabaseEnv();
  if (missing.length) {
    return Response.json({ stages: defaultPipelineStages(), source: "default" });
  }
  try {
    const fromDb = await loadFromDb();
    if (fromDb === null) {
      return Response.json({
        stages: defaultPipelineStages(),
        source: "default",
        needsMigration: true,
      });
    }
    if (fromDb.length === 0) {
      return Response.json({ stages: defaultPipelineStages(), source: "default" });
    }
    return Response.json({ stages: fromDb, source: "db" });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not load pipeline",
      code: "db_error",
    });
  }
}

export async function PUT(req: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "db_error" });
  }
  const stages = normalizePipelineStages(
    body && typeof body === "object"
      ? (body as { stages?: unknown }).stages
      : null,
  );
  if (!stages) {
    return jsonError(400, {
      error: "At least one stage is required",
      code: "db_error",
    });
  }

  try {
    await saveToDb(stages);
    return Response.json({ stages, source: "db" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save pipeline";
    if (/pipeline_stages|schema cache|does not exist/i.test(message)) {
      return jsonError(503, {
        error:
          "Run supabase/pipeline_stages.sql in Supabase, or stages stay on this browser only.",
        code: "db_error",
      });
    }
    return jsonError(502, { error: message, code: "db_error" });
  }
}
