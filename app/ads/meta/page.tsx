"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ConversionFunnel, GroupedBarChart } from "@/components/charts";
import { btnGhost, btnSecondary, inputClass } from "@/components/modal";
import { EmptyHint, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import {
  campaignConvRate,
  conversionLevel,
  summarizeCampaigns,
  type AdStatus,
} from "@/lib/demo-data";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { adTone } from "@/lib/status";
import { useLocale } from "@/lib/i18n";

export default function MetaAdsPage() {
  const { metaCampaigns, setCampaignStatus, pushToast } = useCrm();
  const { t } = useLocale();
  const [status, setStatus] = useState<AdStatus | "all">("all");
  const [query, setQuery] = useState("");
  const summary = summarizeCampaigns(metaCampaigns);
  const level = conversionLevel(summary.cvr);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return metaCampaigns.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return `${c.name} ${c.objective}`.toLowerCase().includes(q);
    });
  }, [metaCampaigns, status, query]);

  return (
    <div>
      <PageHeader
        title={t("pages.metaAds.title")}
        description={t("pages.metaAds.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/analytics" className={btnSecondary}>
              {t("pages.metaAds.fullAnalytics")}
            </Link>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => pushToast(t("pages.metaAds.synced"))}
            >
              {t("pages.metaAds.sync")}
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Campaigns"
          value={formatNumber(summary.campaigns)}
          hint={`${summary.active} active`}
        />
        <KpiCard
          label="Impressions"
          value={formatNumber(summary.impressions, true)}
        />
        <KpiCard
          label="Clicks"
          value={formatNumber(summary.clicks)}
          hint={`CTR ${formatPercent(summary.ctr, 2)}`}
        />
        <KpiCard
          label="Conversions"
          value={formatNumber(summary.conversions)}
          hint={
            <>
              CVR {formatPercent(summary.cvr, 2)} ·{" "}
              <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
            </>
          }
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Spend" value={formatMoney(summary.spend, "USD", true)} />
        <KpiCard label="Avg CPC" value={formatMoney(summary.cpc, "USD")} />
        <KpiCard label="Avg CPA" value={formatMoney(summary.cpa, "USD")} />
        <KpiCard label="Avg ROAS" value={`${summary.avgRoas.toFixed(1)}x`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ConversionFunnel
          title="Meta conversion funnel"
          impressions={summary.impressions}
          clicks={summary.clicks}
          conversions={summary.conversions}
        />
        <GroupedBarChart
          title="Campaign clicks & conversions"
          aLabel="Clicks"
          bLabel="Conv. ×15"
          points={[...metaCampaigns]
            .sort((a, b) => b.clicks - a.clicks)
            .map((c) => ({
              label: c.name
                .replace(/^Prospecting — |^Retarget — |^Awareness — |^Leads — /i, "")
                .slice(0, 14),
              a: c.clicks,
              b: c.conversions * 15,
            }))}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Search campaigns…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={inputClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as AdStatus | "all")}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </select>
      </div>

      <div className="mt-4">
        <Panel title={`${filtered.length} campaigns`}>
          {filtered.length === 0 ? (
            <EmptyHint>No campaigns match these filters.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th>Impr.</th>
                    <th>Clicks</th>
                    <th>CTR</th>
                    <th>Conv.</th>
                    <th>CVR</th>
                    <th>Level</th>
                    <th>Spend</th>
                    <th>ROAS</th>
                    <th>Dates</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const cvr = campaignConvRate(c);
                    const lvl = conversionLevel(cvr);
                    return (
                      <tr key={c.id}>
                        <td>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-mute">{c.objective}</p>
                        </td>
                        <td>
                          <StatusBadge tone={adTone(c.status)}>{c.status}</StatusBadge>
                        </td>
                        <td>{formatNumber(c.impressions, true)}</td>
                        <td>{formatNumber(c.clicks)}</td>
                        <td>{formatPercent(c.ctr, 2)}</td>
                        <td className="font-medium">{c.conversions}</td>
                        <td>{formatPercent(cvr, 2)}</td>
                        <td>
                          <StatusBadge tone={lvl.tone}>{lvl.label}</StatusBadge>
                        </td>
                        <td className="whitespace-nowrap">
                          {formatMoney(c.spend, "USD", true)}
                        </td>
                        <td className="font-medium">{c.roas.toFixed(1)}x</td>
                        <td className="whitespace-nowrap text-mute">
                          {formatDate(c.startDate)}
                          {c.endDate ? ` – ${formatDate(c.endDate)}` : " – ongoing"}
                        </td>
                        <td>
                          {c.status === "ended" ? null : (
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() =>
                                setCampaignStatus(
                                  "meta",
                                  c.id,
                                  c.status === "active" ? "paused" : "active",
                                )
                              }
                            >
                              {c.status === "active" ? "Pause" : "Activate"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
