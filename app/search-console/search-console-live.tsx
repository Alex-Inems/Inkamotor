"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { btnPrimary, btnSecondary, inputClass } from "@/components/modal";
import { EmptyHint, KpiCard, PageHeader, Panel } from "@/components/ui";
import type { ApiErrorBody, GscPayload, TrendsPayload } from "@/lib/ads/gsc-types";
import { compareClickRate, type BenchmarkTone } from "@/lib/ads/search-benchmarks";
import { useCrm } from "@/lib/crm-store";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

type TableTab = "pages" | "queries";
type SortKey = "clicks" | "impressions" | "ctr" | "position";

const TRENDS_STORAGE = "inkamoto-trends-compare";
const TREND_COLORS = ["#d0ad74", "#e1736c", "#ecbb5a"];

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

export default function SearchConsoleLivePage() {
  const { t, locale } = useLocale();
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
  const home = t("pages.searchConsole.homePage");
  const benchmark = snapshot
    ? compareClickRate(snapshot.ctr, snapshot.position)
    : null;

  const mostVisits = useMemo(() => topBy(pages, (row) => row.clicks), [pages]);
  const topSearches = useMemo(
    () => topBy(queries, (row) => row.clicks),
    [queries],
  );

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

  const ctrHint = benchmark
    ? t(`pages.searchConsole.vsTypical${hintKey(benchmark.tone)}Hint`)
    : t("pages.searchConsole.clickRateHint");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("pages.searchConsole.title")}
        description={t("pages.searchConsole.description")}
        action={
          <button
            type="button"
            className={btnPrimary}
            disabled={syncing || loading}
            onClick={() => void refresh()}
          >
            {syncing
              ? t("pages.searchConsole.refreshing")
              : t("pages.searchConsole.refresh")}
          </button>
        }
      />

      {error ? (
        <div className="border border-wine/40 bg-wine/10 px-4 py-3 text-sm">
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

      {snapshot && benchmark ? (
        <>
          <p className="text-sm text-mute">
            {t("pages.searchConsole.dateRange", {
              from: formatDate(snapshot.dateFrom, locale),
              to: formatDate(snapshot.dateTo, locale),
            })}
            {" · "}
            {t("pages.searchConsole.delayNote")}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={t("pages.searchConsole.clicks")}
              value={formatNumber(snapshot.clicks, true, locale)}
              hint={t("pages.searchConsole.visitsHint")}
            />
            <KpiCard
              label={t("pages.searchConsole.impressions")}
              value={formatNumber(snapshot.impressions, true, locale)}
              hint={t("pages.searchConsole.shownHint")}
            />
            <KpiCard
              label={t("pages.searchConsole.ctr")}
              value={ctrPercent(snapshot.ctr)}
              hint={ctrHint}
            />
            <KpiCard
              label={t("pages.searchConsole.position")}
              value={snapshot.position.toFixed(1)}
              hint={t("pages.searchConsole.rankHint")}
            />
          </div>

          <Panel title={t("pages.searchConsole.vsTypicalTitle")}>
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-ink">
                {t("pages.searchConsole.vsTypicalBody", {
                  rank: snapshot.position.toFixed(1),
                  typical: ctrPercent(benchmark.typical),
                  actual: ctrPercent(snapshot.ctr),
                })}
              </p>
              <p className="text-sm font-medium text-sand">
                {t(`pages.searchConsole.vsTypical${hintKey(benchmark.tone)}`)}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat
                  label={t("pages.searchConsole.vsTypicalRank")}
                  value={snapshot.position.toFixed(1)}
                />
                <MiniStat
                  label={t("pages.searchConsole.vsTypicalExpected")}
                  value={ctrPercent(benchmark.typical)}
                />
                <MiniStat
                  label={t("pages.searchConsole.vsTypicalYours")}
                  value={ctrPercent(snapshot.ctr)}
                />
              </div>
              <p className="text-xs text-mute">
                {t("pages.searchConsole.vsTypicalNote")}
              </p>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <SimpleList
              title={t("pages.searchConsole.mostClicks")}
              empty={t("pages.searchConsole.empty")}
              rows={mostVisits.map((row) => ({
                key: row.page,
                label: pageLabel(row.page, home),
                href: row.page,
                value: t("pages.searchConsole.visitCount", {
                  n: formatNumber(row.clicks, false, locale),
                }),
                bar: row.clicks,
              }))}
            />
            <SimpleList
              title={t("pages.searchConsole.topQueries")}
              empty={t("pages.searchConsole.empty")}
              rows={topSearches.map((row) => ({
                key: row.query,
                label: row.query,
                value: t("pages.searchConsole.visitCount", {
                  n: formatNumber(row.clicks, false, locale),
                }),
                bar: row.clicks,
              }))}
            />
          </div>

          <Panel
            title={t("pages.searchConsole.allResults")}
            action={
              <div className="flex gap-1">
                <button
                  type="button"
                  className={tab === "pages" ? btnPrimary : btnSecondary}
                  onClick={() => {
                    setTab("pages");
                    setSort({ key: "clicks", dir: "desc" });
                  }}
                >
                  {t("pages.searchConsole.pages")}
                </button>
                <button
                  type="button"
                  className={tab === "queries" ? btnPrimary : btnSecondary}
                  onClick={() => {
                    setTab("queries");
                    setSort({ key: "clicks", dir: "desc" });
                  }}
                >
                  {t("pages.searchConsole.queries")}
                </button>
              </div>
            }
          >
            <div className="border-b border-line px-4 py-3">
              <input
                className={`${inputClass} max-w-md`}
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
                              className="text-sand hover:text-gold"
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
          </Panel>
        </>
      ) : null}

      <Panel title={t("pages.searchConsole.trendsTitle")}>
        <div className="space-y-4">
          <p className="text-sm text-mute">{t("pages.searchConsole.trendsNote")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {trends?.terms[0] ? (
              <span className="border border-line bg-ash px-2 py-1 text-xs font-medium text-sand">
                {trends.terms[0]}
              </span>
            ) : null}
            {compareTerms.map((term, i) => (
              <button
                key={term}
                type="button"
                className="border border-line bg-ash px-2 py-1 text-xs font-medium text-ink hover:border-gold"
                title={t("pages.searchConsole.trendsRemove", { name: term })}
                onClick={() => removeCompareTerm(term)}
              >
                <span
                  className="mr-1.5 inline-block h-2 w-2"
                  style={{ background: TREND_COLORS[(i + 1) % TREND_COLORS.length] }}
                />
                {term} ×
              </button>
            ))}
          </div>
          {compareTerms.length < 2 ? (
            <form
              className="flex max-w-lg gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addCompareTerm();
              }}
            >
              <input
                className={inputClass}
                value={compareDraft}
                onChange={(e) => setCompareDraft(e.target.value)}
                placeholder={t("pages.searchConsole.trendsPlaceholder")}
              />
              <button type="submit" className={btnSecondary}>
                {t("pages.searchConsole.trendsAdd")}
              </button>
            </form>
          ) : null}
          {trendsLoading ? (
            <EmptyHint>{t("pages.searchConsole.trendsLoading")}</EmptyHint>
          ) : null}
          {trendsError ? (
            <p className="text-sm text-pink">{t("pages.searchConsole.trendsFailed")}</p>
          ) : null}
          {!trendsLoading && !trendsError && (!trends || trends.points.length === 0) ? (
            <EmptyHint>{t("pages.searchConsole.trendsEmpty")}</EmptyHint>
          ) : null}
          {trends && trends.points.length > 0 ? (
            <>
              <InterestChart terms={trends.terms} points={trends.points} />
              {trends.averages.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {trends.terms.map((term, i) => (
                    <MiniStat
                      key={term}
                      label={term}
                      value={String(Math.round(trends.averages[i] ?? 0))}
                      color={TREND_COLORS[i % TREND_COLORS.length]}
                    />
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-mute">
                {t("pages.searchConsole.trendsAverage")}
              </p>
            </>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function hintKey(tone: BenchmarkTone) {
  return tone === "better" ? "Better" : tone === "below" ? "Below" : "Typical";
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="border border-line bg-ash px-3 py-3">
      <p className="text-xs font-medium text-mute">
        {color ? (
          <span
            className="mr-1.5 inline-block h-2 w-2 align-middle"
            style={{ background: color }}
          />
        ) : null}
        {label}
      </p>
      <p className="mt-1 font-display text-xl text-ink">{value}</p>
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
            .map((row, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(row.values[series] ?? 0)}`)
            .join(" ");
          return (
            <path
              key={terms[series]}
              d={d}
              fill="none"
              stroke={TREND_COLORS[series % TREND_COLORS.length]}
              strokeWidth="2"
            />
          );
        })}
        <text
          x={pad.l}
          y={height - 6}
          className="fill-mute text-[10px]"
        >
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
      <button type="button" className="inline-flex items-center gap-1" onClick={onClick}>
        {children}
        <span className={active ? "text-ink" : "text-mute/50"}>
          {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
}

function SimpleList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{
    key: string;
    label: string;
    href?: string;
    value: string;
    bar: number;
  }>;
}) {
  const max = Math.max(...rows.map((row) => row.bar), 1);

  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <EmptyHint>{empty}</EmptyHint>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((row, i) => (
            <li key={row.key} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-right font-display text-sm text-mute">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {row.href ? (
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-medium text-sand hover:text-gold"
                    >
                      {row.label}
                    </a>
                  ) : (
                    <p className="truncate font-medium">{row.label}</p>
                  )}
                  <div className="mt-2 h-1.5 overflow-hidden bg-ash">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${(row.bar / max) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="shrink-0 text-sm text-mute">{row.value}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
