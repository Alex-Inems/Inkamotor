"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart, DonutChart, LineChart } from "@/components/charts";
import { EmptyHint, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import {
  getDashboardStats,
  invoiceTotal,
  type Lead,
  type Sale,
} from "@/lib/demo-data";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useSessionUser } from "@/lib/session-user";
import { invoiceTone, leadTone } from "@/lib/status";
import { localeMeta, useLocale } from "@/lib/i18n";

type OverviewMail = {
  id: string;
  fromName: string | null;
  fromEmail: string;
  subject: string;
  isRead: boolean;
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string, locale: string) {
  const [y, m] = key.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return d.toLocaleString(locale, { month: "short" });
}

function buildSeries(leads: Lead[], sales: Sale[], locale: string) {
  const map = new Map<
    string,
    { revenue: number; leads: number; adSpend: number; subscribers: number }
  >();
  for (const sale of sales) {
    const key = monthKey(sale.createdAt);
    const row = map.get(key) ?? {
      revenue: 0,
      leads: 0,
      adSpend: 0,
      subscribers: 0,
    };
    if (sale.status !== "cancelled") row.revenue += sale.amount;
    map.set(key, row);
  }
  for (const lead of leads) {
    const key = monthKey(lead.createdAt);
    const row = map.get(key) ?? {
      revenue: 0,
      leads: 0,
      adSpend: 0,
      subscribers: 0,
    };
    row.leads += 1;
    map.set(key, row);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, row]) => ({
      label: monthLabel(key, locale),
      ...row,
    }));
}

