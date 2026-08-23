const KEY = "inkamoto-hidden-campaigns";

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function hiddenCampaignIds() {
  return new Set(readIds());
}

export function hideCampaignId(id: string) {
  const next = [...new Set([id, ...readIds()])].slice(0, 300);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}
