"use client";

import Link from "next/link";
import {
  ConversionFunnel,
  GroupedBarChart,
  LineChart,
} from "@/components/charts";
import { KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import {
  campaignConvRate,
  conversionLevel,
  summarizeCampaigns,
  type AdCampaign,
} from "@/lib/demo-data";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { adTone } from "@/lib/status";
import { useT } from "@/lib/i18n";

export function PlatformAnalytics({
  title,
  href,
  campaigns,
  accent = "accent",
}: {
  title: string;
  href: string;
  campaigns: AdCampaign[];
  accent?: "accent" | "pink";
}) {
  const t = useT();
  const s = summarizeCampaigns(campaigns);
  const level = conversionLevel(s.cvr);
  const levelLabel = t(`ads.${level.key}`);
  const sorted = [...campaigns].sort((a, b) => b.conversions - a.conversions);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-mute">
            {t("ads.campaignsActive", {
              campaigns: s.campaigns,
              active: s.active,
            })}{" "}
            <StatusBadge tone={level.tone}>
              {levelLabel}
              {t("ads.conversionSuffix")}
            </StatusBadge>
          </p>
        </div>
        <Link
          href={href}
          className="text-xs font-semibold text-sand hover:text-gold"
        >
          {t("ads.manage")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("ads.impressions")}
          value={formatNumber(s.impressions, true)}
          hint={t("ads.campaignsHint", { n: s.campaigns })}
        />
        <KpiCard
          label={t("ads.clicks")}
          value={formatNumber(s.clicks, true)}
          hint={t("ads.ctrHint", { ctr: formatPercent(s.ctr, 2) })}
        />
        <KpiCard
          label={t("ads.conversions")}
          value={formatNumber(s.conversions)}
          hint={t("ads.cvrHint", {
            cvr: formatPercent(s.cvr, 2),
            level: levelLabel,
          })}
        />
        <KpiCard
          label={t("ads.spend")}
          value={formatMoney(s.spend, "USD", true)}
          hint={t("ads.spendHint", {
            cpc: formatMoney(s.cpc, "USD"),
            cpa: formatMoney(s.cpa, "USD"),
          })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConversionFunnel
          title={t("ads.funnel", { title })}
          impressions={s.impressions}
          clicks={s.clicks}
          conversions={s.conversions}
        />
        <GroupedBarChart
          title={t("ads.perCampaign")}
          aLabel={t("ads.imprDiv")}
          bLabel={t("ads.clicks")}
          cLabel={t("ads.convTimes")}
          points={sorted.map((c) => ({
            label: c.name
              .replace(
                /^(Search|Display|Prospecting|Retarget|Awareness|Leads|Performance Max) — /i,
                "",
              )
              .slice(0, 16),
            a: c.impressions / 50,
            b: c.clicks,
            c: c.conversions * 15,
          }))}
        />
      </div>

      <Panel title={t("ads.performance")}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("common.campaign")}</th>
                <th>{t("common.status")}</th>
                <th>{t("ads.impr")}</th>
                <th>{t("ads.clicks")}</th>
                <th>{t("pages.searchConsole.ctr")}</th>
                <th>{t("ads.conv")}</th>
                <th>{t("ads.cvr")}</th>
                <th>{t("ads.level")}</th>
                <th>{t("ads.spendCol")}</th>
                <th>{t("ads.roas")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const cvr = campaignConvRate(c);
                const lvl = conversionLevel(cvr);
                return (
                  <tr key={c.id}>
                    <td>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-mute">{c.objective}</p>
                    </td>
                    <td>
                      <StatusBadge tone={adTone(c.status)}>
                        {t(`status.${c.status}`)}
                      </StatusBadge>
                    </td>
                    <td>{formatNumber(c.impressions, true)}</td>
                    <td>{formatNumber(c.clicks)}</td>
                    <td>{formatPercent(c.ctr, 2)}</td>
                    <td className="font-medium">{c.conversions}</td>
                    <td>{formatPercent(cvr, 2)}</td>
                    <td>
                      <StatusBadge tone={lvl.tone}>{t(`ads.${lvl.key}`)}</StatusBadge>
                    </td>
                    <td className="whitespace-nowrap">
                      {formatMoney(c.spend, "USD", true)}
                    </td>
                    <td className="font-medium">{c.roas.toFixed(1)}x</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="sr-only">{accent}</p>
    </section>
  );
}

export function AnalyticsOverviewCharts({
  meta,
}: {
  meta: AdCampaign[];
}) {
  const t = useT();
  const sorted = [...meta].sort((a, b) => b.clicks - a.clicks);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LineChart
        title={t("ads.metaClicks")}
        aLabel={t("ads.clicks")}
        bLabel={t("ads.conversions")}
        formatA={(n) => formatNumber(n, true)}
        formatB={(n) => formatNumber(n)}
        points={sorted.slice(0, 6).map((c) => ({
          label: c.name
            .replace(/^(Prospecting|Retarget|Awareness|Leads) — /i, "")
            .slice(0, 14),
          a: c.clicks,
          b: c.conversions,
        }))}
      />
      <GroupedBarChart
        title={t("ads.metaMix")}
        aLabel={t("ads.clicks")}
        bLabel={t("ads.convTimes15")}
        cLabel={t("ads.spendDiv")}
        points={sorted.slice(0, 6).map((c) => ({
          label: c.name
            .replace(/^(Prospecting|Retarget|Awareness|Leads) — /i, "")
            .slice(0, 14),
          a: c.clicks,
          b: c.conversions * 15,
          c: c.spend / 2,
        }))}
      />
    </div>
  );
}