function buildChannelMix(
  leads: Lead[],
  sourceLabel: (source: string) => string,
) {
  const colors: Record<string, string> = {
    google: "#31595d",
    meta: "#e1736c",
    website: "#624e8a",
    organic: "#65814f",
    referral: "#ecbb5a",
    manual: "#d0ad74",
  };
  const counts = new Map<string, number>();
  for (const lead of leads) {
    counts.set(lead.source, (counts.get(lead.source) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return [...counts.entries()].map(([source, n]) => ({
    label: sourceLabel(source),
    value: Math.round((n / total) * 100),
    color: colors[source] ?? "#b8b3a8",
  }));
}

export default function OverviewPage() {
  const {
    leads,
    metaCampaigns,
    invoices,
    newsletters,
    siteInquiries,
    followUps,
    sales,
    ready,
    loadError,
  } = useCrm();
  const { t, locale } = useLocale();
  const currentUser = useSessionUser();
  const [mail, setMail] = useState<OverviewMail[]>([]);
  const hello = `${t("greet.hello")}, ${currentUser.firstName}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/inbox/mail?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((json: { messages?: OverviewMail[] }) => {
        if (!cancelled) setMail(json.messages ?? []);
      })
      .catch(() => {
        /* inbox may not be configured yet */
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const stats = getDashboardStats({
    leads,
    googleCampaigns: [],
    metaCampaigns,
    invoices,
    newsletters,
    siteInquiries,
    followUps,
    sales,
  });

  const analyticsSeries = useMemo(
    () => buildSeries(leads, sales, localeMeta[locale].bcp47),
    [leads, sales, locale],
  );
  const channelMix = useMemo(
    () =>
      buildChannelMix(leads, (source) => {
        const key = `sources.${source}`;
        const label = t(key);
        return label === key ? source : label;
      }),
    [leads, t],
  );

  const money = (n: number, compact = true) =>
    formatMoney(n, "USD", compact, locale);
  const num = (n: number, compact = false) => formatNumber(n, compact, locale);
  const recentLeads = [...leads]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const recentMail = mail.slice(0, 4);
  const recentInvoices = [...invoices].slice(0, 4);

  if (!ready) {
    return <EmptyHint>{t("common.loadingWorkspace")}</EmptyHint>;
  }

  if (loadError) {
    return (
      <div className="border border-wine/40 bg-wine/10 px-4 py-3 text-sm">
        <p className="font-semibold text-pink">{loadError}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={hello} />

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="border border-green/30 bg-[linear-gradient(135deg,#24383a_0%,#252422_55%,#1c1b19_100%)] px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
          <p className="text-[0.7rem] font-semibold uppercase leading-snug tracking-[0.14em] text-sand">
            {t("overview.profitability")}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 min-[480px]:grid-cols-2">
            <div className="min-w-0">
              <p className="text-sm leading-snug text-mute">{t("overview.netProfit")}</p>
              <p className="mt-1 font-display text-3xl leading-none tracking-wide break-words text-gold sm:text-4xl">
                {money(stats.netProfit)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-snug text-mute">{t("overview.profitMargin")}</p>
              <p className="mt-1 font-display text-2xl leading-none tracking-wide break-words text-gold">
                {formatPercent(stats.profitMargin)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-snug text-mute">{t("overview.grossProfit")}</p>
              <p className="mt-1 font-display text-2xl font-bold leading-none break-words">
                {money(stats.grossProfit)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-snug text-mute">{t("overview.trailingProfit")}</p>
              <p className="mt-1 font-display text-2xl font-bold leading-none break-words">
                {money(stats.trailingProfit)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-mute">
                {t("overview.trailingHint", {
                  sales: money(stats.periodRevenue),
                  ads: money(stats.periodAdSpend),
                  collected: money(stats.trailingPaidCollections),
                })}
              </p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-mute">
            {t("overview.surplus", {
              sales: money(stats.salesRevenue),
              cogs: money(stats.cogs),
              ads: money(stats.adSpend),
              paid: money(stats.paidCollections),
              roas: stats.avgRoas.toFixed(1),
              adProfit: money(stats.adProfit),
            })}
          </p>
        </div>
        <div className="border border-line bg-panel px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
          <p className="text-[0.7rem] font-semibold uppercase leading-snug tracking-[0.14em] text-mute">
            {t("overview.pnl")}
          </p>
          <dl className="mt-4 space-y-3.5 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <dt className="min-w-0 leading-snug text-mute">{t("overview.salesRevenue")}</dt>
              <dd className="shrink-0 font-semibold tabular-nums">{money(stats.salesRevenue)}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <dt className="min-w-0 leading-snug text-mute">
                {t("overview.cogs")}
                {stats.cogsRate > 0
                  ? ` (${Math.round(stats.cogsRate * 100)}%)`
                  : ""}
              </dt>
              <dd className="shrink-0 font-semibold tabular-nums text-mute">−{money(stats.cogs)}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <dt className="min-w-0 leading-snug text-mute">{t("overview.grossProfit")}</dt>
              <dd className="shrink-0 font-semibold tabular-nums">{money(stats.grossProfit)}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <dt className="min-w-0 leading-snug text-mute">{t("overview.adSpend")}</dt>
              <dd className="shrink-0 font-semibold tabular-nums text-mute">−{money(stats.adSpend)}</dd>
            </div>
            <div className="flex flex-col gap-1 border-t border-line pt-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <dt className="min-w-0 font-semibold leading-snug">{t("overview.netProfit")}</dt>
              <dd className="shrink-0 font-semibold tabular-nums text-gold">{money(stats.netProfit)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("overview.openLeads")}
          value={num(stats.openLeads)}
          hint={money(stats.pipelineValue)}
        />
        <Link href="/inbox" className="block">
          <KpiCard
            label={t("nav.inbox")}
            value={num(mail.filter((m) => !m.isRead).length)}
            hint={t("overview.inboxHint")}
          />
        </Link>
        <Link href="/newsletter" className="block">
          <KpiCard
            label={t("overview.newsletters")}
            value={num(newsletters.length)}
            hint={t("overview.newsletters")}
          />
        </Link>
        <KpiCard
          label={t("overview.outstanding")}
          value={money(stats.outstanding)}
          hint={t("overview.overdueCollected", {
            overdue: stats.overdueCount,
            paid: money(stats.paidCollections),
          })}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          {analyticsSeries.length > 0 ? (
            <LineChart
              title={t("overview.revenueLeads")}
              aLabel={t("overview.revenue")}
              bLabel={t("overview.leads")}
              points={analyticsSeries.map((p) => ({
                label: p.label,
                a: p.revenue,
                b: p.leads,
              }))}
            />
          ) : (
            <EmptyHint>{t("overview.noSalesLeads")}</EmptyHint>
          )}
        </div>
        <div className="xl:col-span-2">
          {channelMix.length > 0 ? (
            <DonutChart title={t("overview.leadSourceMix")} segments={channelMix} />
          ) : (
            <EmptyHint>{t("overview.leadSourcesSoon")}</EmptyHint>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {analyticsSeries.length > 0 ? (
          <BarChart
            title={t("overview.monthlyRevenue")}
            points={analyticsSeries.map((p) => ({
              label: p.label,
              value: p.revenue,
            }))}
          />
        ) : (
          <EmptyHint>{t("overview.monthlyFromSales")}</EmptyHint>
        )}
        <Panel title={t("overview.quickLinks")}>
          <div className="flex flex-col gap-1 text-sm">
            <Link href="/inbox" className="py-1.5 leading-relaxed text-sand hover:text-gold">
              {t("overview.inboxReplies")}
            </Link>
            <Link href="/newsletter" className="py-1.5 leading-relaxed text-sand hover:text-gold">
              {t("nav.newsletter")}
            </Link>
            <Link href="/invoices" className="py-1.5 leading-relaxed text-sand hover:text-gold">
              {t("nav.invoices")}
            </Link>
          </div>
        </Panel>
      </div>

      {/* Paid media / Meta charts paused until Meta + Google env are ready */}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          title={t("overview.latestFrom")}
          action={
            <Link
              href="/inbox"
              className="text-xs font-semibold text-sand hover:text-gold"
            >
              {t("nav.inbox")}
            </Link>
          }
        >
          {recentMail.length === 0 ? (
            <EmptyHint>{t("overview.noMessages")}</EmptyHint>
          ) : (
            <ul className="divide-y divide-line">
              {recentMail.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-2 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug break-words">
                      {m.fromName || m.fromEmail}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-mute break-words">
                      {m.subject}
                    </p>
                  </div>
                  <StatusBadge compact tone={m.isRead ? "neutral" : "info"}>
                    {m.isRead ? t("common.read") : t("status.new")}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title={t("overview.pipeline")}
          action={
            <Link
              href="/leads"
              className="text-xs font-semibold text-sand hover:text-gold"
            >
              {t("nav.leads")}
            </Link>
          }
        >
          {recentLeads.length === 0 ? (
            <EmptyHint>{t("overview.noLeads")}</EmptyHint>
          ) : (
            <ul className="divide-y divide-line">
              {recentLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-start justify-between gap-2 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug break-words">{lead.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-mute break-words">
                      {formatDate(lead.createdAt, locale)} · {lead.email}
                    </p>
                  </div>
                  <StatusBadge compact tone={leadTone(lead.status)}>
                    {t(`stagesShort.${lead.status}`)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title={t("overview.recentInvoices")}>
          {recentInvoices.length === 0 ? (
            <EmptyHint>{t("overview.noInvoices")}</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("overview.number")}</th>
                    <th>{t("overview.client")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("overview.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.number}</td>
                      <td>{inv.client}</td>
                      <td>
                        <StatusBadge compact tone={invoiceTone(inv.status)}>
                          {t(`status.${inv.status}`)}
                        </StatusBadge>
                      </td>
                      <td>
                        {formatMoney(
                          invoiceTotal(inv),
                          inv.currency,
                          false,
                          locale,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
