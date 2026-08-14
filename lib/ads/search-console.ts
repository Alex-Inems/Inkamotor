import type {
  GscDailyRow,
  GscMetrics,
  GscPageRow,
  GscPayload,
  GscQueryRow,
} from "@/lib/ads/gsc-types";

const GOOGLE_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GSC_SITE_URL",
] as const;

type CachedToken = { token: string; expiresAt: number };

let cachedToken: CachedToken | null = null;

type GscApiRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

function metricsFromRow(row?: GscApiRow): GscMetrics {
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function missingGoogleEnv(): string[] {
  return GOOGLE_KEYS.filter((key) => !process.env[key]?.trim());
}

export function gscSiteUrl() {
  return process.env.GSC_SITE_URL?.trim() ?? "";
}

/** Last 28 days of typically-available GSC data (Google lags ~2–3 days). */
export function gscDefaultRange(now = new Date()) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!.trim(),
      grant_type: "refresh_token",
    }),
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || `Google token refresh failed (${res.status})`,
    );
  }

  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>,
) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Search Console ${res.status}: ${text.slice(0, 400)}`);
  }

  return (await res.json()) as { rows?: GscApiRow[] };
}

export async function fetchSearchConsoleReport() {
  const siteUrl = gscSiteUrl();
  const { startDate, endDate } = gscDefaultRange();
  const token = await getAccessToken();
  const base = {
    startDate,
    endDate,
    dataState: "all" as const,
  };

  const [totals, byDate, byQuery, byPage] = await Promise.all([
    querySearchAnalytics(token, siteUrl, { ...base }),
    querySearchAnalytics(token, siteUrl, {
      ...base,
      dimensions: ["date"],
      rowLimit: 28,
    }),
    querySearchAnalytics(token, siteUrl, {
      ...base,
      dimensions: ["query"],
      rowLimit: 50,
    }),
    querySearchAnalytics(token, siteUrl, {
      ...base,
      dimensions: ["page"],
      rowLimit: 50,
    }),
  ]);

  const totalsRow = totals.rows?.[0];
  const daily: GscDailyRow[] = (byDate.rows ?? [])
    .map((row) => ({
      date: row.keys?.[0] ?? "",
      ...metricsFromRow(row),
    }))
    .filter((row) => row.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const queries: GscQueryRow[] = (byQuery.rows ?? [])
    .map((row) => ({
      query: row.keys?.[0] ?? "",
      ...metricsFromRow(row),
    }))
    .filter((row) => row.query);

  const pages: GscPageRow[] = (byPage.rows ?? [])
    .map((row) => ({
      page: row.keys?.[0] ?? "",
      ...metricsFromRow(row),
    }))
    .filter((row) => row.page);

  return {
    siteUrl,
    dateFrom: startDate,
    dateTo: endDate,
    totals: metricsFromRow(totalsRow),
    daily,
    queries,
    pages,
  };
}

export function reportToPayload(
  report: Awaited<ReturnType<typeof fetchSearchConsoleReport>>,
): GscPayload {
  const syncedAt = new Date().toISOString();
  return {
    snapshot: {
      id: "live",
      siteUrl: report.siteUrl,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      ...report.totals,
      syncedAt,
    },
    daily: report.daily,
    queries: report.queries,
    pages: report.pages,
    lastSync: { status: "ok", finishedAt: syncedAt, error: null },
  };
}

type Cache = { payload: GscPayload; expiresAt: number };

let cache: Cache | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function loadSearchConsole(force = false): Promise<GscPayload> {
  if (!force && cache && cache.expiresAt > Date.now()) {
    return cache.payload;
  }
  const payload = reportToPayload(await fetchSearchConsoleReport());
  cache = { payload, expiresAt: Date.now() + CACHE_MS };
  return payload;
}
