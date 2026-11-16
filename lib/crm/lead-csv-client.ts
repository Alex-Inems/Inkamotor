import { readApiJson } from "@/lib/api-client";
import { leadCsvTemplate } from "@/lib/crm/lead-csv";

export type LeadExportFilters = {
  q?: string;
  stage?: string;
  country?: string;
  tag?: string;
  kind?: "all" | "person" | "company";
  active?: "all" | "active" | "archived";
  highPriority?: boolean;
  ids?: string[];
  filename?: string;
};

function filenameFromHeader(header: string | null, fallback: string) {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadLeadCsvTemplate(filename = "leads-template.csv") {
  triggerDownload(
    new Blob([leadCsvTemplate()], { type: "text/csv;charset=utf-8" }),
    filename,
  );
}

export async function exportLeadRecords(filters: LeadExportFilters) {
  const filename = filters.filename || "leads.csv";
  const res = await fetch("/api/leads/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...filters, filename }),
  });
  if (!res.ok) {
    const parsed = await readApiJson<{ error?: string }>(res);
    throw new Error(
      parsed.ok ? "Could not export" : parsed.error || "Could not export",
    );
  }
  const blob = await res.blob();
  triggerDownload(
    blob,
    filenameFromHeader(res.headers.get("Content-Disposition"), filename),
  );
}

export async function importLeadCsvFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/leads/import", { method: "POST", body: form });
  const parsed = await readApiJson<{
    created?: number;
    updated?: number;
    skipped?: number;
    errors?: { row: number; message: string }[];
  }>(res);
  if (!parsed.ok) throw new Error(parsed.error || "Could not import");
  return {
    created: parsed.data.created ?? 0,
    updated: parsed.data.updated ?? 0,
    skipped: parsed.data.skipped ?? 0,
    errors: parsed.data.errors ?? [],
  };
}
