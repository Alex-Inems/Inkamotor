"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost } from "@/components/modal";
import { EmailMarketingSubnav } from "@/components/email-marketing/email-marketing-subnav";
import { OdooControlPanel } from "@/components/sales/odoo-control-panel";
import { EmptyHint, PageHeader, StatusBadge } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { MailingStatus, NewsletterMailing } from "@/lib/newsletter/mailings";

type ViewMode = "kanban" | "list";
type MailingFilter = "all" | "my" | "draft" | "sent";
type GroupByKey = "status" | "responsible" | "month";

const STAGES: MailingStatus[] = ["draft", "in_queue", "sending", "sent"];

const AVATAR_TONES = [
  "bg-[#714B67]",
  "bg-[#3d8b7a]",
  "bg-[#c47a3a]",
  "bg-[#5a7aa8]",
  "bg-[#6b8f3a]",
  "bg-[#a85a5a]",
  "bg-[#5a8a8a]",
  "bg-[#8a7a3a]",
];

function stageTone(status: MailingStatus) {
  if (status === "sent") return "success" as const;
  if (status === "sending" || status === "in_queue") return "info" as const;
  return "warning" as const;
}

function mailingWhen(mailing: NewsletterMailing) {
  return mailing.mailingDate || mailing.scheduledAt || mailing.updatedAt;
}

function formatMailingDate(iso: string, locale: Locale) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-GB",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(d);
}

