import { jsonError } from "@/lib/api";
import { clampPriority } from "@/lib/crm/contact-details";
import {
  listLeadPage,
  parseContactWrite,
  updateLeadPriorityFast,
  updateLeadStatusFast,
  writeLead,
} from "@/lib/crm/lead-query";
import { isValidStageId } from "@/lib/crm/pipeline";
import type { LeadStatus } from "@/lib/demo-data";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function supabaseMissing() {
  const missing = missingSupabaseEnv();
  if (!missing.length) return null;
  return jsonError(503, {
    error: "Supabase is not configured",
    code: "missing_credentials",
    missing,
  });
}

export async function GET(req: Request) {
  const blocked = supabaseMissing();
  if (blocked) return blocked;

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage") ?? "all";
  const sort = url.searchParams.get("sort") ?? "completeness";
  const dir = url.searchParams.get("dir") === "desc" ? "desc" : "asc";
  const kind = url.searchParams.get("kind") ?? "all";
  const kanban = url.searchParams.get("kanban") === "1";

  try {
    const payload = await listLeadPage({
      q: url.searchParams.get("q") ?? "",
      stage: stage !== "all" && isValidStageId(stage) ? stage : "all",
      country: url.searchParams.get("country") ?? "all",
      kind: kind === "company" || kind === "person" ? kind : "all",
      sort:
        sort === "email" || sort === "updated" || sort === "name"
          ? sort
          : "completeness",
      dir,
      page: Number(url.searchParams.get("page") ?? 0) || 0,
      limit: Number(url.searchParams.get("limit") ?? (kanban ? 400 : 75)) || 75,
      kanban,
    });
    return Response.json(payload);
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not load leads",
      code: "db_error",
    });
  }
}

export async function POST(req: Request) {
  const blocked = supabaseMissing();
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "db_error" });
  }
  const input = parseContactWrite(body);
  if (!input) {
    return jsonError(400, { error: "Contact fields are required", code: "db_error" });
  }
  if (!input.name.trim()) {
    return jsonError(400, { error: "Name is required", code: "db_error" });
  }

  try {
    const row = await writeLead(input);
    return Response.json({ row });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not add lead",
      code: "db_error",
    });
  }
}

export async function PATCH(req: Request) {
  const blocked = supabaseMissing();
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "db_error" });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return jsonError(400, { error: "id is required", code: "db_error" });
  }

  if (
    body.name == null &&
    typeof body.status === "string" &&
    isValidStageId(body.status)
  ) {
    try {
      await updateLeadStatusFast(id, body.status as LeadStatus);
      return Response.json({ ok: true });
    } catch (err) {
      return jsonError(502, {
        error: err instanceof Error ? err.message : "Could not update lead",
        code: "db_error",
      });
    }
  }

  if (body.name == null && body.priority != null && body.status == null) {
    try {
      await updateLeadPriorityFast(id, clampPriority(body.priority));
      return Response.json({ ok: true });
    } catch (err) {
      return jsonError(502, {
        error: err instanceof Error ? err.message : "Could not update lead",
        code: "db_error",
      });
    }
  }

  const input = parseContactWrite(body);
  if (!input) {
    return jsonError(400, { error: "Contact fields are required", code: "db_error" });
  }
  if (!input.name.trim()) {
    return jsonError(400, { error: "Name is required", code: "db_error" });
  }

  try {
    const row = await writeLead(input, id);
    return Response.json({ row });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not update lead",
      code: "db_error",
    });
  }
}
