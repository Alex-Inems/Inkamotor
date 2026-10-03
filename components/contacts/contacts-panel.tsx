"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OdooControlPanel } from "@/components/sales/odoo-control-panel";
import { EmptyHint, PageHeader, StatusBadge } from "@/components/ui";
import {
  tagList,
  type ContactDetails,
} from "@/lib/crm/contact-details";
import { useCrm } from "@/lib/crm-store";
import { type Lead } from "@/lib/demo-data";
import { formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

const PAGE_SIZE = 60;

type ViewMode = "kanban" | "list";
type ContactFilter = "all" | "person" | "company" | "archived";
type GroupByKey = "country" | "company" | "city" | "none";
type ContactRow = { lead: Lead; details: ContactDetails; score?: number };

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

function avatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  // Colorful in dark; light theme forces brand blue via .contact-avatar-tone
  return `contact-avatar-tone ${AVATAR_TONES[hash % AVATAR_TONES.length]!}`;
}

function initials(name: string, email: string) {
  const base = (name || email.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : base.slice(0, 2);
  return (letters || "?").toUpperCase();
}

function sourceLabel(
  source: string,
  t: (key: string) => string,
) {
  const key = `sources.${source}`;
  const label = t(key);
  return label === key ? source : label;
}

function MailIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="3.5"
        width="12"
        height="9"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M3 5l5 3.5L13 5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4.2 2.75c0-.4.3-.75.7-.75h1.35c.3 0 .55.2.65.48l.55 1.65c.08.25 0 .52-.2.68L6.4 5.7a8.2 8.2 0 0 0 3.9 3.9l.9-.85c.16-.2.43-.28.68-.2l1.65.55c.28.1.48.35.48.65v1.35c0 .4-.35.7-.75.7A9.5 9.5 0 0 1 4.2 2.75Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActivityDots({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          active ? "bg-[#3cb371]" : "bg-line"
        }`}
      />
      <span className="h-2 w-2 rotate-45 border border-line/80 bg-transparent" />
      <span className="h-2 w-2 rotate-45 border border-line/80 bg-transparent" />
      <span className="h-2 w-2 rotate-45 border border-line/80 bg-transparent" />
    </span>
  );
}

export function ContactsPanel() {
  const router = useRouter();
  const { pushToast } = useCrm();
  const { t, locale } = useLocale();
  const [view, setView] = useState<ViewMode>("kanban");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupByKey>("none");
  const [country, setCountry] = useState("all");
  const [tag, setTag] = useState("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [countries, setCountries] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const kindParam =
    filter === "person" || filter === "company" ? filter : "all";

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      q: query,
      stage: "all",
      country,
      tag,
      kind: kindParam,
      sort: "name",
      dir: "asc",
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    const res = await fetch(`/api/leads?${params}`);
    const json = (await res.json()) as {
      rows?: ContactRow[];
      total?: number;
      countries?: string[];
      tags?: string[];
      error?: string;
    };
    if (!res.ok) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      pushToast({
        message: json.error || t("toast.loadFailed"),
        tone: "error",
      });
      return;
    }
    let next = json.rows ?? [];
    if (filter === "archived") {
      next = next.filter((row) => !row.details.active);
    } else if (filter !== "all") {
      next = next.filter((row) => row.details.active !== false);
    }
    setRows(next);
    setTotal(json.total ?? next.length);
    if (json.countries?.length) setCountries(json.countries);
    if (json.tags) setTags(json.tags);
    setLoading(false);
  }, [country, filter, kindParam, page, pushToast, query, t, tag]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [query, filter, country, tag, view, groupBy]);

  const facets = useMemo(() => {
    const chips = [];
    if (filter !== "all") {
      chips.push({
        id: `filter-${filter}`,
        label: t(`pages.contacts.filter.${filter}`),
        onRemove: () => setFilter("all"),
      });
    }
    if (groupBy !== "none") {
      chips.push({
        id: `group-${groupBy}`,
        label: t(`pages.contacts.group.${groupBy}`),
        onRemove: () => setGroupBy("none"),
      });
    }
    if (country !== "all") {
      chips.push({
        id: `country-${country}`,
        label: country,
        onRemove: () => setCountry("all"),
      });
    }
    if (tag !== "all") {
      chips.push({
        id: `tag-${tag}`,
        label: tag,
        onRemove: () => setTag("all"),
      });
    }
    return chips;
  }, [country, filter, groupBy, t, tag]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", items: rows }];
    const buckets = new Map<string, ContactRow[]>();
    for (const row of rows) {
      let key = "—";
      if (groupBy === "country") key = row.details.country.trim() || "—";
      else if (groupBy === "city") key = row.details.city.trim() || "—";
      else {
        key = row.details.isCompany
          ? row.lead.name.trim() || "—"
          : row.lead.company.trim() || "—";
      }
      const list = buckets.get(key);
      if (list) list.push(row);
      else buckets.set(key, [row]);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b, locale))
      .map(([key, items]) => ({ key, label: key, items }));
  }, [groupBy, locale, rows]);

  function openContact(id: string) {
    router.push(`/contacts/${encodeURIComponent(id)}`);
  }

  function renderCard(row: ContactRow) {
    const { lead, details } = row;
    const name = lead.name || lead.email || "—";
    const company = details.isCompany
      ? ""
      : lead.company && lead.company !== lead.name
        ? lead.company
        : "";
    const badge =
      lead.source
        ? sourceLabel(lead.source, t)
        : tagList(details.tags)[0] ||
          (details.isCompany ? t("pages.contacts.company") : "");
    const owner = lead.owner.trim();
    const hasActivity = Boolean(
      details.nextActivity ||
        details.activityStatus ||
        details.active !== false,
    );

    return (
      <button
        key={lead.id}
        type="button"
        onClick={() => openContact(lead.id)}
        className="flex w-full flex-col overflow-hidden rounded-xl border border-line bg-panel text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] hover:border-mute/40 hover:shadow-[0_4px_14px_-8px_rgba(0,0,0,0.2)]"
      >
        <span className="flex items-start gap-3 px-3.5 pt-3.5 pb-3">
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${avatarTone(lead.name || lead.email || lead.id)}`}
            aria-hidden
          >
            {initials(lead.name, lead.email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold leading-snug text-ink">
                  {name}
                </span>
                {company ? (
                  <span className="mt-0.5 block truncate text-[12px] text-mute">
                    {company}
                  </span>
                ) : null}
              </span>
              {badge ? (
                <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,#556ee6_14%,var(--panel))] px-2.5 py-0.5 text-[11px] font-medium text-[#4458c9]">
                  {badge}
                </span>
              ) : null}
            </span>
          </span>
        </span>

        {(lead.email || lead.phone) && (
          <span className="space-y-1.5 border-t border-line/70 px-3.5 py-2.5">
            {lead.email ? (
              <span className="flex min-w-0 items-center gap-2 text-[12px] text-mute">
                <MailIcon />
                <span className="truncate">{lead.email}</span>
              </span>
            ) : null}
            {lead.phone ? (
              <span className="flex min-w-0 items-center gap-2 text-[12px] text-mute">
                <PhoneIcon />
                <span className="truncate">{lead.phone}</span>
              </span>
            ) : null}
          </span>
        )}

        <span className="flex items-center justify-between gap-2 border-t border-line/70 px-3.5 py-2">
          {owner ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white ${avatarTone(owner)}`}
                aria-hidden
              >
                {initials(owner, "")}
              </span>
              <span className="truncate text-[12px] text-mute">{owner}</span>
            </span>
          ) : (
            <span />
          )}
          <ActivityDots active={hasActivity} />
        </span>
      </button>
    );
  }

  function renderList(items: ContactRow[]) {
    return (
      <div className="table-wrap border border-line">
        <table className="crm-list-table text-sm">
          <thead className="bg-ash/40 text-[11px] uppercase tracking-wide text-mute">
            <tr>
              <th className="w-[26%] px-3 py-2.5">{t("common.name")}</th>
              <th className="w-[22%] px-3 py-2.5">{t("common.email")}</th>
              <th className="w-[14%] px-3 py-2.5">{t("common.phone")}</th>
              <th className="w-[14%] px-3 py-2.5">{t("pages.contacts.city")}</th>
              <th className="w-[14%] px-3 py-2.5">{t("pages.contacts.country")}</th>
              <th className="w-[10%] px-3 py-2.5">{t("pages.contacts.kind")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.lead.id}
                className="cursor-pointer border-t border-line hover:bg-ash/20"
                onClick={() => openContact(row.lead.id)}
              >
                <td className="px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarTone(row.lead.name || row.lead.email)}`}
                      aria-hidden
                    >
                      {initials(row.lead.name, row.lead.email)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {row.lead.name || "—"}
                      </span>
                      {!row.details.isCompany && row.lead.company ? (
                        <span className="block truncate text-xs text-mute">
                          {row.lead.company}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </td>
                <td className="truncate px-3 py-2.5 text-mute">
                  {row.lead.email || "—"}
                </td>
                <td className="truncate px-3 py-2.5 text-mute">
                  {row.lead.phone || "—"}
                </td>
                <td className="truncate px-3 py-2.5 text-mute">
                  {row.details.city || "—"}
                </td>
                <td className="truncate px-3 py-2.5 text-mute">
                  {row.details.country || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge
                    tone={row.details.isCompany ? "info" : "neutral"}
                    compact
                  >
                    {row.details.isCompany
                      ? t("pages.contacts.company")
                      : t("pages.contacts.person")}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeTo = Math.min(total, (page + 1) * PAGE_SIZE);

  function Pager() {
    if (total <= PAGE_SIZE) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-mute">
          {t("pages.contacts.pageLabel")
            .replace("{page}", String(page + 1))
            .replace("{pages}", String(pageCount))}
          <span className="ml-2">
            ({formatNumber(rangeFrom, false, locale)}–
            {formatNumber(rangeTo, false, locale)} /{" "}
            {formatNumber(total, false, locale)})
          </span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-mute hover:text-ink disabled:opacity-40"
            disabled={page <= 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            {t("common.back")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-mute hover:text-ink disabled:opacity-40"
            disabled={page + 1 >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("pages.contacts.nextPage")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contacts-page">
      <PageHeader title={t("pages.contacts.title")} />

      <div className="mt-1 mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mute">
          {t("pages.contacts.count").replace(
            "{count}",
            formatNumber(total, false, locale),
          )}
        </p>
      </div>

      <OdooControlPanel
        query={query}
        onQueryChange={setQuery}
        facets={facets}
        newHref="/contacts/new"
        newLabel={t("pages.contacts.newContact")}
        viewMode={view}
        onViewModeChange={setView}
        filterItems={[
          {
            id: "person",
            label: t("pages.contacts.filter.person"),
            active: filter === "person",
            onSelect: () =>
              setFilter((prev) => (prev === "person" ? "all" : "person")),
          },
          {
            id: "company",
            label: t("pages.contacts.filter.company"),
            active: filter === "company",
            onSelect: () =>
              setFilter((prev) => (prev === "company" ? "all" : "company")),
          },
          {
            id: "archived",
            label: t("pages.contacts.filter.archived"),
            active: filter === "archived",
            onSelect: () =>
              setFilter((prev) => (prev === "archived" ? "all" : "archived")),
          },
          ...countries.slice(0, 12).map((c) => ({
            id: `country-${c}`,
            label: c,
            active: country === c,
            onSelect: () => setCountry((prev) => (prev === c ? "all" : c)),
          })),
          ...tags.slice(0, 12).map((tagName) => ({
            id: `tag-${tagName}`,
            label: tagName,
            active: tag === tagName,
            onSelect: () => setTag((prev) => (prev === tagName ? "all" : tagName)),
          })),
        ]}
        groupByItems={(["country", "company", "city"] as const).map((key) => ({
          id: key,
          label: t(`pages.contacts.group.${key}`),
          active: groupBy === key,
          onSelect: () => setGroupBy((prev) => (prev === key ? "none" : key)),
        }))}
      />

      {loading ? (
        <EmptyHint>{t("common.loading")}</EmptyHint>
      ) : rows.length === 0 ? (
        <EmptyHint>{t("pages.contacts.empty")}</EmptyHint>
      ) : view === "kanban" ? (
        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              {group.label ? (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-mute">
                  {group.label}
                  <span className="ml-2 font-normal normal-case tracking-normal">
                    ({formatNumber(group.items.length, false, locale)})
                  </span>
                </h3>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map(renderCard)}
              </div>
            </section>
          ))}
          <Pager />
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              {group.label ? (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-mute">
                  {group.label}
                  <span className="ml-2 font-normal normal-case tracking-normal">
                    ({formatNumber(group.items.length, false, locale)})
                  </span>
                </h3>
              ) : null}
              {renderList(group.items)}
            </section>
          ))}
          <Pager />
        </div>
      )}
    </div>
  );
}
