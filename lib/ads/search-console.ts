import type {
  GscAppearanceRow,
  GscCountryRow,
  GscDailyRow,
  GscDeviceRow,
  GscMetrics,
  GscPageRow,
  GscPayload,
  GscQueryRow,
} from "@/lib/ads/gsc-types";
import { googleHttps } from "@/lib/ads/google-http";
import { missingEnv } from "@/lib/api";

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

function parseJson(text: string): unknown {
  try {
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export function missingGoogleEnv(): string[] {
  return missingEnv(GOOGLE_KEYS);
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

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!.trim(),
    grant_type: "refresh_token",
  }).toString();

  const { status, text } = await googleHttps({
    hostname: "oauth2.googleapis.com",
    path: "/token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = parseJson(text) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (status >= 400 || !json.access_token) {
    throw new Error(
      json.error_description ||
        json.error ||
        `Google token refresh failed (${status})`,
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
  const path = `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const payload = JSON.stringify(body);
  const { status, text } = await googleHttps({
    hostname: "searchconsole.googleapis.com",
    path,
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: payload,
  });

  if (status >= 400) {
    throw new Error(`Search Console ${status}: ${text.slice(0, 400)}`);
  }

  return parseJson(text) as { rows?: GscApiRow[] };
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

  const [totals, byDate, byQuery, byPage, byCountry, byDevice, byAppearance] =
    await Promise.all([
      querySearchAnalytics(token, siteUrl, { ...base }),
      querySearchAnalytics(token, siteUrl, {
        ...base,
        dimensions: ["date"],
        rowLimit: 32,
      }),
      querySearchAnalytics(token, siteUrl, {
        ...base,
        dimensions: ["query"],
        rowLimit: 100,
      }),
      querySearchAnalytics(token, siteUrl, {
        ...base,
        dimensions: ["page"],
        rowLimit: 100,
      }),
      querySearchAnalytics(token, siteUrl, {
        ...base,
        dimensions: ["country"],
        rowLimit: 50,
      }).catch(() => ({ rows: [] as GscApiRow[] })),
      querySearchAnalytics(token, siteUrl, {
        ...base,
        dimensions: ["device"],
        rowLimit: 10,
      }).catch(() => ({ rows: [] as GscApiRow[] })),
      querySearchAnalytics(token, siteUrl, {
        ...base,
        dimensions: ["searchAppearance"],
        rowLimit: 25,
      }).catch(() => ({ rows: [] as GscApiRow[] })),
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

  const countries: GscCountryRow[] = (byCountry.rows ?? [])
    .map((row) => ({
      country: row.keys?.[0] ?? "",
      ...metricsFromRow(row),
    }))
    .filter((row) => row.country);

  const devices: GscDeviceRow[] = (byDevice.rows ?? [])
    .map((row) => ({
      device: row.keys?.[0] ?? "",
      ...metricsFromRow(row),
    }))
    .filter((row) => row.device);

  const appearances: GscAppearanceRow[] = (byAppearance.rows ?? [])
    .map((row) => ({
      appearance: row.keys?.[0] ?? "",
      ...metricsFromRow(row),
    }))
    .filter((row) => row.appearance);

  return {
    siteUrl,
    dateFrom: startDate,
    dateTo: endDate,
    totals: metricsFromRow(totalsRow),
    daily,
    queries,
    pages,
    countries,
    devices,
    appearances,
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
    countries: report.countries,
    devices: report.devices,
    appearances: report.appearances,
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
