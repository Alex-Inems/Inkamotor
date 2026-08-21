import { googleHttps } from "@/lib/ads/google-http";
import type { TrendsPayload, TrendsPoint } from "@/lib/ads/gsc-types";

const HOST = "trends.google.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type Cache = { key: string; payload: TrendsPayload; expiresAt: number };

let cache: Cache | null = null;
const CACHE_MS = 60 * 60 * 1000;

export function defaultTrendsBrand() {
  return process.env.GOOGLE_TRENDS_BRAND?.trim() || "Inkamoto Tours";
}

export function defaultTrendsGeo() {
  return process.env.GOOGLE_TRENDS_GEO?.trim() ?? "";
}

export function envCompareTerms() {
  return (process.env.GOOGLE_TRENDS_COMPARE ?? "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
}

export function sanitizeTrendsTerms(input: string[], brand: string) {
  const extra = input
    .map((term) => term.trim().slice(0, 40))
    .filter((term) => term && term.toLowerCase() !== brand.toLowerCase());
  const unique = [...new Set(extra)].slice(0, 2);
  return [brand, ...unique];
}

function cookieHeader(setCookie: string[], previous = "") {
  const next = setCookie.map((row) => row.split(";")[0]?.trim()).filter(Boolean);
  if (!previous) return next.join("; ");
  const map = new Map<string, string>();
  for (const part of previous.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name) map.set(name, rest.join("="));
  }
  for (const part of next) {
    const [name, ...rest] = part.split("=");
    if (name) map.set(name, rest.join("="));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function parseTrendsJson(text: string) {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("Google Trends returned no data");
  return JSON.parse(text.slice(start)) as Record<string, unknown>;
}

function seriesAverages(
  terms: string[],
  points: TrendsPoint[],
  provided?: number[],
) {
  if (provided && provided.length >= terms.length) {
    return provided.slice(0, terms.length).map((n) => Number(n) || 0);
  }
  return terms.map((_, i) => {
    if (points.length === 0) return 0;
    const sum = points.reduce((n, row) => n + (row.values[i] ?? 0), 0);
    return Math.round(sum / points.length);
  });
}

async function trendsGet(path: string, cookie: string) {
  let currentPath = path;
  let currentCookie = cookie;
  for (let i = 0; i < 4; i++) {
    const res = await googleHttps({
      hostname: HOST,
      path: currentPath,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": UA,
        Referer: "https://trends.google.com/trends/explore",
        ...(currentCookie ? { Cookie: currentCookie } : {}),
      },
    });
    currentCookie = cookieHeader(res.setCookie, currentCookie);
    if (res.status >= 300 && res.status < 400 && res.location) {
      try {
        const next = new URL(res.location, `https://${HOST}`);
        if (next.hostname === HOST) {
          currentPath = `${next.pathname}${next.search}`;
          continue;
        }
      } catch {
        /* keep the response */
      }
    }
    return { ...res, cookie: currentCookie };
  }
  throw new Error("Google Trends redirected too many times");
}

async function fetchTrends(terms: string[], geo: string): Promise<TrendsPayload> {
  const warmup = await trendsGet(
    geo ? `/trends/?geo=${encodeURIComponent(geo)}` : "/trends/",
    "",
  );
  let cookie = warmup.cookie;

  const hl = "en-US";
  const tz = "-60";
  const exploreReq = {
    comparisonItem: terms.map((keyword) => ({
      keyword,
      geo,
      time: "today 12-m",
    })),
    category: 0,
    property: "",
  };
  const explorePath = `/trends/api/explore?hl=${hl}&tz=${tz}&req=${encodeURIComponent(JSON.stringify(exploreReq))}`;
  const explored = await trendsGet(explorePath, cookie);
  cookie = explored.cookie;

  if (explored.status >= 400) {
    throw new Error("Google Trends is busy right now");
  }

  const exploreJson = parseTrendsJson(explored.text);
  const widgets = (exploreJson.widgets ?? []) as Array<{
    id?: string;
    token?: string;
    request?: unknown;
  }>;
  const series = widgets.find((w) => w.id === "TIMESERIES");
  if (!series?.token || !series.request) {
    throw new Error("Google Trends did not return a timeline");
  }

  const dataPath = `/trends/api/widgetdata/multiline?hl=${hl}&tz=${tz}&req=${encodeURIComponent(JSON.stringify(series.request))}&token=${encodeURIComponent(series.token)}`;
  const data = await trendsGet(dataPath, cookie);
  if (data.status >= 400) {
    throw new Error("Google Trends is busy right now");
  }

  const json = parseTrendsJson(data.text) as {
    default?: {
      timelineData?: Array<{
        formattedTime?: string;
        formattedAxisTime?: string;
        value?: number[];
      }>;
      averages?: number[];
    };
  };
  const points: TrendsPoint[] = (json.default?.timelineData ?? [])
    .map((row) => ({
      date: row.formattedAxisTime || row.formattedTime || "",
      values: (row.value ?? []).map((n) => Number(n) || 0),
    }))
    .filter((row) => row.date);

  return {
    terms,
    geo,
    points,
    averages: seriesAverages(terms, points, json.default?.averages),
  };
}

export async function loadGoogleTrends(
  extraTerms: string[],
  geo = defaultTrendsGeo(),
): Promise<TrendsPayload> {
  const extras = extraTerms.length > 0 ? extraTerms : envCompareTerms();
  const terms = sanitizeTrendsTerms(extras, defaultTrendsBrand());
  const key = `${geo}|${terms.join("|").toLowerCase()}`;
  if (cache && cache.key === key && cache.expiresAt > Date.now()) {
    return cache.payload;
  }

  let payload = await fetchTrends(terms, geo);
  if (payload.points.length === 0 && geo) {
    payload = await fetchTrends(terms, "");
  }
  cache = { key, payload, expiresAt: Date.now() + CACHE_MS };
  return payload;
}
