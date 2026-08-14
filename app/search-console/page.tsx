"use client";

import { useCallback, useEffect, useState } from "react";
import { LineChart } from "@/components/charts";
import { btnPrimary } from "@/components/modal";
import { EmptyHint, KpiCard, PageHeader, Panel } from "@/components/ui";
import type { ApiErrorBody, GscPayload } from "@/lib/ads/gsc-types";
import { useCrm } from "@/lib/crm-store";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

function ctrPercent(n: number) {
  return formatPercent(n * 100, 2);
}

export default function SearchConsolePage() {
  const { t, locale } = useLocale();
  const { pushToast } = useCrm();
  const [data, setData] = useState<GscPayload | null>(null);
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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

  return (
    <div>
      <PageHeader
        title={t("pages.searchConsole.title")}
        description={t("pages.searchConsole.description")}
        action={
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
        </div>
      ) : null}

      {loading ? (
        <EmptyHint>{t("pages.searchConsole.loading")}</EmptyHint>
      ) : null}

      {!loading && !snapshot ? (
        <EmptyHint>
          {error?.code === "missing_credentials"
            ? t("pages.searchConsole.missingEnv")
            : t("pages.searchConsole.empty")}
        </EmptyHint>
      ) : null}

      {snapshot ? (
        <>
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

          {data && data.daily.length > 0 ? (
            <div className="mt-4">
              <LineChart
                title={t("pages.searchConsole.daily")}
                aLabel={t("pages.searchConsole.clicks")}
                bLabel={t("pages.searchConsole.impressions")}
                formatA={(n) => formatNumber(n, true, locale)}
                formatB={(n) => formatNumber(n, true, locale)}
                points={data.daily.map((row) => ({
                  label: row.date.slice(5),
                  a: row.clicks,
                  b: row.impressions,
                }))}
              />
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                      {data.queries.map((row) => (
                        <tr key={row.query}>
                          <td className="max-w-[16rem] truncate font-medium" title={row.query}>
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
                      {data.pages.map((row) => (
                        <tr key={row.page}>
                          <td className="max-w-[16rem] truncate font-medium" title={row.page}>
                            {row.page.replace(/^https?:\/\/[^/]+/i, "") || row.page}
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
        </>
      ) : null}
    </div>
  );
}
