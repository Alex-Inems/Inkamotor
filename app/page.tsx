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
import { currentUser } from "@/lib/session";
import { invoiceTone, leadTone } from "@/lib/status";
import { useLocale } from "@/lib/i18n";

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

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return d.toLocaleString("en", { month: "short" });
}

function buildSeries(leads: Lead[], sales: Sale[]) {
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
      label: monthLabel(key),
      ...row,
    }));
}

function buildChannelMix(leads: Lead[]) {
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
    label: source,
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
  const [mail, setMail] = useState<OverviewMail[]>([]);
  const hello = `${t("greet.hello")}, ${currentUser.firstName}`;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/inbox/mail")
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
  }, []);

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
    () => buildSeries(leads, sales),
    [leads, sales],
  );
  const channelMix = useMemo(() => buildChannelMix(leads), [leads]);

  const money = (n: number, compact = true) =>
    formatMoney(n, "USD", compact, locale);
  const num = (n: number, compact = false) => formatNumber(n, compact, locale);
  const recentLeads = [...leads]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const recentMail = mail.slice(0, 4);
  const recentInvoices = [...invoices].slice(0, 4);

  if (!ready) {
    return <EmptyHint>Loading workspace…</EmptyHint>;
  }

  if (loadError) {
    return (
      <div className="border border-wine/40 bg-wine/10 px-4 py-3 text-sm">
        <p className="font-semibold text-pink">{loadError}</p>
        <p className="mt-2 text-mute">
          Configure Supabase in{" "}
          <Link href="/setup" className="text-sand hover:text-gold">
            Setup
          </Link>{" "}
          and run <code className="text-sand">supabase/schema.sql</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={hello}
        description={t("overview.description", {
          inquiries: mail.filter((m) => !m.isRead).length,
          followUps: stats.openFollowUps,
          leads: stats.websiteLeads,
        })}
      />

      <div className="mb-4 border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
        <span className="font-semibold">{t("overview.bannerTitle")}</span>{" "}
        {t("overview.banner")}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="border border-green/30 bg-[linear-gradient(135deg,#24383a_0%,#252422_55%,#1c1b19_100%)] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sand">
            {t("overview.profitability")}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-sm text-mute">{t("overview.netProfit")}</p>
              <p className="font-display text-3xl tracking-wide text-gold sm:text-4xl">
                {money(stats.netProfit)}
              </p>
            </div>
            <div>
              <p className="text-sm text-mute">{t("overview.profitMargin")}</p>
              <p className="font-display text-2xl tracking-wide text-gold">
                {formatPercent(stats.profitMargin)}
              </p>
            </div>
            <div>
              <p className="text-sm text-mute">{t("overview.grossProfit")}</p>
              <p className="font-display text-2xl font-bold">
                {money(stats.grossProfit)}
              </p>
            </div>
            <div>
              <p className="text-sm text-mute">{t("overview.trailingProfit")}</p>
              <p className="font-display text-2xl font-bold">
                {money(stats.trailingProfit)}
              </p>
              <p className="mt-1 text-xs text-mute">
                {money(stats.periodRevenue)} sales · {money(stats.periodAdSpend)}{" "}
                ads · {money(stats.trailingPaidCollections)} collected
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-mute">
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
        <div className="border border-line bg-panel p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">
            {t("overview.pnl")}
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-mute">{t("overview.salesRevenue")}</dt>
              <dd className="font-semibold">{money(stats.salesRevenue)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-mute">
                {t("overview.cogs")}
                {stats.cogsRate > 0
                  ? ` (${Math.round(stats.cogsRate * 100)}%)`
                  : ""}
              </dt>
              <dd className="font-semibold text-mute">−{money(stats.cogs)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-mute">{t("overview.grossProfit")}</dt>
              <dd className="font-semibold">{money(stats.grossProfit)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-mute">{t("overview.adSpend")}</dt>
              <dd className="font-semibold text-mute">−{money(stats.adSpend)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <dt className="font-semibold">{t("overview.netProfit")}</dt>
              <dd className="font-semibold text-gold">{money(stats.netProfit)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("overview.openLeads")}
          value={num(stats.openLeads)}
          hint={money(stats.pipelineValue)}
        />
        <Link href="/inbox" className="block">
          <KpiCard
            label="Inbox"
            value={num(mail.filter((m) => !m.isRead).length)}
            hint={t("overview.openFollowUpsHint", { n: stats.openFollowUps })}
          />
        </Link>
        <Link href="/newsletter" className="block">
          <KpiCard
            label="Newsletters"
            value={num(newsletters.length)}
            hint="Newsletters"
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

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
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
            <EmptyHint>No sales or leads yet — create them in the CRM.</EmptyHint>
          )}
        </div>
        <div className="lg:col-span-2">
          {channelMix.length > 0 ? (
            <DonutChart title={t("overview.leadSourceMix")} segments={channelMix} />
          ) : (
            <EmptyHint>Lead sources will appear here.</EmptyHint>
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
          <EmptyHint>Monthly revenue builds from closed sales.</EmptyHint>
        )}
        <Panel title="Quick links">
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/inbox" className="text-sand hover:text-gold">
              Inbox & replies
            </Link>
            <Link href="/newsletter" className="text-sand hover:text-gold">
              Newsletter
            </Link>
            <Link href="/invoices" className="text-sand hover:text-gold">
              Invoices
            </Link>
            <Link href="/setup" className="text-sand hover:text-gold">
              Setup
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
              Inbox
            </Link>
          }
        >
          {recentMail.length === 0 ? (
            <EmptyHint>No messages yet.</EmptyHint>
          ) : (
            <ul className="divide-y divide-line">
              {recentMail.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.fromName || m.fromEmail}
                    </p>
                    <p className="truncate text-xs text-mute">{m.subject}</p>
                  </div>
                  <StatusBadge tone={m.isRead ? "neutral" : "info"}>
                    {m.isRead ? "Read" : "New"}
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
              Leads
            </Link>
          }
        >
          {recentLeads.length === 0 ? (
            <EmptyHint>No leads yet.</EmptyHint>
          ) : (
            <ul className="divide-y divide-line">
              {recentLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{lead.name}</p>
                    <p className="truncate text-xs text-mute">
                      {formatDate(lead.createdAt, locale)} ·{" "}
                      {money(lead.value, false)}
                    </p>
                  </div>
                  <StatusBadge tone={leadTone(lead.status)}>
                    {lead.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Recent invoices">
          {recentInvoices.length === 0 ? (
            <EmptyHint>No invoices yet.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.number}</td>
                      <td>{inv.client}</td>
                      <td>
                        <StatusBadge tone={invoiceTone(inv.status)}>
                          {inv.status}
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
