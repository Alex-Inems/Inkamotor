export type PipelineStage = {
  id: string;
  /** Empty = use built-in i18n label for core stages. */
  label: string;
  folded: boolean;
};

export const CORE_STAGE_IDS = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;

export type CoreStageId = (typeof CORE_STAGE_IDS)[number];

export const PIPELINE_STORAGE_KEY = "inkamoto.pipeline.stages";

export function defaultPipelineStages(): PipelineStage[] {
  return [
    { id: "new", label: "", folded: false },
    { id: "contacted", label: "", folded: false },
    { id: "qualified", label: "", folded: false },
    { id: "won", label: "", folded: true },
    { id: "lost", label: "", folded: true },
  ];
}

export function isCoreStageId(id: string): id is CoreStageId {
  return (CORE_STAGE_IDS as readonly string[]).includes(id);
}

export function isValidStageId(id: string) {
  return /^[a-z][a-z0-9_-]{0,47}$/i.test(id.trim());
}

export function slugifyStageId(label: string, taken: Set<string>) {
  const base =
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "stage";
  let id = base;
  let n = 2;
  while (taken.has(id) || !isValidStageId(id)) {
    id = `${base}_${n}`.slice(0, 48);
    n += 1;
  }
  return id;
}

export function normalizePipelineStages(
  input: unknown,
): PipelineStage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const seen = new Set<string>();
  const stages: PipelineStage[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!isValidStageId(id) || seen.has(id)) continue;
    seen.add(id);
    stages.push({
      id,
      label: typeof item.label === "string" ? item.label.trim().slice(0, 80) : "",
      folded: Boolean(item.folded),
    });
  }
  return stages.length ? stages : null;
}

export function readPipelineFromStorage(): PipelineStage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PIPELINE_STORAGE_KEY);
    if (!raw) return null;
    return normalizePipelineStages(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writePipelineToStorage(stages: PipelineStage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(stages));
}
