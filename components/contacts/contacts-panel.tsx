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

const PAGE_SIZE = 80;
const KANBAN_LIMIT = 400;

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
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
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
      page: view === "kanban" ? "0" : String(page),
      limit: String(view === "kanban" ? KANBAN_LIMIT : PAGE_SIZE),
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
    setTotal(filter === "archived" ? next.length : (json.total ?? next.length));
    if (json.countries?.length) setCountries(json.countries);
    if (json.tags) setTags(json.tags);
    setLoading(false);
  }, [country, filter, kindParam, page, pushToast, query, t, tag, view]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [query, filter, country, tag, view]);

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
    const tagsShown = tagList(details.tags).slice(0, 3);
    return (
      <button
        key={lead.id}
        type="button"
        onClick={() => openContact(lead.id)}
        className="flex w-full gap-3 border border-line bg-panel p-3 text-left transition-colors hover:bg-ash/30"
      >
        <span
          className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarTone(lead.name || lead.email)}`}
          aria-hidden
        >
          {initials(lead.name, lead.email)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate font-semibold text-ink">
              {lead.name || lead.email || "—"}
            </span>
            {details.isCompany ? (
              <StatusBadge tone="info" compact>
                {t("pages.contacts.company")}
              </StatusBadge>
            ) : null}
          </span>
          {!details.isCompany && lead.company ? (
            <span className="mt-0.5 block truncate text-xs text-mute">
              {lead.company}
            </span>
          ) : null}
          {lead.email ? (
            <span className="mt-1.5 block truncate text-xs text-mute">
              {lead.email}
            </span>
          ) : null}
          {lead.phone ? (
            <span className="mt-0.5 block truncate text-xs text-mute">
              {lead.phone}
            </span>
          ) : null}
          {details.city || details.country ? (
            <span className="mt-0.5 block truncate text-xs text-mute">
              {[details.city, details.country].filter(Boolean).join(", ")}
            </span>
          ) : null}
          {tagsShown.length ? (
            <span className="mt-2 flex flex-wrap gap-1">
              {tagsShown.map((tagName) => (
                <span
                  key={tagName}
                  className="rounded-sm bg-ash px-1.5 py-0.5 text-[10px] font-medium text-mute"
                >
                  {tagName}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </button>
    );
  }

  function renderList(items: ContactRow[]) {
    return (
      <div className="border border-line">
        <table className="w-full table-fixed text-left text-sm">
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

  return (
    <div>
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
        <div className="mt-4 space-y-6">
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
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map(renderCard)}
              </div>
            </section>
          ))}
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
          {total > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-mute">
                {t("pages.contacts.pageLabel")
                  .replace("{page}", String(page + 1))
                  .replace("{pages}", String(pageCount))}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="border border-line bg-panel px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-mute hover:text-ink disabled:opacity-40"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  {t("common.back")}
                </button>
                <button
                  type="button"
                  className="border border-line bg-panel px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-mute hover:text-ink disabled:opacity-40"
                  disabled={page + 1 >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("pages.contacts.nextPage")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
