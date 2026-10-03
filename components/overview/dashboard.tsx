"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts";
import { EmptyHint } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import { getDashboardStats, type Newsletter } from "@/lib/demo-data";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { localeMeta, useLocale } from "@/lib/i18n";

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function initials(name: string, email?: string) {
  const base = (name || email?.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : base.slice(0, 2);
  return (letters || "?").toUpperCase();
}

const AVATAR = [
  "bg-[#1f6f74]",
  "bg-[#c45d57]",
  "bg-[#b8892d]",
  "bg-[#4f6b3c]",
  "bg-[#4a6d8c]",
  "bg-[#8a5a6a]",
];

function avatarTone(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  return AVATAR[h % AVATAR.length]!;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Inclusive day window ending at `end` (local), length `days`. */
function inTrailingWindow(iso: string, end: Date, days: number) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return false;
  const endDay = startOfDay(end);
  const startDay = new Date(endDay);
  startDay.setDate(startDay.getDate() - (days - 1));
  const day = startOfDay(t);
  return day >= startDay && day <= endDay;
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
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function lastNDays(n: number) {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function lastNMonthKeys(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
  }
  return keys;
}

function monthLabel(key: string, locale: string) {
  const [y, m] = key.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString(
    locale,
    { month: "short" },
  );
}

function eventMonth(iso: string | null | undefined, fallback?: string) {
  const raw = (iso || fallback || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

function weekdayLabel(iso: string, locale: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
    weekday: "short",
  });
}

function KpiCard({
  label,
  value,
  change,
  changeHint,
  noTrendLabel,
  spark,
  href,
  detailsLabel,
}: {
  label: string;
  value: string;
  /** Null when there isn’t enough history to compare. */
  change: number | null;
  changeHint: string;
  noTrendLabel: string;
  spark: number[];
  href: string;
  detailsLabel: string;
}) {
  const up = change == null ? true : change >= 0;
  const path = sparkPoints(spark);
  const sparkStroke =
    change == null ? "var(--accent)" : up ? "var(--green)" : "var(--pink)";
  return (
    <article className="overview-card flex flex-col justify-between p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-mute">{label}</p>
          <p className="overview-kpi-value mt-2 font-display text-3xl leading-none tracking-wide text-ink">
            {value}
          </p>
          {change == null ? (
            <p className="mt-2 text-sm text-mute">{noTrendLabel}</p>
          ) : (
            <p
              className={`mt-2 text-sm font-semibold ${
                up ? "text-green" : "text-pink"
              }`}
              title={changeHint}
            >
              <span aria-hidden>{up ? "↑" : "↓"}</span>{" "}
              {up ? "+" : ""}
              {change.toFixed(0)}%
              <span className="ml-1 font-normal text-mute">{changeHint}</span>
            </p>
          )}
        </div>
        <svg
          width="88"
          height="36"
          viewBox="0 0 88 36"
          className="mt-1 shrink-0"
          aria-hidden
        >
          <path
            d={path}
            fill="none"
            stroke={sparkStroke}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-deep"
      >
        {detailsLabel}
        <span aria-hidden>→</span>
      </Link>
    </article>
  );
}

function StatusGauge({
  title,
  segments,
  centerLabel,
  centerHint,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerHint: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 70;
  const stroke = 16;
  const c = Math.PI * r;
  let offset = 0;

  return (
    <article className="overview-card p-5 sm:p-6">
      <h2 className="font-display text-lg tracking-wide text-ink">{title}</h2>
      <div className="mt-2 flex flex-col items-center">
        <svg width="200" height="120" viewBox="0 0 200 120" className="overflow-visible">
          <g transform="translate(100,100)">
            <path
              d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`}
              fill="none"
              stroke="var(--ash)"
              strokeWidth={stroke}
              strokeLinecap="round"
            />
            {segments.map((seg) => {
              const len = (seg.value / total) * c;
              const el = (
                <path
                  key={seg.label}
                  d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeLinecap="butt"
                  strokeDasharray={`${Math.max(len - 3, 0)} ${c}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
          </g>
          <text
            x="100"
            y="78"
            textAnchor="middle"
            fill="var(--ink)"
            fontSize="22"
            fontWeight="700"
          >
            {centerLabel}
          </text>
          <text x="100" y="98" textAnchor="middle" fill="var(--mute)" fontSize="12">
            {centerHint}
          </text>
        </svg>
        <ul className="mt-1 grid w-full grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {segments.map((seg) => (
            <li key={seg.label} className="flex items-center gap-2 text-mute">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: seg.color }}
              />
              <span className="truncate text-ink">{seg.label}</span>
              <span className="ml-auto tabular-nums font-semibold text-ink">
                {Math.round((seg.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function SalesBars({
  title,
  points,
  formatValue,
}: {
  title: string;
  points: { label: string; value: number }[];
  formatValue: (n: number) => string;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <article className="overview-card p-5 sm:p-6">
      <h2 className="font-display text-lg tracking-wide text-ink">{title}</h2>
      <div className="mt-6 flex h-44 items-end justify-between gap-2 sm:gap-3">
        {points.map((p, i) => {
          const h = Math.max(8, (p.value / max) * 100);
          const tones = [
            "from-[color-mix(in_srgb,var(--accent)_55%,white)] to-[var(--accent)]",
            "from-[color-mix(in_srgb,var(--purple)_50%,white)] to-[var(--purple)]",
            "from-[color-mix(in_srgb,var(--gold)_55%,white)] to-[var(--gold)]",
            "from-[color-mix(in_srgb,var(--accent)_45%,white)] to-[var(--accent-deep)]",
            "from-[color-mix(in_srgb,var(--green)_50%,white)] to-[var(--green)]",
            "from-[color-mix(in_srgb,var(--pink)_50%,white)] to-[var(--pink)]",
            "from-[color-mix(in_srgb,var(--accent)_55%,white)] to-[var(--accent)]",
          ];
          return (
            <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end justify-center">
                <div
                  title={formatValue(p.value)}
                  className={`w-[55%] max-w-[2.25rem] rounded-t-full bg-gradient-to-t shadow-[inset_-3px_0_6px_rgba(255,255,255,0.25),inset_3px_0_8px_rgba(0,0,0,0.12)] ${tones[i % tones.length]}`}
                  style={{ height: `${h}%` }}
                />
              </div>
              <span className="truncate text-[11px] text-mute">{p.label}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function newsletterTone(status: Newsletter["status"]) {
  if (status === "sent") return "bg-green/20 text-green";
  if (status === "scheduled" || status === "sending") return "bg-gold/20 text-sand";
  if (status === "archived") return "bg-ash text-mute";
  return "bg-accent/15 text-accent-deep";
}

export function OverviewDashboard() {
  const {
    leads,
    sales,
    invoices,
    newsletters,
    metaCampaigns,
    siteInquiries,
    followUps,
    ready,
    loadError,
  } = useCrm();
  const { t, locale } = useLocale();
  const bcp = localeMeta[locale].bcp47;
  const [query, setQuery] = useState("");

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

  const money = (n: number, compact = true) =>
    formatMoney(n, "EUR", compact, locale);
  const num = (n: number) => formatNumber(n, false, locale);

  // Sparklines: weekly new-record counts (last 8 weeks) — avoids a half-empty calendar month.
  const weekBuckets = useMemo(() => {
    const weeks: { leads: number; sales: number; opps: number }[] = Array.from(
      { length: 8 },
      () => ({ leads: 0, sales: 0, opps: 0 }),
    );
    const end = startOfDay(new Date());
    for (const lead of leads) {
      const t = startOfDay(new Date(lead.createdAt));
      if (Number.isNaN(t.getTime())) continue;
      const ageDays = Math.floor((end.getTime() - t.getTime()) / 86400000);
      if (ageDays < 0 || ageDays >= 56) continue;
      const idx = 7 - Math.floor(ageDays / 7);
      const row = weeks[idx]!;
      row.leads += 1;
      if (!["won", "lost"].includes(lead.status)) row.opps += 1;
    }
    for (const sale of sales) {
      if (sale.status === "cancelled") continue;
      const t = startOfDay(new Date(sale.createdAt));
      if (Number.isNaN(t.getTime())) continue;
      const ageDays = Math.floor((end.getTime() - t.getTime()) / 86400000);
      if (ageDays < 0 || ageDays >= 56) continue;
      const idx = 7 - Math.floor(ageDays / 7);
      weeks[idx]!.sales += 1;
    }
    return weeks;
  }, [leads, sales]);

  const leadSpark = weekBuckets.map((r) => r.leads);
  const oppSpark = weekBuckets.map((r) => r.opps);
  const saleSpark = weekBuckets.map((r) => r.sales);

  // % = trailing 30 days vs the 30 days before that (fair when the month just started).
  const trendWindows = useMemo(() => {
    const end = new Date();
    const priorEnd = new Date(end);
    priorEnd.setDate(priorEnd.getDate() - 30);

    const countLeads = (through: Date, openOnly = false) =>
      leads.filter((l) => {
        if (!inTrailingWindow(l.createdAt, through, 30)) return false;
        if (openOnly) return !["won", "lost"].includes(l.status);
        return true;
      }).length;

    // For open opportunities trend, use newly created open-stage leads in the window.
    const countSales = (through: Date) =>
      sales.filter(
        (s) =>
          s.status !== "cancelled" && inTrailingWindow(s.createdAt, through, 30),
      ).length;

    return {
      leadChange: pctChange(countLeads(end), countLeads(priorEnd)),
      oppChange: pctChange(countLeads(end, true), countLeads(priorEnd, true)),
      saleChange: pctChange(countSales(end), countSales(priorEnd)),
    };
  }, [leads, sales]);

  const { leadChange, oppChange, saleChange } = trendWindows;

  const openOpps = leads.filter((l) => !["won", "lost"].includes(l.status)).length;
  const totalSalesCount = sales.filter((s) => s.status !== "cancelled").length;

  const { opportunitySeries, opportunityFallback } = useMemo(() => {
    // Prefer months that actually exist in CRM data (demo dates may not be "this year").
    const dataMonths = new Set<string>();
    for (const lead of leads) {
      const m = eventMonth(lead.createdAt);
      if (m) dataMonths.add(m);
    }
    for (const sale of sales) {
      const m = eventMonth(sale.closedAt, sale.createdAt);
      if (m) dataMonths.add(m);
    }
    const fromData = [...dataMonths].sort();
    const months =
      fromData.length > 0 ? fromData.slice(-6) : lastNMonthKeys(6);

    const wonByMonth = new Map<string, number>();
    const lostByMonth = new Map<string, number>();
    const salesByMonth = new Map<string, number>();
    const leadsByMonth = new Map<string, number>();

    for (const key of months) {
      wonByMonth.set(key, 0);
      lostByMonth.set(key, 0);
      salesByMonth.set(key, 0);
      leadsByMonth.set(key, 0);
    }

    for (const lead of leads) {
      const created = eventMonth(lead.createdAt);
      if (!created || !leadsByMonth.has(created)) continue;
      leadsByMonth.set(created, (leadsByMonth.get(created) ?? 0) + 1);
      if (lead.status === "won") {
        wonByMonth.set(created, (wonByMonth.get(created) ?? 0) + 1);
      } else if (lead.status === "lost") {
        lostByMonth.set(created, (lostByMonth.get(created) ?? 0) + 1);
      }
    }

    for (const sale of sales) {
      const closed = eventMonth(sale.closedAt, sale.createdAt);
      if (!closed || !wonByMonth.has(closed)) continue;
      if (sale.status !== "cancelled") {
        salesByMonth.set(closed, (salesByMonth.get(closed) ?? 0) + 1);
      }
      if (
        sale.status === "confirmed" ||
        sale.status === "fulfilled" ||
        sale.status === "sent" ||
        sale.status === "pending"
      ) {
        wonByMonth.set(closed, (wonByMonth.get(closed) ?? 0) + 1);
      } else if (sale.status === "cancelled") {
        lostByMonth.set(closed, (lostByMonth.get(closed) ?? 0) + 1);
      }
    }

    const closedPoints = months.map((key) => ({
      label: monthLabel(key, bcp),
      periodKey: key,
      a: wonByMonth.get(key) ?? 0,
      b: lostByMonth.get(key) ?? 0,
    }));
    const closedTotal = closedPoints.reduce((s, p) => s + p.a + p.b, 0);

    // Fallback when nothing is marked won/lost yet — show sales vs new leads.
    if (closedTotal === 0) {
      return {
        opportunityFallback: true,
        opportunitySeries: months.map((key) => ({
          label: monthLabel(key, bcp),
          periodKey: key,
          a: salesByMonth.get(key) ?? 0,
          b: leadsByMonth.get(key) ?? 0,
        })),
      };
    }
    return { opportunityFallback: false, opportunitySeries: closedPoints };
  }, [bcp, leads, sales]);

  const statusSegments = useMemo(() => {
    const order = ["won", "lost", "contacted", "new", "qualified"] as const;
    const colors: Record<string, string> = {
      won: "var(--accent)",
      lost: "var(--line)",
      contacted: "var(--purple)",
      new: "color-mix(in srgb, var(--accent) 45%, white)",
      qualified: "var(--gold)",
    };
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const key = order.includes(lead.status as (typeof order)[number])
        ? lead.status
        : "new";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return order
      .map((id) => ({
        id,
        label: t(`stagesShort.${id}`),
        value: counts.get(id) ?? 0,
        color: colors[id]!,
      }))
      .filter((s) => s.value > 0);
  }, [leads, t]);

  const topStatus = [...statusSegments].sort((a, b) => b.value - a.value)[0];
  const statusTotal = statusSegments.reduce((s, x) => s + x.value, 0) || 1;

  const salesWeek = useMemo(() => {
    const days = lastNDays(7);
    return days.map((day) => ({
      label: weekdayLabel(day, bcp),
      value: sales
        .filter((s) => dayKey(s.createdAt) === day && s.status !== "cancelled")
        .reduce((sum, s) => sum + s.amount, 0),
    }));
  }, [bcp, sales]);

  const recentLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...leads]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((l) => {
        if (!q) return true;
        return (
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [leads, query]);

  const recentNewsletters = useMemo(
    () =>
      [...newsletters]
        .sort((a, b) => {
          const aAt = a.sentAt || a.scheduledAt || a.createdAt;
          const bAt = b.sentAt || b.scheduledAt || b.createdAt;
          return bAt.localeCompare(aAt);
        })
        .slice(0, 5),
    [newsletters],
  );

  const updatedLabel = useMemo(
    () =>
      new Date().toLocaleDateString(bcp, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [bcp],
  );

  if (!ready) return <EmptyHint>{t("common.loadingWorkspace")}</EmptyHint>;
  if (loadError) {
    return (
      <div className="overview-card border-wine/40 bg-wine/10 px-4 py-3 text-sm">
        <p className="font-semibold text-pink">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="overview-shell pb-2">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">
            {t("overview.dashboard")}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs text-mute">
            <span className="h-1.5 w-1.5 rounded-full bg-green" />
            {t("overview.latestUpdated")} {updatedLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[14rem] flex-1 sm:max-w-xs">
            <span className="sr-only">{t("common.search")}</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("overview.searchLeads")}
              className="h-11 w-full rounded-full border border-line bg-panel pl-10 pr-4 text-sm text-ink outline-none placeholder:text-mute focus:border-accent"
            />
          </label>
          <Link
            href="/leads"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-deep"
          >
            <span className="text-lg leading-none">+</span>
            {t("pages.leads.addLead")}
          </Link>
          <Link
            href="/sales"
            className="inline-flex h-11 items-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink hover:border-accent/40"
          >
            {t("overview.importExport")}
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label={t("overview.totalLeads")}
          value={num(leads.length)}
          change={leadChange}
          changeHint={t("overview.vsPrior30Days")}
          noTrendLabel={t("overview.noTrendYet")}
          spark={leadSpark.length ? leadSpark : [0, 0]}
          href="/leads"
          detailsLabel={t("overview.seeMore")}
        />
        <KpiCard
          label={t("overview.totalOpportunity")}
          value={num(openOpps)}
          change={oppChange}
          changeHint={t("overview.vsPrior30Days")}
          noTrendLabel={t("overview.noTrendYet")}
          spark={oppSpark.length ? oppSpark : [0, 0]}
          href="/leads"
          detailsLabel={t("overview.seeMore")}
        />
        <KpiCard
          label={t("overview.totalSales")}
          value={num(totalSalesCount)}
          change={saleChange}
          changeHint={t("overview.vsPrior30Days")}
          noTrendLabel={t("overview.noTrendYet")}
          spark={saleSpark.length ? saleSpark : [0, 0]}
          href="/sales"
          detailsLabel={t("overview.seeMore")}
        />
      </section>

      {/* Main + right rail (Recent Lead over Newsletter), matching reference */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(17.5rem,22rem)] xl:items-stretch">
        <div className="overview-card overflow-hidden xl:col-span-2">
          <LineChart
            plain
            title={t("overview.opportunitySummary")}
            aLabel={
              opportunityFallback
                ? t("overview.totalSales")
                : t("overview.closedWon")
            }
            bLabel={
              opportunityFallback
                ? t("overview.totalLeads")
                : t("overview.closedLost")
            }
            formatA={(n) => formatNumber(n, false, locale)}
            formatB={(n) => formatNumber(n, false, locale)}
            points={opportunitySeries}
          />
        </div>

        <aside className="flex min-h-0 flex-col gap-4 xl:row-span-2">
          <article className="overview-card flex min-h-0 flex-1 flex-col p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg tracking-wide text-ink">
                {t("overview.recentLead")}
              </h2>
              <Link
                href="/leads"
                className="text-xs font-semibold text-accent hover:text-accent-deep"
              >
                {t("common.viewAll")}
              </Link>
            </div>
            {recentLeads.length === 0 ? (
              <EmptyHint>{t("overview.noLeads")}</EmptyHint>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto">
                {recentLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/leads/${encodeURIComponent(lead.id)}`}
                      className="flex items-center gap-3 py-3 transition-colors hover:bg-ash/40"
                    >
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarTone(lead.id)}`}
                      >
                        {initials(lead.name, lead.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">
                          {lead.name || lead.email}
                        </span>
                        <span className="block truncate text-xs text-accent">
                          {lead.email}
                        </span>
                        {lead.company ? (
                          <span className="block truncate text-xs text-mute">
                            {lead.company}
                          </span>
                        ) : null}
                      </span>
                      <ChevronIcon />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="overview-card flex flex-col p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg tracking-wide text-ink">
                {t("overview.newsletter")}
              </h2>
              <Link
                href="/email-marketing"
                className="text-xs font-semibold text-accent hover:text-accent-deep"
              >
                {t("common.viewAll")}
              </Link>
            </div>
            {recentNewsletters.length === 0 ? (
              <EmptyHint>{t("overview.noNewsletters")}</EmptyHint>
            ) : (
              <ul className="space-y-3">
                {recentNewsletters.map((nl) => {
                  const when = nl.sentAt || nl.scheduledAt || nl.createdAt;
                  const openRate =
                    nl.recipients > 0 && nl.opens > 0
                      ? Math.round((nl.opens / nl.recipients) * 100)
                      : null;
                  return (
                    <li key={nl.id}>
                      <Link
                        href="/email-marketing"
                        className="block rounded-xl border border-line/70 bg-ash/25 px-3 py-3 transition-colors hover:border-accent/35"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold text-ink">
                            {nl.name || nl.subject}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${newsletterTone(nl.status)}`}
                          >
                            {t(`status.${nl.status}`)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-mute">{nl.subject}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-mute">
                          <span className="inline-flex items-center gap-1">
                            <CalendarIcon />
                            {formatDate(when, locale)}
                          </span>
                          <span>·</span>
                          <span>
                            {formatNumber(nl.recipients, true, locale)}{" "}
                            {t("overview.recipients")}
                          </span>
                          {openRate != null ? (
                            <>
                              <span>·</span>
                              <span>
                                {openRate}% {t("overview.openRate")}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </aside>

        <StatusGauge
          title={t("overview.leadByStatus")}
          segments={statusSegments}
          centerLabel={
            topStatus
              ? `${Math.round((topStatus.value / statusTotal) * 100)}%`
              : "—"
          }
          centerHint={topStatus?.label ?? t("overview.leads")}
        />

        <SalesBars
          title={t("overview.salesSummary")}
          points={salesWeek}
          formatValue={(n) => money(n)}
        />
      </section>

      <p className="text-center text-xs text-mute">
        {t("overview.pipelineValue")}: {money(stats.pipelineValue)} ·{" "}
        {t("overview.netProfit")}: {money(stats.netProfit)}
      </p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-mute" aria-hidden>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="9" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 5h9M4 1.5v2M8 1.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
