import { readApiJson } from "@/lib/api-client";

export async function deleteLeadRecords(ids: string[]) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return unique;
  const res = await fetch("/api/leads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: unique }),
  });
  const parsed = await readApiJson<{ deleted?: string[] }>(res);
  if (!parsed.ok) throw new Error(parsed.error || "Could not delete");
  return parsed.data.deleted ?? unique;
}
