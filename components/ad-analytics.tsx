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
  const s = summarizeCampaigns(campaigns);
  const level = conversionLevel(s.cvr);
  const sorted = [...campaigns].sort((a, b) => b.conversions - a.conversions);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-mute">
            {s.campaigns} campaigns · {s.active} active ·{" "}
            <StatusBadge tone={level.tone}>{level.label} conversion</StatusBadge>
          </p>
        </div>
        <Link
          href={href}
          className="text-xs font-semibold text-sand hover:text-gold"
        >
          Manage campaigns
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Impressions"
          value={formatNumber(s.impressions, true)}
          hint={`${formatNumber(s.campaigns)} campaigns`}
        />
        <KpiCard
          label="Clicks"
          value={formatNumber(s.clicks, true)}
          hint={`CTR ${formatPercent(s.ctr, 2)}`}
        />
        <KpiCard
          label="Conversions"
          value={formatNumber(s.conversions)}
          hint={`CVR ${formatPercent(s.cvr, 2)} · ${level.label}`}
        />
        <KpiCard
          label="Spend"
          value={formatMoney(s.spend, "USD", true)}
          hint={`CPC ${formatMoney(s.cpc, "USD")} · CPA ${formatMoney(s.cpa, "USD")}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConversionFunnel
          title={`${title} conversion funnel`}
          impressions={s.impressions}
          clicks={s.clicks}
          conversions={s.conversions}
        />
        <GroupedBarChart
          title="Per campaign — impressions, clicks, conversions"
          aLabel="Impr. ÷50"
          bLabel="Clicks"
          cLabel="Conv. ×15"
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

      <Panel title="Campaign performance">
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
  const sorted = [...meta].sort((a, b) => b.clicks - a.clicks);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LineChart
        title="Meta Ads — clicks & conversions"
        aLabel="Clicks"
        bLabel="Conversions"
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
        title="Meta campaign mix"
        aLabel="Clicks"
        bLabel="Conversions ×15"
        cLabel="Spend ÷2"
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
