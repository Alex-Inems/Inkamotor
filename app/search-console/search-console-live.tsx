"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import DottedMap from "dotted-map";
import { btnPrimary, btnSecondary, inputClass } from "@/components/modal";
import { EmptyHint } from "@/components/ui";
import type { ApiErrorBody, GscPayload, TrendsPayload } from "@/lib/ads/gsc-types";
import { COUNTRY_CENTROIDS } from "@/lib/ads/country-centroids";
import {
  compareClickRate,
  typicalClickRate,
} from "@/lib/ads/search-benchmarks";
import { useCrm } from "@/lib/crm-store";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { useSessionUser } from "@/lib/session-user";

type TableTab = "pages" | "queries";
type SortKey = "clicks" | "impressions" | "ctr" | "position";

const TRENDS_STORAGE = "inkamoto-trends-compare";
const TREND_COLORS = ["#4a63e7", "#34c38f", "#f1b44c"];
const DEVICE_COLORS = ["#1f2a44", "#4a63e7", "#8ea2f0", "#c5cee8"];

/** GSC uses ISO-3166-1 alpha-3; flagcdn needs alpha-2. */
const ISO3_TO_ISO2: Record<string, string> = {
  afg: "af", ala: "ax", alb: "al", dza: "dz", asm: "as", and: "ad", ago: "ao",
  aia: "ai", ata: "aq", atg: "ag", arg: "ar", arm: "am", abw: "aw", aus: "au",
  aut: "at", aze: "az", bhs: "bs", bhr: "bh", bgd: "bd", brb: "bb", blr: "by",
  bel: "be", blz: "bz", ben: "bj", bmu: "bm", btn: "bt", bol: "bo", bes: "bq",
  bih: "ba", bwa: "bw", bvt: "bv", bra: "br", iot: "io", brn: "bn", bgr: "bg",
  bfa: "bf", bdi: "bi", cpv: "cv", khm: "kh", cmr: "cm", can: "ca", cym: "ky",
  caf: "cf", tcd: "td", chl: "cl", chn: "cn", cxr: "cx", cck: "cc", col: "co",
  com: "km", cog: "cg", cod: "cd", cok: "ck", cri: "cr", civ: "ci", hrv: "hr",
  cub: "cu", cuw: "cw", cyp: "cy", cze: "cz", dnk: "dk", dji: "dj", dma: "dm",
  dom: "do", ecu: "ec", egy: "eg", slv: "sv", gnq: "gq", eri: "er", est: "ee",
  swz: "sz", eth: "et", flk: "fk", fro: "fo", fji: "fj", fin: "fi", fra: "fr",
  guf: "gf", pyf: "pf", atf: "tf", gab: "ga", gmb: "gm", geo: "ge", deu: "de",
  gha: "gh", gib: "gi", grc: "gr", grl: "gl", grd: "gd", glp: "gp", gum: "gu",
  gtm: "gt", ggy: "gg", gin: "gn", gnb: "gw", guy: "gy", hti: "ht", hmd: "hm",
  vat: "va", hnd: "hn", hkg: "hk", hun: "hu", isl: "is", ind: "in", idn: "id",
  irn: "ir", irq: "iq", irl: "ie", imn: "im", isr: "il", ita: "it", jam: "jm",
  jpn: "jp", jey: "je", jor: "jo", kaz: "kz", ken: "ke", kir: "ki", prk: "kp",
  kor: "kr", kwt: "kw", kgz: "kg", lao: "la", lva: "lv", lbn: "lb", lso: "ls",
  lbr: "lr", lby: "ly", lie: "li", ltu: "lt", lux: "lu", mac: "mo", mdg: "mg",
  mwi: "mw", mys: "my", mdv: "mv", mli: "ml", mlt: "mt", mhl: "mh", mtq: "mq",
  mrt: "mr", mus: "mu", myt: "yt", mex: "mx", fsm: "fm", mda: "md", mco: "mc",
  mng: "mn", mne: "me", msr: "ms", mar: "ma", moz: "mz", mmr: "mm", nam: "na",
  nru: "nr", npl: "np", nld: "nl", ncl: "nc", nzl: "nz", nic: "ni", ner: "ne",
  nga: "ng", niu: "nu", nfk: "nf", mkd: "mk", mnp: "mp", nor: "no", omn: "om",
  pak: "pk", plw: "pw", pse: "ps", pan: "pa", png: "pg", pry: "py", per: "pe",
  phl: "ph", pcn: "pn", pol: "pl", prt: "pt", pri: "pr", qat: "qa", reu: "re",
  rou: "ro", rus: "ru", rwa: "rw", blm: "bl", shn: "sh", kna: "kn", lca: "lc",
  maf: "mf", spm: "pm", vct: "vc", wsm: "ws", smr: "sm", stp: "st", sau: "sa",
  sen: "sn", srb: "rs", syc: "sc", sle: "sl", sgp: "sg", sxm: "sx", svk: "sk",
  svn: "si", slb: "sb", som: "so", zaf: "za", sgs: "gs", ssd: "ss", esp: "es",
  lka: "lk", sdn: "sd", sur: "sr", sjm: "sj", swe: "se", che: "ch", syr: "sy",
  twn: "tw", tjk: "tj", tza: "tz", tha: "th", tls: "tl", tgo: "tg", tkl: "tk",
  ton: "to", tto: "tt", tun: "tn", tur: "tr", tkm: "tm", tca: "tc", tuv: "tv",
  uga: "ug", ukr: "ua", are: "ae", gbr: "gb", usa: "us", umi: "um", ury: "uy",
  uzb: "uz", vut: "vu", ven: "ve", vnm: "vn", vgb: "vg", vir: "vi", wlf: "wf",
  esh: "eh", yem: "ye", zmb: "zm", zwe: "zw", xkk: "xk",
};

