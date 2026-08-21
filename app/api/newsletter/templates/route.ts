import { jsonError } from "@/lib/api";
import { builtinById, builtinTemplates } from "@/lib/newsletter/templates";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  subject: string;
  preview: string;
  html: string;
};

function isMissingTable(message: string) {
  return /newsletter_templates|schema cache|does not exist/i.test(message);
}

async function listCustom() {
  const missing = missingSupabaseEnv();
  if (missing.length) return [] as Row[];
  const sb = getSupabase();
  const { data, error } = await sb
    .from("newsletter_templates")
    .select("id, name, subject, preview, html")
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingTable(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as Row[];
}

export async function GET() {
  try {
    const custom = await listCustom();
    return Response.json({
      templates: [
        ...builtinTemplates,
        ...custom.map((row) => ({ ...row, builtin: false })),
      ],
    });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not load templates",
      code: "db_error",
    });
  }
}

export async function POST(request: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing,
    });
  }

  let body: { name?: string; subject?: string; preview?: string; html?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "send_failed" });
  }

  const name = body.name?.trim();
  const html = body.html?.trim();
  if (!name || !html) {
    return jsonError(400, {
      error: "Name and body are required to save a template.",
      code: "send_failed",
    });
  }

  const id = `tpl_${Date.now()}`;
  const { error } = await getSupabase().from("newsletter_templates").insert({
    id,
    name,
    subject: body.subject?.trim() || name,
    preview: body.preview?.trim() || "",
    html,
  });
  if (error) {
    const hint = isMissingTable(error.message)
      ? " Run supabase/billing_and_templates.sql in the SQL editor."
      : "";
    return jsonError(502, {
      error: `${error.message}${hint}`,
      code: "db_error",
    });
  }
  return Response.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing,
    });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() || "";
  if (!id || builtinById(id)) {
    return jsonError(400, {
      error: "Built-in templates cannot be deleted.",
      code: "send_failed",
    });
  }

  const { error } = await getSupabase()
    .from("newsletter_templates")
    .delete()
    .eq("id", id);
  if (error) {
    return jsonError(502, { error: error.message, code: "db_error" });
  }
  return Response.json({ ok: true });
}