function formatRatio(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function avatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function initials(name: string) {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : name.trim().slice(0, 2);
  return (letters || "?").toUpperCase();
}

function RatioBar({ value, tone = "teal" }: { value: number; tone?: "teal" | "purple" }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const fill =
    tone === "purple"
      ? "bg-[#714B67]"
      : "bg-[#017e84]";
  return (
    <div className="min-w-0">
      <div className="text-right tabular-nums text-mute">{formatRatio(pct)}</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-line/70">
        <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResponsibleCell({ name }: { name: string }) {
  const label = name.trim() || "—";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarTone(label)}`}
        aria-hidden
      >
        {initials(label)}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

export default function EmailMarketingPage() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("list");
  const [mailings, setMailings] = useState<NewsletterMailing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MailingFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupByKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mailRes = await fetch("/api/newsletter/mailings?seed=1");
      const mailJson = await mailRes.json();
      if (!mailRes.ok) {
        setError(
          (mailJson as { error?: string }).error ||
            t("pages.emailMarketing.loadFailed"),
        );
        setMailings([]);
      } else {
        setError(null);
        setMailings(
          (mailJson as { mailings?: NewsletterMailing[] }).mailings ?? [],
        );
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function stageLabel(status: MailingStatus) {
    return t(`pages.emailMarketing.stage.${status}`);
  }

  function filterLabel(value: MailingFilter) {
    if (value === "my") return t("pages.emailMarketing.filterMy");
    if (value === "draft") return t("pages.emailMarketing.filterDrafts");
    if (value === "sent") return t("pages.emailMarketing.filterSent");
    return "";
  }

  function groupLabel(key: GroupByKey) {
    if (key === "status") return t("pages.emailMarketing.groupStatus");
    if (key === "responsible") return t("pages.emailMarketing.groupResponsible");
    return t("pages.emailMarketing.groupMonth");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = mailings;
    if (filter === "my") {
      rows = rows.filter((row) => /jorge/i.test(row.responsible || ""));
    } else if (filter === "draft") {
      rows = rows.filter((row) => row.status === "draft");
    } else if (filter === "sent") {
      rows = rows.filter((row) => row.status === "sent");
    }
    if (q) {
      rows = rows.filter((row) =>
        `${row.name} ${row.subject} ${row.responsible} ${row.status}`
          .toLowerCase()
          .includes(q),
      );
    }
    return [...rows].sort((a, b) => {
      const draftRank = (status: MailingStatus) => (status === "draft" ? 0 : 1);
      const byStatus = draftRank(a.status) - draftRank(b.status);
      if (byStatus !== 0) return byStatus;
      const ta = new Date(a.updatedAt || mailingWhen(a)).getTime() || 0;
      const tb = new Date(b.updatedAt || mailingWhen(b)).getTime() || 0;
      return tb - ta;
    });
  }, [mailings, query, filter]);

  const groups = useMemo(() => {
    if (!groupBy) return [{ key: "all", label: "", items: filtered }];
    const buckets = new Map<string, { label: string; items: NewsletterMailing[] }>();
    for (const row of filtered) {
      let key: string;
      let label: string;
      if (groupBy === "status") {
        key = row.status;
        label = stageLabel(row.status);
      } else if (groupBy === "responsible") {
        key = row.responsible.trim() || "—";
        label = key;
      } else {
        key = mailingWhen(row).slice(0, 7) || "—";
        label =
          key === "—"
            ? "—"
            : new Intl.DateTimeFormat(
                locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-GB",
                { month: "long", year: "numeric" },
              ).format(new Date(`${key}-01T12:00:00`));
      }
      const bucket = buckets.get(key);
      if (bucket) bucket.items.push(row);
      else buckets.set(key, { label, items: [row] });
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => {
        if (groupBy === "month") return b.localeCompare(a);
        if (groupBy === "status") {
          return STAGES.indexOf(a as MailingStatus) - STAGES.indexOf(b as MailingStatus);
        }
        return a.localeCompare(b, locale);
      })
      .map(([key, value]) => ({ key, label: value.label, items: value.items }));
  }, [filtered, groupBy, locale, t]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(
      STAGES.map((status) => [status, [] as NewsletterMailing[]]),
    ) as Record<MailingStatus, NewsletterMailing[]>;
    for (const row of filtered) {
      map[row.status].push(row);
    }
    return map;
  }, [filtered]);

  const facets = useMemo(() => {
    const chips = [];
    if (filter !== "all") {
      chips.push({
        id: `filter-${filter}`,
        label: filterLabel(filter),
        onRemove: () => setFilter("all"),
      });
    }
    if (groupBy) {
      chips.push({
        id: `group-${groupBy}`,
        label: groupLabel(groupBy),
        onRemove: () => setGroupBy(null),
      });
    }
    return chips;
  }, [filter, groupBy, t]);

  function openMailing(id: string) {
    router.push(`/email-marketing/${encodeURIComponent(id)}`);
  }

  function renderListTable(rows: NewsletterMailing[]) {
    return (
      <div className="border border-line">
        <table className="w-full table-fixed text-left text-[12px] sm:text-sm">
          <thead className="bg-ash/40 text-[10px] uppercase tracking-wide text-mute sm:text-[11px]">
            <tr>
              <th className="w-[12%] px-2 py-2.5">{t("pages.emailMarketing.colDate")}</th>
              <th className="w-[28%] px-2 py-2.5">{t("pages.emailMarketing.colSubject")}</th>
              <th className="w-[16%] px-2 py-2.5">{t("pages.emailMarketing.colResponsible")}</th>
              <th className="w-[8%] px-2 py-2.5 text-right">{t("pages.emailMarketing.colSent")}</th>
              <th className="w-[9%] px-2 py-2.5 text-right" title={t("pages.emailMarketing.colDelivered")}>
                {t("pages.emailMarketing.colDeliveredShort")}
              </th>
              <th className="w-[9%] px-2 py-2.5 text-right" title={t("pages.emailMarketing.colOpened")}>
                {t("pages.emailMarketing.colOpenedShort")}
              </th>
              <th className="w-[9%] px-2 py-2.5 text-right" title={t("pages.emailMarketing.colClicked")}>
                {t("pages.emailMarketing.colClickedShort")}
              </th>
              <th className="w-[9%] px-2 py-2.5">{t("pages.emailMarketing.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((mailing) => (
              <tr
                key={mailing.id}
                className="cursor-pointer border-t border-line hover:bg-ash/20"
                onClick={() => openMailing(mailing.id)}
              >
                <td className="px-2 py-2.5 align-middle text-mute">
                  {formatMailingDate(mailingWhen(mailing), locale)}
                </td>
                <td className="px-2 py-2.5 align-middle">
                  <p className="line-clamp-2 font-medium leading-snug text-ink">
                    {mailing.subject || mailing.name}
                  </p>
                </td>
                <td className="px-2 py-2.5 align-middle text-mute">
                  <ResponsibleCell name={mailing.responsible} />
                </td>
                <td className="px-2 py-2.5 align-middle text-right tabular-nums text-mute">
                  {formatNumber(mailing.sentCount, false, locale)}
                </td>
                <td className="px-2 py-2.5 align-middle">
                  <RatioBar value={mailing.deliveredPct} />
                </td>
                <td className="px-2 py-2.5 align-middle">
                  <RatioBar value={mailing.openPct} tone="purple" />
                </td>
                <td className="px-2 py-2.5 align-middle">
                  <RatioBar value={mailing.clickPct} />
                </td>
                <td className="px-2 py-2.5 align-middle">
                  <StatusBadge tone={stageTone(mailing.status)} compact>
                    {stageLabel(mailing.status)}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("pages.emailMarketing.title")} />

      <EmailMarketingSubnav />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mute">
          {t("pages.emailMarketing.countLabel").replace(
            "{count}",
            String(filtered.length),
          )}
        </p>
        <button type="button" className={btnGhost} onClick={() => void load()}>
          {t("common.refresh")}
        </button>
      </div>

      <div className="mt-3">
        <OdooControlPanel
          query={query}
          onQueryChange={setQuery}
          facets={facets}
          newHref="/email-marketing/new"
          newLabel={t("pages.emailMarketing.newMailing")}
          viewMode={view}
          onViewModeChange={setView}
          filterItems={[
            {
              id: "my",
              label: t("pages.emailMarketing.filterMy"),
              active: filter === "my",
              onSelect: () => setFilter((prev) => (prev === "my" ? "all" : "my")),
            },
            {
              id: "draft",
              label: t("pages.emailMarketing.filterDrafts"),
              active: filter === "draft",
              onSelect: () =>
                setFilter((prev) => (prev === "draft" ? "all" : "draft")),
            },
            {
              id: "sent",
              label: t("pages.emailMarketing.filterSent"),
              active: filter === "sent",
              onSelect: () =>
                setFilter((prev) => (prev === "sent" ? "all" : "sent")),
            },
          ]}
          groupByItems={(["status", "responsible", "month"] as GroupByKey[]).map(
            (key) => ({
              id: key,
              label: groupLabel(key),
              active: groupBy === key,
              onSelect: () => setGroupBy((prev) => (prev === key ? null : key)),
            }),
          )}
        />
      </div>

      {error ? (
        <p className="mt-4 border border-wine/40 bg-wine/10 px-3 py-3 text-sm text-pink">
          {error}
        </p>
      ) : null}

      {loading ? (
        <EmptyHint>{t("common.loading")}</EmptyHint>
      ) : filtered.length === 0 ? (
        <EmptyHint>{t("pages.emailMarketing.empty")}</EmptyHint>
      ) : view === "kanban" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((status) => (
            <section
              key={status}
              className="flex min-w-0 flex-col border border-line bg-panel"
            >
              <header className="flex items-center justify-between border-b border-line px-3 py-2.5">
                <p className="text-sm font-semibold">{stageLabel(status)}</p>
                <span className="text-xs text-mute">{byStage[status].length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {byStage[status].map((mailing) => (
                  <article
                    key={mailing.id}
                    className="cursor-pointer border border-line bg-canvas p-3 hover:bg-ash/20"
                    onClick={() => openMailing(mailing.id)}
                  >
                    <p className="line-clamp-2 text-sm font-semibold text-ink">
                      {mailing.subject || mailing.name}
                    </p>
                    <div className="mt-2">
                      <ResponsibleCell name={mailing.responsible} />
                    </div>
                    <p className="mt-2 text-[11px] text-mute">
                      {formatMailingDate(mailingWhen(mailing), locale)}
                    </p>
                    {mailing.sentCount > 0 ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <RatioBar value={mailing.deliveredPct} />
                        <RatioBar value={mailing.openPct} tone="purple" />
                      </div>
                    ) : null}
                  </article>
                ))}
                {byStage[status].length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-mute">
                    {t("pages.emailMarketing.emptyStage")}
                  </p>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              {group.label ? (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-mute">
                  {group.label}
                  <span className="ml-2 font-normal normal-case tracking-normal">
                    ({formatNumber(group.items.length, false, locale)})
                  </span>
                </h3>
              ) : null}
              {renderListTable(group.items)}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