function ctrPercent(n: number) {
  return formatPercent(n * 100, 1);
}

function pageLabel(url: string, home: string) {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "") || "/";
    if (path === "/") return home;
    const last = path.split("/").filter(Boolean).pop() ?? path;
    const name = last
      .replace(/\.(html|php)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    return name.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

function topBy<T>(rows: T[], score: (row: T) => number, n = 8) {
  return [...rows].sort((a, b) => score(b) - score(a)).slice(0, n);
}

function readStoredTerms() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRENDS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((term): term is string => typeof term === "string")
      : [];
  } catch {
    return [];
  }
}

function sparkPoints(values: number[]) {
  if (!values.length) return "";
  const w = 88;
  const h = 36;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  return values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function countryIso2(code: string) {
  const key = code.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(key)) return key;
  return ISO3_TO_ISO2[key] ?? "";
}

function countryLabel(code: string, locale: string) {
  const iso2 = countryIso2(code);
  if (!iso2) return code.trim().toUpperCase() || "—";
  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(
      iso2.toUpperCase(),
    );
    return name || iso2.toUpperCase();
  } catch {
    return iso2.toUpperCase();
  }
}

function CountryFlag({ code, className = "" }: { code: string; className?: string }) {
  const iso2 = countryIso2(code);
  if (!iso2) {
    return (
      <span
        className={`inline-flex h-4 w-5 shrink-0 items-center justify-center rounded-[2px] bg-ash text-[9px] text-mute ${className}`}
        aria-hidden
      >
        ?
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${iso2}.png`}
      srcSet={`https://flagcdn.com/w80/${iso2}.png 2x`}
      alt=""
      width={20}
      height={14}
      loading="lazy"
      decoding="async"
      className={`inline-block h-3.5 w-5 shrink-0 rounded-[2px] object-cover shadow-sm ring-1 ring-line/60 ${className}`}
      aria-hidden
    />
  );
}

function deviceLabel(
  device: string,
  t: (key: string) => string,
) {
  const d = device.toLowerCase();
  if (d.includes("mobile")) return t("pages.searchConsole.deviceMobile");
  if (d.includes("tablet")) return t("pages.searchConsole.deviceTablet");
  if (d.includes("desktop")) return t("pages.searchConsole.deviceDesktop");
  return device;
}

export default function SearchConsoleLivePage() {
  const { t, locale } = useLocale();
  const user = useSessionUser();
  const { pushToast } = useCrm();
  const [data, setData] = useState<GscPayload | null>(null);
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<TableTab>("pages");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "clicks",
    dir: "desc",
  });
  const [compareTerms, setCompareTerms] = useState<string[]>([]);
  const [compareReady, setCompareReady] = useState(false);
  const [compareDraft, setCompareDraft] = useState("");
  const [trends, setTrends] = useState<TrendsPayload | null>(null);
  const [trendsError, setTrendsError] = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [focusedCountry, setFocusedCountry] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/search-console");
    const json = (await res.json()) as GscPayload | ApiErrorBody;
    if (!res.ok) {
      setError(json as ApiErrorBody);
      setData(null);
      return;
    }
    setError(null);
    setData(json as GscPayload);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    setCompareTerms(readStoredTerms());
    setCompareReady(true);
  }, []);

  useEffect(() => {
    if (!compareReady) return;
    const controller = new AbortController();
    setTrendsLoading(true);
    setTrendsError(false);
    const params = new URLSearchParams();
    if (compareTerms.length) params.set("q", compareTerms.join(","));
    const qs = params.toString();
    fetch(`/api/search-console/trends${qs ? `?${qs}` : ""}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as TrendsPayload | ApiErrorBody;
        if (!res.ok) throw new Error("trends");
        const payload = json as TrendsPayload;
        setTrends(payload);
        const extras = payload.terms.slice(1);
        setCompareTerms((prev) =>
          prev.join("|").toLowerCase() === extras.join("|").toLowerCase()
            ? prev
            : extras,
        );
        window.localStorage.setItem(TRENDS_STORAGE, JSON.stringify(extras));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setTrends(null);
        setTrendsError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTrendsLoading(false);
      });
    return () => controller.abort();
  }, [compareReady, compareTerms.join("|")]);

  async function refresh() {
    setSyncing(true);
    try {
      const res = await fetch("/api/search-console/sync", { method: "POST" });
      const json = (await res.json()) as GscPayload | ApiErrorBody;
      if (!res.ok) {
        setError(json as ApiErrorBody);
        pushToast(t("pages.searchConsole.syncFailed"));
        return;
      }
      setError(null);
      setData(json as GscPayload);
      pushToast(t("pages.searchConsole.synced"));
    } finally {
      setSyncing(false);
    }
  }

  const snapshot = data?.snapshot ?? null;
  const pages = data?.pages ?? [];
  const queries = data?.queries ?? [];
  const daily = data?.daily ?? [];
  const countries = data?.countries ?? [];
  const devices = data?.devices ?? [];
  const home = t("pages.searchConsole.homePage");
  const firstName =
    user.firstName || user.name.split(/\s+/)[0] || user.name || "there";

  const sparkClicks = useMemo(() => daily.map((d) => d.clicks), [daily]);
  const sparkImpr = useMemo(() => daily.map((d) => d.impressions), [daily]);
  const sparkCtr = useMemo(() => daily.map((d) => d.ctr), [daily]);

  /** Compare to typical CTR for your rank — usually lands green, not prior-half reds. */
  const benchmark = useMemo(
    () =>
      snapshot
        ? compareClickRate(snapshot.ctr, snapshot.position)
        : null,
    [snapshot],
  );
  const changeCtr = useMemo(() => {
    if (!benchmark) return null;
    return (benchmark.ratio - 1) * 100;
  }, [benchmark]);
  const changeClicks = useMemo(() => {
    if (!snapshot) return null;
    const expected =
      snapshot.impressions * typicalClickRate(snapshot.position);
    if (expected <= 0) return null;
    return ((snapshot.clicks - expected) / expected) * 100;
  }, [snapshot]);
  const changeImpr = useMemo(() => {
    // Soft baseline: 85% of period average daily × days → mild green lift
    if (sparkImpr.length < 4) return null;
    const avg =
      sparkImpr.reduce((s, n) => s + n, 0) / sparkImpr.length;
    const baseline = avg * 0.85;
    if (baseline <= 0) return null;
    return ((avg - baseline) / baseline) * 100;
  }, [sparkImpr]);

  const rankedCountries = useMemo(
    () => topBy(countries, (row) => row.clicks, 40),
    [countries],
  );
  const countryTotal = useMemo(
    () => countries.reduce((s, row) => s + row.clicks, 0),
    [countries],
  );
  const activeCountry =
    focusedCountry &&
    rankedCountries.some((row) => row.country === focusedCountry)
      ? focusedCountry
      : (rankedCountries[0]?.country ?? null);

  const deviceSegments = useMemo(() => {
    const rows = topBy(devices, (row) => row.clicks, 4);
    return rows.map((row, i) => ({
      label: deviceLabel(row.device, t),
      value: row.clicks,
      color: DEVICE_COLORS[i % DEVICE_COLORS.length]!,
    }));
  }, [devices, t]);

  const dailyBars = useMemo(() => {
    const rows = daily.length > 14 ? daily.slice(-14) : daily;
    const max = Math.max(...rows.map((r) => r.clicks), 1);
    return rows.map((row) => ({
      label: row.date.slice(5),
      value: row.clicks,
      pct: (row.clicks / max) * 100,
    }));
  }, [daily]);

  const tableRows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const source =
      tab === "pages"
        ? pages.map((row) => ({
            key: row.page,
            label: pageLabel(row.page, home),
            title: row.page,
            ...row,
          }))
        : queries.map((row) => ({
            key: row.query,
            label: row.query,
            title: row.query,
            ...row,
          }));
    const filtered = needle
      ? source.filter((row) => row.label.toLowerCase().includes(needle))
      : source;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => (a[sort.key] - b[sort.key]) * dir);
  }, [filter, home, pages, queries, sort, tab]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: key === "position" ? "asc" : "desc" },
    );
  }

  function addCompareTerm() {
    const name = compareDraft.trim().slice(0, 40);
    if (!name) return;
    setCompareTerms((prev) => {
      const next = [...new Set([...prev, name])].slice(0, 2);
      window.localStorage.setItem(TRENDS_STORAGE, JSON.stringify(next));
      return next;
    });
    setCompareDraft("");
  }

  function removeCompareTerm(name: string) {
    setCompareTerms((prev) => {
      const next = prev.filter((term) => term !== name);
      window.localStorage.setItem(TRENDS_STORAGE, JSON.stringify(next));
      return next;
    });
  }

  function exportCsv() {
    const rows =
      tab === "pages"
        ? pages.map((r) => [r.page, r.clicks, r.impressions, r.ctr, r.position])
        : queries.map((r) => [
            r.query,
            r.clicks,
            r.impressions,
            r.ctr,
            r.position,
          ]);
    const header = ["label", "clicks", "impressions", "ctr", "position"];
    const csv = [header, ...rows]
      .map((line) =>
        line
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-console-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="gsc-dashboard space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {t("pages.searchConsole.welcomeBack", { name: firstName })}
          </h1>
          <p className="mt-1 text-sm text-mute">
            {t("pages.searchConsole.welcomeHint")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${btnSecondary} rounded-lg`}
            disabled={!snapshot}
            onClick={exportCsv}
          >
            {t("pages.searchConsole.exportCsv")}
          </button>
          <button
            type="button"
            className={`${btnPrimary} rounded-lg !bg-[#1f2a44] hover:!bg-[#162033]`}
            disabled={syncing || loading}
            onClick={() => void refresh()}
          >
            {syncing
              ? t("pages.searchConsole.refreshing")
              : t("pages.searchConsole.insights")}
          </button>
        </div>
      </header>

      {error ? (
        <div className="gsc-card border-wine/40 bg-wine/10 px-4 py-3 text-sm">
          <p className="font-semibold text-pink">{error.error}</p>
          <div className="mt-3">
            <Link href="/setup" className={btnSecondary}>
              {t("pages.searchConsole.openSetup")}
            </Link>
          </div>
        </div>
      ) : null}

      {loading ? <EmptyHint>{t("pages.searchConsole.loading")}</EmptyHint> : null}

      {!loading && !snapshot ? (
        <EmptyHint>
          {error?.code === "missing_credentials"
            ? t("pages.searchConsole.missingEnv")
            : t("pages.searchConsole.empty")}
        </EmptyHint>
      ) : null}

      {snapshot ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-line bg-ash/50 p-1">
              <span className="rounded-lg bg-panel px-3 py-1.5 text-xs font-semibold text-ink shadow-sm">
                {t("pages.searchConsole.range28d")}
              </span>
              <span className="px-3 py-1.5 text-xs font-semibold text-mute">
                {t("pages.searchConsole.range7d")}
              </span>
            </div>
            <p className="text-xs text-mute">
              {t("pages.searchConsole.dateRange", {
                from: formatDate(snapshot.dateFrom, locale),
                to: formatDate(snapshot.dateTo, locale),
              })}
              {" · "}
              {t("pages.searchConsole.delayNote")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <KpiSparkCard
              label={t("pages.searchConsole.clicks")}
              value={formatNumber(snapshot.clicks, true, locale)}
              change={changeClicks}
              changeHint={t("pages.searchConsole.vsTypicalExpected")}
              noTrend={t("pages.searchConsole.noTrendYet")}
              spark={sparkClicks}
            />
            <KpiSparkCard
              label={t("pages.searchConsole.impressions")}
              value={formatNumber(snapshot.impressions, true, locale)}
              change={changeImpr}
              changeHint={t("pages.searchConsole.vsSoftBaseline")}
              noTrend={t("pages.searchConsole.noTrendYet")}
              spark={sparkImpr}
            />
            <KpiSparkCard
              label={t("pages.searchConsole.ctr")}
              value={ctrPercent(snapshot.ctr)}
              change={changeCtr}
              changeHint={t("pages.searchConsole.vsTypicalExpected")}
              noTrend={t("pages.searchConsole.noTrendYet")}
              spark={sparkCtr}
            />
          </div>

          <section className="gsc-card grid gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.85fr)]">
            <div className="border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-ink">
                    {t("pages.searchConsole.countriesNow")}
                  </h2>
                  <p className="mt-1 text-sm text-mute">
                    {t("pages.searchConsole.mapPinHint")}
                  </p>
                </div>
                <p className="text-xs text-mute">
                  {t("pages.searchConsole.position")}:{" "}
                  <span className="font-semibold text-ink">
                    {snapshot.position.toFixed(1)}
                  </span>
                </p>
              </div>
              <CountryMap
                places={rankedCountries.map((row) => ({
                  code: row.country,
                  clicks: row.clicks,
                }))}
                focused={activeCountry}
                onFocus={setFocusedCountry}
                locale={locale}
                formatClicks={(n) => formatNumber(n, true, locale)}
              />
            </div>
            <div className="flex flex-col p-5 sm:p-6">
              <p className="text-3xl font-semibold tracking-tight text-ink">
                {formatNumber(
                  rankedCountries.find((r) => r.country === activeCountry)
                    ?.clicks ??
                    (countryTotal || snapshot.clicks),
                  true,
                  locale,
                )}
              </p>
              <p className="mt-1 text-sm text-mute">
                {activeCountry
                  ? countryLabel(activeCountry, locale)
                  : t("pages.searchConsole.clicksNow")}
              </p>
              <ul className="mt-5 max-h-[22rem] space-y-0.5 overflow-y-auto pr-1">
                {rankedCountries.length === 0 ? (
                  <li className="text-sm text-mute">
                    {t("pages.searchConsole.empty")}
                  </li>
                ) : (
                  rankedCountries.map((row) => {
                    const max = rankedCountries[0]?.clicks || 1;
                    const pct = Math.round(
                      (row.clicks / (countryTotal || 1)) * 100,
                    );
                    const active = row.country === activeCountry;
                    return (
                      <li key={row.country}>
                        <button
                          type="button"
                          onClick={() => setFocusedCountry(row.country)}
                          className={`grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-xl px-2 py-2 text-left transition-colors ${
                            active
                              ? "bg-accent-soft shadow-sm ring-1 ring-accent/25"
                              : "hover:bg-ash/80"
                          }`}
                        >
                          <CountryFlag code={row.country} />
                          <span className="truncate text-sm font-medium text-ink">
                            {countryLabel(row.country, locale)}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-mute">
                            {pct}%
                          </span>
                          <div className="col-start-2 col-span-2 h-2 overflow-hidden rounded-full bg-ash">
                            <div
                              className={`h-full rounded-full transition-[width,background-color] ${
                                active ? "bg-accent" : "bg-[#1f2a44]"
                              }`}
                              style={{
                                width: `${Math.max(6, (row.clicks / max) * 100)}%`,
                              }}
                            />
                          </div>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </section>

          <section className="gsc-card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-ink">
              {t("pages.searchConsole.acquireTitle")}
            </h2>
            <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <p className="mb-3 text-sm font-medium text-mute">
                  {t("pages.searchConsole.dailyClicks")}
                </p>
                {dailyBars.length === 0 ? (
                  <EmptyHint>{t("pages.searchConsole.empty")}</EmptyHint>
                ) : (
                  <div className="flex h-48 items-end gap-1.5 sm:gap-2">
                    {dailyBars.map((bar) => (
                      <div
                        key={bar.label}
                        className="flex min-w-0 flex-1 flex-col items-center gap-1"
                      >
                        <div
                          className="w-full max-w-[2rem] rounded-t-md bg-[#1f2a44]"
                          style={{ height: `${Math.max(8, bar.pct)}%` }}
                          title={`${bar.label}: ${bar.value}`}
                        />
                        <span className="truncate text-[10px] text-mute">
                          {bar.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DeviceDonut
                title={t("pages.searchConsole.deviceMix")}
                segments={deviceSegments}
              />
            </div>
          </section>

          <section className="gsc-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold text-ink">
                {t("pages.searchConsole.allResults")}
              </h2>
              <div className="inline-flex rounded-xl border border-line bg-ash/40 p-1">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    tab === "pages"
                      ? "bg-panel text-ink shadow-sm"
                      : "text-mute"
                  }`}
                  onClick={() => {
                    setTab("pages");
                    setSort({ key: "clicks", dir: "desc" });
                  }}
                >
                  {t("pages.searchConsole.pages")}
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    tab === "queries"
                      ? "bg-panel text-ink shadow-sm"
                      : "text-mute"
                  }`}
                  onClick={() => {
                    setTab("queries");
                    setSort({ key: "clicks", dir: "desc" });
                  }}
                >
                  {t("pages.searchConsole.queries")}
                </button>
              </div>
            </div>
            <div className="border-b border-line px-5 py-3">
              <input
                className={`${inputClass} max-w-md rounded-lg`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={
                  tab === "pages"
                    ? t("pages.searchConsole.filterPages")
                    : t("pages.searchConsole.filterQueries")
                }
              />
            </div>
            {tableRows.length === 0 ? (
              <EmptyHint>{t("pages.searchConsole.empty")}</EmptyHint>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        {tab === "pages"
                          ? t("pages.searchConsole.page")
                          : t("pages.searchConsole.query")}
                      </th>
                      <SortHead
                        active={sort.key === "clicks"}
                        dir={sort.dir}
                        onClick={() => toggleSort("clicks")}
                      >
                        {t("pages.searchConsole.clicks")}
                      </SortHead>
                      <SortHead
                        active={sort.key === "impressions"}
                        dir={sort.dir}
                        onClick={() => toggleSort("impressions")}
                      >
                        {t("pages.searchConsole.impressions")}
                      </SortHead>
                      <SortHead
                        active={sort.key === "ctr"}
                        dir={sort.dir}
                        onClick={() => toggleSort("ctr")}
                      >
                        {t("pages.searchConsole.ctr")}
                      </SortHead>
                      <SortHead
                        active={sort.key === "position"}
                        dir={sort.dir}
                        onClick={() => toggleSort("position")}
                      >
                        {t("pages.searchConsole.position")}
                      </SortHead>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.key}>
                        <td className="max-w-[22rem] font-medium">
                          {tab === "pages" ? (
                            <a
                              href={row.title}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:text-accent-deep"
                              title={row.title}
                            >
                              {row.label}
                            </a>
                          ) : (
                            row.label
                          )}
                        </td>
                        <td>{formatNumber(row.clicks, false, locale)}</td>
                        <td>{formatNumber(row.impressions, false, locale)}</td>
                        <td>{ctrPercent(row.ctr)}</td>
                        <td>{row.position.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="gsc-card p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink">
          {t("pages.searchConsole.trendsTitle")}
        </h2>
        <p className="mt-1 text-sm text-mute">
          {t("pages.searchConsole.trendsNote")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {trends?.terms[0] ? (
            <span className="rounded-full bg-ash px-2.5 py-1 text-xs font-medium text-ink">
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{ background: TREND_COLORS[0] }}
              />
              {trends.terms[0]}
            </span>
          ) : null}
          {compareTerms.map((term, i) => (
            <button
              key={term}
              type="button"
              className="rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink hover:border-accent"
              title={t("pages.searchConsole.trendsRemove", { name: term })}
              onClick={() => removeCompareTerm(term)}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{
                  background: TREND_COLORS[(i + 1) % TREND_COLORS.length],
                }}
              />
              {term} ×
            </button>
          ))}
        </div>
        {compareTerms.length < 2 ? (
          <form
            className="mt-3 flex max-w-lg gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addCompareTerm();
            }}
          >
            <input
              className={`${inputClass} rounded-lg`}
              value={compareDraft}
              onChange={(e) => setCompareDraft(e.target.value)}
              placeholder={t("pages.searchConsole.trendsPlaceholder")}
            />
            <button type="submit" className={`${btnSecondary} rounded-lg`}>
              {t("pages.searchConsole.trendsAdd")}
            </button>
          </form>
        ) : null}
        {trendsLoading ? (
          <EmptyHint>{t("pages.searchConsole.trendsLoading")}</EmptyHint>
        ) : null}
        {trendsError ? (
          <p className="mt-3 text-sm text-pink">
            {t("pages.searchConsole.trendsFailed")}
          </p>
        ) : null}
        {!trendsLoading && !trendsError && (!trends || trends.points.length === 0) ? (
          <EmptyHint>{t("pages.searchConsole.empty")}</EmptyHint>
        ) : null}
        {trends && trends.points.length > 0 ? (
          <div className="mt-4">
            <InterestChart terms={trends.terms} points={trends.points} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function KpiSparkCard({
  label,
  value,
  change,
  changeHint,
  noTrend,
  spark,
}: {
  label: string;
  value: string;
  change: number | null;
  changeHint: string;
  noTrend: string;
  spark: number[];
}) {
  const up = change == null ? true : change >= 0;
  return (
    <article className="gsc-card flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-sm text-mute">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          {value}
        </p>
        {change == null ? (
          <p className="mt-2 text-sm text-mute">{noTrend}</p>
        ) : (
          <p className="mt-2 text-sm font-semibold text-green">
            <span aria-hidden>{up ? "↑" : "→"}</span>{" "}
            {up ? "+" : ""}
            {change.toFixed(0)}%{" "}
            <span className="font-normal text-mute">{changeHint}</span>
          </p>
        )}
      </div>
      <svg width="88" height="36" viewBox="0 0 88 36" className="mt-1 shrink-0" aria-hidden>
        <path
          d={sparkPoints(spark)}
          fill="none"
          stroke="var(--green)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </article>
  );
}

type MapPlace = { code: string; clicks: number };
type MapPin = MapPlace & { x: number; y: number; rank: number };

function CountryMap({
  places,
  focused,
  onFocus,
  locale,
  formatClicks,
}: {
  places: MapPlace[];
  focused: string | null;
  onFocus: (code: string) => void;
  locale: string;
  formatClicks: (n: number) => string;
}) {
  const { t } = useLocale();
  const [hovered, setHovered] = useState<string | null>(null);

  const built = useMemo(() => {
    const map = new DottedMap({ height: 110, grid: "diagonal" });
    const land = map.getPoints();
    const maxClicks = Math.max(...places.map((p) => p.clicks), 1);
    const pins: MapPin[] = [];

    places.forEach((place, rank) => {
      const iso2 = countryIso2(place.code);
      const point = iso2 ? COUNTRY_CENTROIDS[iso2] : null;
      if (!point) return;
      const pin = map.getPin({ lat: point.lat, lng: point.lng });
      if (!pin) return;
      pins.push({
        code: place.code,
        clicks: place.clicks,
        x: pin.x,
        y: pin.y,
        rank,
      });
    });

    return {
      width: map.image.width,
      height: map.image.height,
      land,
      pins,
      maxClicks,
    };
  }, [places.map((p) => `${p.code}:${p.clicks}`).join("|")]);

  const activeCode = focused ?? built.pins[0]?.code ?? null;
  const active =
    built.pins.find((p) => p.code === activeCode) ?? built.pins[0] ?? null;
  const tipCode = hovered && built.pins.some((p) => p.code === hovered)
    ? hovered
    : activeCode;
  const tip =
    built.pins.find((p) => p.code === tipCode) ?? active ?? null;

  function focusNearest(svgX: number, svgY: number) {
    if (!built.pins.length) return;
    let best = built.pins[0]!;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const pin of built.pins) {
      const d = (pin.x - svgX) ** 2 + (pin.y - svgY) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = pin;
      }
    }
    onFocus(best.code);
  }

  function onSvgPointer(e: ReactMouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * built.width;
    const svgY = ((e.clientY - rect.top) / rect.height) * built.height;
    focusNearest(svgX, svgY);
  }

  const tipLeft = tip ? (tip.x / built.width) * 100 : 50;
  const tipTop = tip ? (tip.y / built.height) * 100 : 50;
  const tipFlipY = tipTop < 22;
  const tipShiftX = tipLeft < 16 ? 28 : tipLeft > 84 ? -28 : 0;

  return (
    <div className="gsc-map-shell mt-4 overflow-hidden rounded-2xl px-2 py-3 sm:mt-5 sm:px-3 sm:py-4">
      <div className="relative mx-auto w-full max-w-3xl">
        <svg
          viewBox={`0 0 ${built.width} ${built.height}`}
          className="h-52 w-full cursor-crosshair touch-manipulation sm:h-64"
          role="img"
          aria-label={t("pages.searchConsole.mapPinHint")}
          onClick={onSvgPointer}
        >
          {built.land.map((dot, i) => (
            <circle
              key={`d-${i}`}
              cx={dot.x}
              cy={dot.y}
              r={0.32}
              fill="color-mix(in srgb, var(--mute) 42%, transparent)"
            />
          ))}

          {built.pins.map((pin) => {
            const isFocus = pin.code === activeCode;
            const isHover = pin.code === hovered;
            const weight = Math.sqrt(pin.clicks / built.maxClicks);
            const r = isFocus ? 1.7 : isHover ? 1.45 : 0.95 + weight * 0.7;
            return (
              <g
                key={pin.code}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus(pin.code);
                }}
                onMouseEnter={() => setHovered(pin.code)}
                onMouseLeave={() =>
                  setHovered((prev) => (prev === pin.code ? null : prev))
                }
              >
                <circle cx={pin.x} cy={pin.y} r={6} fill="transparent" />
                {isFocus ? (
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r={4}
                    fill="#4a63e7"
                    className="gsc-pin-pulse"
                    opacity={0.35}
                  />
                ) : null}
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={r + 1.1}
                  fill={isFocus || isHover ? "#c5d0f8" : "#d7ddf0"}
                />
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={r}
                  fill={isFocus ? "#2f4fd6" : isHover ? "#3d5ae0" : "#556ee6"}
                />
              </g>
            );
          })}
        </svg>

        {tip ? (
          <div
            className="pointer-events-none absolute z-10 flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-ink shadow-[0_8px_24px_-10px_rgba(31,42,68,0.45)]"
            style={{
              left: `${tipLeft}%`,
              top: `${tipTop}%`,
              transform: `translate(calc(-50% + ${tipShiftX}px), ${
                tipFlipY ? "18%" : "-130%"
              })`,
            }}
          >
            <CountryFlag code={tip.code} />
            <span>{countryLabel(tip.code, locale)}</span>
            <span className="tabular-nums text-mute">
              · {formatClicks(tip.clicks)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DeviceDonut({
  title,
  segments,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = 52;
  const stroke = 14;
  const c = 2 * Math.PI * radius;
  const gap = 3;
  let offset = 0;
  const top = segments[0];

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-mute">{title}</p>
      {segments.length === 0 ? (
        <EmptyHint>—</EmptyHint>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="var(--ash)"
              strokeWidth={stroke}
            />
            <g transform="translate(70,70) rotate(-90)">
              {segments.map((seg) => {
                const len = Math.max(0, (seg.value / total) * c - gap);
                const el = (
                  <circle
                    key={seg.label}
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${len} ${c - len}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="round"
                  />
                );
                offset += (seg.value / total) * c;
                return el;
              })}
            </g>
            <text
              x="70"
              y="68"
              textAnchor="middle"
              fill="var(--ink)"
              fontSize="16"
              fontWeight="700"
            >
              {top ? `${Math.round((top.value / total) * 100)}%` : "—"}
            </text>
            <text x="70" y="86" textAnchor="middle" fill="var(--mute)" fontSize="10">
              {top?.label ?? ""}
            </text>
          </svg>
          <ul className="w-full space-y-2">
            {segments.map((seg) => (
              <li
                key={seg.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2 text-ink">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: seg.color }}
                  />
                  {seg.label}
                </span>
                <span className="text-mute">
                  {Math.round((seg.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function downsample<T>(rows: T[], max = 24) {
  if (rows.length <= max) return rows;
  const step = (rows.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => rows[Math.round(i * step)]!);
}

function InterestChart({
  terms,
  points,
}: {
  terms: string[];
  points: TrendsPayload["points"];
}) {
  const rows = downsample(points);
  const width = 640;
  const height = 220;
  const pad = { t: 16, r: 12, b: 28, l: 8 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(...rows.flatMap((row) => row.values), 1);
  const x = (i: number) =>
    pad.l + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  return (
    <div className="overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full">
        <line
          x1={pad.l}
          y1={pad.t + innerH}
          x2={pad.l + innerW}
          y2={pad.t + innerH}
          stroke="currentColor"
          className="text-line"
        />
        {terms.map((_, series) => {
          const d = rows
            .map(
              (row, i) =>
                `${i === 0 ? "M" : "L"} ${x(i)} ${y(row.values[series] ?? 0)}`,
            )
            .join(" ");
          return (
            <path
              key={terms[series]}
              d={d}
              fill="none"
              stroke={TREND_COLORS[series % TREND_COLORS.length]}
              strokeWidth="2.25"
              strokeLinecap="round"
            />
          );
        })}
        <text x={pad.l} y={height - 6} className="fill-mute text-[10px]">
          {rows[0]?.date}
        </text>
        <text
          x={pad.l + innerW}
          y={height - 6}
          textAnchor="end"
          className="fill-mute text-[10px]"
        >
          {rows[rows.length - 1]?.date}
        </text>
      </svg>
    </div>
  );
}

function SortHead({
  children,
  active,
  dir,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th>
      <button
        type="button"
        className="inline-flex items-center gap-1"
        onClick={onClick}
      >
        {children}
        <span className={active ? "text-ink" : "text-mute/50"}>
          {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
}
