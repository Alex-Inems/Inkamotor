import { jsonError } from "@/lib/api";
import { leadCsvTemplate, rowsToLeadCsv } from "@/lib/crm/lead-csv";
import { collectLeadsForExport, type LeadListQuery } from "@/lib/crm/lead-query";
import { isValidStageId } from "@/lib/crm/pipeline";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function supabaseMissing() {
  const missing = missingSupabaseEnv();
  if (!missing.length) return null;
  return jsonError(503, {
    error: "Supabase is not configured",
    code: "missing_credentials",
    missing,
  });
}

function csvResponse(body: string, filename: string) {
  const safe = filename.replace(/[^\w.-]+/g, "_") || "export.csv";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "no-store",
    },
  });
}

function parseIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === "string" && Boolean(id.trim()));
  }
  if (typeof value === "string") {
    return value.split(",").map((id) => id.trim()).filter(Boolean);
  }
  return [];
}

function parseQuery(source: {
  q?: unknown;
  stage?: unknown;
  country?: unknown;
  tag?: unknown;
  kind?: unknown;
  active?: unknown;
  highPriority?: unknown;
  ids?: unknown;
}): LeadListQuery {
  const stage = typeof source.stage === "string" ? source.stage : "all";
  const kind = typeof source.kind === "string" ? source.kind : "all";
  const active = typeof source.active === "string" ? source.active : "all";
  return {
    q: typeof source.q === "string" ? source.q : "",
    stage: stage !== "all" && isValidStageId(stage) ? stage : "all",
    country: typeof source.country === "string" ? source.country : "all",
    tag: typeof source.tag === "string" ? source.tag : "all",
    kind: kind === "company" || kind === "person" ? kind : "all",
    active:
      active === "active" || active === "archived" ? active : "all",
    highPriority: source.highPriority === true || source.highPriority === "1",
    ids: parseIds(source.ids),
    sort: "name",
    dir: "asc",
  };
}

async function runExport(
  query: LeadListQuery,
  filename: string,
  template: boolean,
) {
  if (template) return csvResponse(leadCsvTemplate(), "leads-template.csv");
  const rows = await collectLeadsForExport(query);
  return csvResponse(rowsToLeadCsv(rows), filename);
}

export async function GET(req: Request) {
  const blocked = supabaseMissing();
  if (blocked) return blocked;
  const url = new URL(req.url);
  const template = url.searchParams.get("template") === "1";
  const filename = url.searchParams.get("filename") || "leads.csv";
  try {
    return await runExport(
      parseQuery({
        q: url.searchParams.get("q"),
        stage: url.searchParams.get("stage"),
        country: url.searchParams.get("country"),
        tag: url.searchParams.get("tag"),
        kind: url.searchParams.get("kind"),
        active: url.searchParams.get("active"),
        highPriority: url.searchParams.get("highPriority"),
        ids: url.searchParams.get("ids"),
      }),
      filename,
      template,
    );
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not export",
      code: "db_error",
    });
  }
}

export async function POST(req: Request) {
  const blocked = supabaseMissing();
  if (blocked) return blocked;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const filename =
      typeof body.filename === "string" && body.filename.trim()
        ? body.filename.trim()
        : "leads.csv";
    return await runExport(
      parseQuery(body),
      filename,
      body.template === true,
    );
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not export",
      code: "db_error",
    });
  }
}
