import { jsonError } from "@/lib/api";
import { csvToLeadRows } from "@/lib/crm/lead-csv";
import { importLeadCsvRows } from "@/lib/crm/lead-query";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 8000;

export async function POST(req: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing,
    });
  }

  let text = "";
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return jsonError(400, {
          error: "Choose a CSV file",
          code: "bad_request",
        });
      }
      if (file.size > MAX_BYTES) {
        return jsonError(400, {
          error: "File is too large (max 8 MB)",
          code: "bad_request",
        });
      }
      const name = file.name.toLowerCase();
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        return jsonError(400, {
          error: "Save the spreadsheet as CSV UTF-8, then import that file",
          code: "bad_request",
        });
      }
      text = await file.text();
    } else {
      text = await req.text();
    }
  } catch {
    return jsonError(400, { error: "Could not read file", code: "bad_request" });
  }

  if (!text.trim()) {
    return jsonError(400, { error: "File is empty", code: "bad_request" });
  }

  try {
    const rows = csvToLeadRows(text);
    if (rows.length > MAX_ROWS) {
      return jsonError(400, {
        error: `Too many rows (max ${MAX_ROWS})`,
        code: "bad_request",
      });
    }
    const result = await importLeadCsvRows(rows);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not import",
      code: "db_error",
    });
  }
}
