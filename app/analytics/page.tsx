"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnalyticsOverviewCharts, PlatformAnalytics } from "@/components/ad-analytics";
import { LineChart } from "@/components/charts";
import { btnPrimary, btnSecondary } from "@/components/modal";
import { EmptyHint, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import type { ApiErrorBody, GscPayload } from "@/lib/ads/gsc-types";
import { useCrm } from "@/lib/crm-store";
import { summarizeCampaigns } from "@/lib/demo-data";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

function ctrPercent(n: number) {
  return formatPercent(n * 100, 2);
}

export default function AnalyticsPage() {
  const { metaCampaigns, pushToast } = useCrm();
  const { t, locale } = useLocale();
  const [data, setData] = useState<GscPayload | null>(null);
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const meta = summarizeCampaigns(metaCampaigns);

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
  const lastSynced = snapshot?.syncedAt
    ? t("pages.searchConsole.lastSynced", {
        time: formatDate(snapshot.syncedAt, locale),
      })
    : t("pages.searchConsole.neverSynced");

  const dailyPoints = useMemo(
    () =>
      (data?.daily ?? []).map((row) => ({
        label: row.date.slice(5),
        a: row.clicks,
        b: row.impressions,
      })),
    [data?.daily],
  );

  return (
    <div>
      <PageHeader
        title={t("pages.analytics.title")}
        description={t("pages.analytics.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/search-console" className={btnSecondary}>
              {t("pages.analytics.openSearchConsole")}
            </Link>
            <button
              type="button"
              className={btnPrimary}
              disabled={syncing}
              onClick={() => void refresh()}
            >
              {syncing
                ? t("pages.searchConsole.refreshing")
                : t("pages.searchConsole.refresh")}
            </button>
          </div>
        }
      />

      <p className="mb-4 text-sm text-mute">
        {lastSynced}
        {snapshot
          ? ` · ${t("pages.searchConsole.dateRange", {
              from: formatDate(snapshot.dateFrom, locale),
              to: formatDate(snapshot.dateTo, locale),
            })}`
          : null}{" "}
        · {t("pages.searchConsole.delayNote")}
      </p>

      {error ? (
        <div className="mb-4 border border-wine/40 bg-wine/10 px-4 py-3 text-sm">
          <p className="font-semibold text-pink">{error.error}</p>
          {error.missing && error.missing.length > 0 ? (
            <p className="mt-1 text-mute">{error.missing.join(", ")}</p>
          ) : null}
          <p className="mt-2 text-mute">
            <Link href="/setup" className="text-sand hover:text-gold">
              {t("pages.analytics.openSetup")}
            </Link>
          </p>
        </div>
      ) : null}

      {loading ? <EmptyHint>{t("pages.analytics.loading")}</EmptyHint> : null}

      {!loading && !snapshot ? (
        <EmptyHint>
          {error?.code === "missing_credentials"
            ? t("pages.searchConsole.missingEnv")
            : t("pages.searchConsole.empty")}
        </EmptyHint>
      ) : null}

      {snapshot ? (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold">
                {t("pages.analytics.organic")}
              </h2>
              <StatusBadge tone="success">Live</StatusBadge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label={t("pages.searchConsole.clicks")}
                value={formatNumber(snapshot.clicks, true, locale)}
              />
              <KpiCard
                label={t("pages.searchConsole.impressions")}
                value={formatNumber(snapshot.impressions, true, locale)}
              />
              <KpiCard
                label={t("pages.searchConsole.ctr")}
                value={ctrPercent(snapshot.ctr)}
              />
              <KpiCard
                label={t("pages.searchConsole.position")}
                value={snapshot.position.toFixed(1)}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {dailyPoints.length > 0 ? (
              <LineChart
                title={t("pages.searchConsole.daily")}
                aLabel={t("pages.searchConsole.clicks")}
                bLabel={t("pages.searchConsole.impressions")}
                formatA={(n) => formatNumber(n, true, locale)}
                formatB={(n) => formatNumber(n, true, locale)}
                points={dailyPoints}
              />
            ) : (
              <EmptyHint>{t("pages.searchConsole.empty")}</EmptyHint>
            )}
            <Panel title={t("pages.analytics.organicSummary")}>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-mute">{t("pages.searchConsole.clicks")}</dt>
                  <dd className="font-semibold">
                    {formatNumber(snapshot.clicks, true, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-mute">
                    {t("pages.searchConsole.impressions")}
                  </dt>
                  <dd className="font-semibold">
                    {formatNumber(snapshot.impressions, true, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-mute">{t("pages.searchConsole.ctr")}</dt>
                  <dd className="font-semibold">{ctrPercent(snapshot.ctr)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-mute">
                    {t("pages.searchConsole.position")}
                  </dt>
                  <dd className="font-semibold">
                    {snapshot.position.toFixed(1)}
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("pages.searchConsole.topQueries")}>
              {!data || data.queries.length === 0 ? (
                <EmptyHint>{t("pages.searchConsole.empty")}</EmptyHint>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("pages.searchConsole.query")}</th>
                        <th>{t("pages.searchConsole.clicks")}</th>
                        <th>{t("pages.searchConsole.impressions")}</th>
                        <th>{t("pages.searchConsole.ctr")}</th>
                        <th>{t("pages.searchConsole.position")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.queries.slice(0, 10).map((row) => (
                        <tr key={row.query}>
                          <td
                            className="max-w-[16rem] truncate font-medium"
                            title={row.query}
                          >
                            {row.query}
                          </td>
                          <td>{formatNumber(row.clicks, false, locale)}</td>
                          <td>{formatNumber(row.impressions, true, locale)}</td>
                          <td>{ctrPercent(row.ctr)}</td>
                          <td>{row.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title={t("pages.searchConsole.topPages")}>
              {!data || data.pages.length === 0 ? (
                <EmptyHint>{t("pages.searchConsole.empty")}</EmptyHint>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("pages.searchConsole.page")}</th>
                        <th>{t("pages.searchConsole.clicks")}</th>
                        <th>{t("pages.searchConsole.impressions")}</th>
                        <th>{t("pages.searchConsole.ctr")}</th>
                        <th>{t("pages.searchConsole.position")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pages.slice(0, 10).map((row) => (
                        <tr key={row.page}>
                          <td
                            className="max-w-[16rem] truncate font-medium"
                            title={row.page}
                          >
                            {row.page.replace(/^https?:\/\/[^/]+/i, "") ||
                              row.page}
                          </td>
                          <td>{formatNumber(row.clicks, false, locale)}</td>
                          <td>{formatNumber(row.impressions, true, locale)}</td>
                          <td>{ctrPercent(row.ctr)}</td>
                          <td>{row.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      <div className="mt-10 space-y-4 border-t border-line pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold">
            {t("pages.analytics.metaAds")}
          </h2>
          <StatusBadge tone="warning">{t("pages.analytics.demoBadge")}</StatusBadge>
        </div>
        <p className="text-sm text-mute">{t("pages.analytics.metaDemoNote")}</p>
        <AnalyticsOverviewCharts meta={metaCampaigns} />
        <PlatformAnalytics
          title={t("pages.analytics.metaAds")}
          href="/ads/meta"
          campaigns={metaCampaigns}
          accent="pink"
        />
        <p className="text-xs text-mute">
          {t("pages.analytics.metaSummary", {
            campaigns: meta.campaigns,
            active: meta.active,
          })}
        </p>
      </div>
    </div>
  );
}
