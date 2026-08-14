/**
 * Google Search Console — PAUSED.
 * Nothing here reads GOOGLE_* / GSC_* env. Re-enable later from
 * lib/ads/search-console.impl.ts when Google credentials are ready.
 */

import type { GscPayload } from "@/lib/ads/gsc-types";

/** Always empty — Google env is not required while paused. */
export function missingGoogleEnv(): string[] {
  return [];
}

export function gscSiteUrl() {
  return "";
}

export function gscDefaultRange(now = new Date()) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

export async function fetchSearchConsoleReport(): Promise<never> {
  throw new Error("Google Search Console is paused.");
}

export function reportToPayload(): GscPayload {
  const syncedAt = new Date().toISOString();
  return {
    snapshot: {
      id: "paused",
      siteUrl: "",
      dateFrom: "",
      dateTo: "",
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      syncedAt,
    },
    daily: [],
    queries: [],
    pages: [],
    lastSync: {
      status: "error",
      finishedAt: syncedAt,
      error: "Google Search Console is paused.",
    },
  };
}

export async function loadSearchConsole(_force = false): Promise<GscPayload> {
  throw new Error("Google Search Console is paused.");
}
