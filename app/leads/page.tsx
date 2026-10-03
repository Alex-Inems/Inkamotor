"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_FORM_DRAFT_KEY } from "@/components/contacts/contact-detail";
import { BulkQuoteByTagModal } from "@/components/sales/bulk-quote-by-tag-modal";
import { OdooControlPanel } from "@/components/sales/odoo-control-panel";
import {
  PipelineKanban,
  type LeadRow,
  type QuickCreateInput,
  type QuickCreateOption,
} from "@/components/leads/pipeline-kanban";
import { ScheduleActivityModal } from "@/components/inbox/schedule-activity-modal";
import { btnSecondary } from "@/components/modal";
import { EmptyHint, PageHeader, StatusBadge } from "@/components/ui";
import {
  emptyContactWrite,
  tagList,
  type ContactDetails,
  type ContactWrite,
  type LeadPriority,
} from "@/lib/crm/contact-details";
import {
  defaultPipelineStages,
  isCoreStageId,
  readPipelineFromStorage,
  slugifyStageId,
  writePipelineToStorage,
  type PipelineStage,
} from "@/lib/crm/pipeline";
import { useConfirm } from "@/lib/confirm";
import { useCrm } from "@/lib/crm-store";
import { type Lead, type LeadStatus } from "@/lib/demo-data";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { leadTone } from "@/lib/status";

const PAGE_SIZE = 75;
const KANBAN_LIMIT = 600;

type ViewMode = "kanban" | "list";
type SortKey = "completeness" | "name" | "email" | "updated";

export default function LeadsPage() {
  const router = useRouter();
  const { pushToast } = useCrm();
  const { t, locale } = useLocale();
  const confirm = useConfirm();
  const [view, setView] = useState<ViewMode>("kanban");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<LeadStatus | "all">("all");
  const [country, setCountry] = useState("all");
  const [tag, setTag] = useState("all");
  const [kind, setKind] = useState<"all" | "person" | "company">("all");
  const [priorityFilter, setPriorityFilter] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "completeness",
    dir: "desc",
  });
  const [page, setPage] = useState(0);
  const [pipeline, setPipeline] = useState<PipelineStage[]>(defaultPipelineStages);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stageTotals, setStageTotals] = useState<Record<string, number>>({});
  const [countries, setCountries] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [bulkQuoteOpen, setBulkQuoteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<LeadStatus | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [activityRow, setActivityRow] = useState<LeadRow | null>(null);

  const stageIds = useMemo(() => pipeline.map((s) => s.id), [pipeline]);

  const stageLabel = useCallback(
    (id: string) => {
      const custom = pipeline.find((s) => s.id === id)?.label.trim();
      if (custom) return custom;
      if (isCoreStageId(id)) return t(`stages.${id}`);
      return id;
    },
    [pipeline, t],
  );

  const stageLabelShort = useCallback(
    (id: string) => {
      const custom = pipeline.find((s) => s.id === id)?.label.trim();
      if (custom) return custom;
      if (isCoreStageId(id)) return t(`stagesShort.${id}`);
      return id;
    },
    [pipeline, t],
  );

  const persistPipeline = useCallback(
    async (next: PipelineStage[]) => {
      setPipeline(next);
      writePipelineToStorage(next);
      try {
        const res = await fetch("/api/pipeline", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stages: next }),
        });
        if (!res.ok && res.status !== 503) {
          const json = (await res.json()) as { error?: string };
          pushToast({
            message: json.error || t("toast.saveFailed"),
            tone: "error",
          });
        }
      } catch {
        // Browser storage already updated.
      }
    },
    [pushToast, t],
  );

  useEffect(() => {
    const local = readPipelineFromStorage();
    if (local?.length) setPipeline(local);
    void (async () => {
      try {
        const res = await fetch("/api/pipeline");
        if (!res.ok) return;
        const json = (await res.json()) as {
          stages?: PipelineStage[];
          source?: string;
        };
        if (json.stages?.length && json.source === "db") {
          setPipeline(json.stages);
          writePipelineToStorage(json.stages);
        } else if (!local?.length && json.stages?.length) {
          setPipeline(json.stages);
        }
      } catch {
        // Keep defaults / localStorage.
      }
    })();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [query, stage, country, tag, kind, priorityFilter, view]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      q: query,
      stage: view === "kanban" ? "all" : stage,
      country,
      tag,
      kind,
      sort: sort.key,
      dir: sort.dir,
      page: view === "kanban" ? "0" : String(page),
      limit: String(view === "kanban" ? KANBAN_LIMIT : PAGE_SIZE),
    });
    if (view === "kanban") params.set("kanban", "1");
    const res = await fetch(`/api/leads?${params}`);
    const json = (await res.json()) as {
      rows?: LeadRow[];
      total?: number;
      countries?: string[];
      tags?: string[];
      stageCounts?: Record<string, number>;
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
    setRows(json.rows ?? []);
    setTotal(json.total ?? 0);
    if (json.stageCounts) {
      setStageTotals(json.stageCounts);
    }
    if (json.countries?.length) setCountries(json.countries);
    if (json.tags) setTags(json.tags);
    setLoading(false);
  }, [country, kind, page, pushToast, query, sort.dir, sort.key, stage, t, tag, view]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    if (!priorityFilter) return rows;
    return rows.filter((row) => row.details.priority === 3);
  }, [priorityFilter, rows]);

  function openLead(row: LeadRow) {
    router.push(`/leads/${encodeURIComponent(row.lead.id)}`);
  }

  const byStage = useMemo(() => {
    const map = Object.fromEntries(stageIds.map((id) => [id, [] as LeadRow[]])) as Record<
      string,
      LeadRow[]
    >;
    const fallback = stageIds[0] ?? "new";
    for (const row of visibleRows) {
      const key = stageIds.includes(row.lead.status) ? row.lead.status : fallback;
      map[key].push(row);
    }
    return map;
  }, [visibleRows, stageIds]);

  const stageCounts = useMemo(() => {
    if (!priorityFilter) {
      const counts: Record<string, number> = {};
      for (const id of stageIds) {
        counts[id] = stageTotals[id] ?? 0;
      }
      return counts;
    }
    const counts: Record<string, number> = Object.fromEntries(
      stageIds.map((id) => [id, 0]),
    );
    const fallback = stageIds[0] ?? "new";
    for (const row of visibleRows) {
      const key = stageIds.includes(row.lead.status) ? row.lead.status : fallback;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [priorityFilter, stageIds, stageTotals, visibleRows]);

  const facets = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    if (kind !== "all") {
      chips.push({
        id: `kind-${kind}`,
        label: kind === "person" ? t("pages.leads.person") : t("pages.leads.company"),
        onRemove: () => setKind("all"),
      });
    }
    if (view === "list" && stage !== "all") {
      chips.push({
        id: `stage-${stage}`,
        label: stageLabel(stage),
        onRemove: () => setStage("all"),
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
    if (priorityFilter) {
      chips.push({
        id: "priority-high",
        label: t("pages.leads.filterHighPriority"),
        onRemove: () => setPriorityFilter(false),
      });
    }
    return chips;
  }, [country, kind, priorityFilter, stage, stageLabel, t, tag, view]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shownTotal = priorityFilter ? visibleRows.length : total;

  function toggleFold(status: LeadStatus) {
    void persistPipeline(
      pipeline.map((s) => (s.id === status ? { ...s, folded: !s.folded } : s)),
    );
  }

  function renameStage(stageRow: PipelineStage, label: string) {
    void persistPipeline(
      pipeline.map((s) => (s.id === stageRow.id ? { ...s, label } : s)),
    );
  }

  function addStage(label: string) {
    const taken = new Set(pipeline.map((s) => s.id));
    const id = slugifyStageId(label, taken);
    void persistPipeline([...pipeline, { id, label, folded: false }]);
  }

  async function deleteStage(stageRow: PipelineStage) {
    if (isCoreStageId(stageRow.id)) return;
    const ok = await confirm({
      title: t("pages.leads.deleteStage"),
      message: t("pages.leads.deleteStageConfirm"),
      confirmLabel: t("common.delete"),
      danger: true,
      run: async () => {
        const fallback =
          (pipeline.find((s) => isCoreStageId(s.id) && s.id !== stageRow.id)?.id ??
            pipeline.find((s) => s.id !== stageRow.id)?.id ??
            stageIds[0] ??
            "new") as LeadStatus;
        const toMove = byStage[stageRow.id] ?? [];
        for (const row of toMove) {
          await moveLead(row.lead.id, fallback);
        }
        await persistPipeline(pipeline.filter((s) => s.id !== stageRow.id));
        pushToast({ message: t("pages.leads.stageDeleted"), tone: "success" });
      },
    });
    if (!ok) return;
  }

  const companyOptions = useMemo(() => {
    const map = new Map<string, QuickCreateOption>();
    for (const row of rows) {
      const company = row.lead.company.trim() || (row.details.isCompany ? row.lead.name.trim() : "");
      if (!company) continue;
      const key = company.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `co-${key}`,
          label: company,
          email: row.details.isCompany ? row.lead.email : undefined,
          phone: row.details.isCompany ? row.lead.phone : undefined,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale, rows]);

  const contactOptions = useMemo(() => {
    const map = new Map<string, QuickCreateOption>();
    for (const row of rows) {
      if (row.details.isCompany) continue;
      const label = row.lead.name.trim();
      if (!label) continue;
      const key = (row.lead.email || label).toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: row.lead.id,
          label,
          company: row.lead.company.trim() || undefined,
          email: row.lead.email || undefined,
          phone: row.lead.phone || undefined,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale, rows]);

  function formFromQuick(stageStatus: LeadStatus, input: QuickCreateInput): ContactWrite {
    const contact = input.contactName.trim();
    const firm = input.company.trim();
    const opportunity = input.name.trim();
    return {
      ...emptyContactWrite(),
      name: contact || opportunity || firm,
      email: input.email,
      phone: input.phone,
      company: firm,
      value: input.value,
      priority: input.priority,
      status: stageStatus,
      isCompany: Boolean(firm && !contact && !input.email.trim()),
      active: true,
      notes:
        opportunity && contact && opportunity !== contact
          ? `Opportunité: ${opportunity}`
          : "",
    };
  }

  async function quickCreate(
    stageStatus: LeadStatus,
    input: QuickCreateInput,
  ): Promise<boolean> {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quickCreate: true,
        status: stageStatus,
        company: input.company,
        contactName: input.contactName,
        opportunityName: input.name,
        email: input.email,
        phone: input.phone,
        value: input.value,
        priority: input.priority,
      }),
    });
    if (!res.ok) return false;
    const label =
      input.contactName.trim() ||
      input.name.trim() ||
      input.company.trim() ||
      input.email.trim();
    pushToast({
      message: t("toast.leadAdded", { name: label }),
      tone: "success",
    });
    await load();
    return true;
  }

  function quickEdit(stageStatus: LeadStatus, input: QuickCreateInput) {
    try {
      sessionStorage.setItem(
        LEAD_FORM_DRAFT_KEY,
        JSON.stringify(formFromQuick(stageStatus, input)),
      );
    } catch {
      /* ignore quota / private mode */
    }
    router.push("/leads/new");
  }

  async function moveLead(id: string, nextStatus: LeadStatus) {
    const current = rows.find((row) => row.lead.id === id);
    if (!current || current.lead.status === nextStatus) return;

    setMovingId(id);
    setRows((prev) =>
      prev.map((row) =>
        row.lead.id === id
          ? { ...row, lead: { ...row.lead, status: nextStatus } }
          : row,
      ),
    );
    setStageTotals((prev) => ({
      ...prev,
      [current.lead.status]: Math.max(0, (prev[current.lead.status] ?? 0) - 1),
      [nextStatus]: (prev[nextStatus] ?? 0) + 1,
    }));

    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nextStatus }),
    });
    setMovingId(null);
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setRows((prev) =>
        prev.map((row) =>
          row.lead.id === id
            ? { ...row, lead: { ...row.lead, status: current.lead.status } }
            : row,
        ),
      );
      setStageTotals((prev) => ({
        ...prev,
        [nextStatus]: Math.max(0, (prev[nextStatus] ?? 0) - 1),
        [current.lead.status]: (prev[current.lead.status] ?? 0) + 1,
      }));
      pushToast({
        message: json.error || t("toast.saveFailed"),
        tone: "error",
      });
      return;
    }
  }

  async function setLeadPriority(id: string, priority: LeadPriority) {
    const current = rows.find((row) => row.lead.id === id);
    if (!current || current.details.priority === priority) return;

    setMovingId(id);
    setRows((prev) =>
      prev.map((row) =>
        row.lead.id === id
          ? { ...row, details: { ...row.details, priority } }
          : row,
      ),
    );
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, priority }),
    });
    setMovingId(null);
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setRows((prev) =>
        prev.map((row) =>
          row.lead.id === id
            ? {
                ...row,
                details: { ...row.details, priority: current.details.priority },
              }
            : row,
        ),
      );
      pushToast({
        message: json.error || t("toast.saveFailed"),
        tone: "error",
      });
    }
  }

  function toggleSort(key: Exclude<SortKey, "completeness">) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "updated" ? "desc" : "asc" },
    );
    setPage(0);
  }

  return (
    <div>
      <PageHeader
        title={t("pages.leads.title")}
        description={t("pages.leads.pipelineDescription", { n: shownTotal })}
        action={
          <button
            type="button"
            className={btnSecondary}
            disabled={tags.length === 0}
            onClick={() => setBulkQuoteOpen(true)}
          >
            {t("pages.sales.bulkQuoteTitle")}
          </button>
        }
      />

      <OdooControlPanel
        query={query}
        onQueryChange={setQuery}
        facets={facets}
        newLabel={t("pages.leads.addLead")}
        onNew={() => router.push("/leads/new")}
        viewMode={view}
        onViewModeChange={setView}
        filterItems={[
          {
            id: "high-priority",
            label: t("pages.leads.filterHighPriority"),
            active: priorityFilter,
            onSelect: () => setPriorityFilter((prev) => !prev),
          },
          {
            id: "person",
            label: t("pages.leads.person"),
            active: kind === "person",
            onSelect: () =>
              setKind((prev) => (prev === "person" ? "all" : "person")),
          },
          {
            id: "company",
            label: t("pages.leads.company"),
            active: kind === "company",
            onSelect: () =>
              setKind((prev) => (prev === "company" ? "all" : "company")),
          },
          ...(view === "list"
            ? pipeline.map((s) => ({
                id: `stage-${s.id}`,
                label: stageLabel(s.id),
                active: stage === s.id,
                onSelect: () =>
                  setStage((prev) => (prev === s.id ? "all" : (s.id as LeadStatus))),
              }))
            : []),
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
        groupByItems={(
          [
            { id: "completeness", key: "completeness" as SortKey },
            { id: "name", key: "name" as SortKey },
            { id: "email", key: "email" as SortKey },
            { id: "updated", key: "updated" as SortKey },
          ] as const
        ).map(({ id, key }) => ({
          id,
          label: t(
            key === "completeness"
              ? "pages.leads.sortCompleteness"
              : key === "updated"
                ? "pages.leads.updated"
                : `common.${key}`,
          ),
          active: sort.key === key,
          onSelect: () => {
            setSort((prev) =>
              prev.key === key
                ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
                : { key, dir: key === "updated" ? "desc" : "asc" },
            );
            setPage(0);
          },
        }))}
      />

      {view === "kanban" ? (
        <div className="mt-4">
          {loading && visibleRows.length === 0 ? (
            <EmptyHint>{t("common.loading")}</EmptyHint>
          ) : visibleRows.length === 0 ? (
            <EmptyHint>
              {shownTotal === 0 && !query
                ? t("pages.leads.noLeads")
                : t("pages.leads.nothingMatches")}
            </EmptyHint>
          ) : (
            <>
              <p className="mb-3 text-xs text-mute">
                {t("pages.leads.kanbanHint", {
                  shown: formatNumber(visibleRows.length, false, locale),
                  total: formatNumber(shownTotal, false, locale),
                })}
              </p>
              <PipelineKanban
                pipeline={pipeline}
                byStage={byStage}
                stageCounts={stageCounts}
                stageLabel={stageLabel}
                stageLabelShort={stageLabelShort}
                draggingId={draggingId}
                dropStage={dropStage}
                movingId={movingId}
                onDragStart={setDraggingId}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropStage(null);
                }}
                onDropStage={(id, next) => void moveLead(id, next)}
                onSetDropStage={setDropStage}
                onOpen={openLead}
                onPriority={(id, priority) => void setLeadPriority(id, priority)}
                onQuickCreate={quickCreate}
                onQuickEdit={quickEdit}
                companyOptions={companyOptions}
                contactOptions={contactOptions}
                onToggleFold={toggleFold}
                onRename={renameStage}
                onAddStage={addStage}
                onDeleteStage={(stageRow) => void deleteStage(stageRow)}
                onScheduleActivity={setActivityRow}
              />
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 border border-line bg-panel">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <h2 className="font-display text-base tracking-wide sm:text-lg">
              {t("pages.leads.count", {
                shown: visibleRows.length,
                total: shownTotal,
              })}
            </h2>
          </div>
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            {loading && visibleRows.length === 0 ? (
              <EmptyHint>{t("common.loading")}</EmptyHint>
            ) : visibleRows.length === 0 ? (
              <EmptyHint>
                {shownTotal === 0 && !query
                  ? t("pages.leads.noLeads")
                  : t("pages.leads.nothingMatches")}
              </EmptyHint>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {visibleRows.map((row) => (
                    <ListCard
                      key={row.lead.id}
                      lead={row.lead}
                      details={row.details}
                      onOpen={() => openLead(row)}
                      stageLabelShort={stageLabelShort}
                    />
                  ))}
                </div>
                <div className="table-wrap -mx-4 hidden sm:-mx-5 lg:block">
                  <table className="data-table data-table-contacts">
                    <thead>
                      <tr>
                        <SortHead
                          label={t("common.name")}
                          active={sort.key === "name"}
                          dir={sort.dir}
                          onClick={() => toggleSort("name")}
                        />
                        <SortHead
                          label={t("common.email")}
                          active={sort.key === "email"}
                          dir={sort.dir}
                          onClick={() => toggleSort("email")}
                        />
                        <th>{t("common.phone")}</th>
                        <th>{t("common.company")}</th>
                        <th>{t("pages.leads.expectedRevenue")}</th>
                        <th>{t("pages.leads.city")}</th>
                        <th>{t("pages.leads.country")}</th>
                        <th>{t("pages.leads.tags")}</th>
                        <SortHead
                          label={t("pages.leads.updated")}
                          active={sort.key === "updated"}
                          dir={sort.dir}
                          onClick={() => toggleSort("updated")}
                        />
                        <th>{t("pages.leads.nextActivity")}</th>
                        <th>{t("pages.leads.stage")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(({ lead, details }) => (
                        <tr
                          key={lead.id}
                          className="cursor-pointer"
                          onClick={() => openLead({ lead, details })}
                        >
                          <td className="font-medium">{lead.name || "—"}</td>
                          <td>
                            {lead.email ? (
                              <a
                                href={`mailto:${lead.email}`}
                                className="text-sand hover:text-gold"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {lead.email}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            {lead.phone ? (
                              <a
                                href={`tel:${lead.phone}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {lead.phone}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{lead.company || "—"}</td>
                          <td className="whitespace-nowrap">
                            {lead.value
                              ? formatMoney(lead.value, lead.currency, false, locale)
                              : "—"}
                          </td>
                          <td>{details.city || "—"}</td>
                          <td>{details.country || "—"}</td>
                          <td>
                            {details.tags ? (
                              <span className="flex flex-wrap gap-1">
                                {tagList(details.tags).map((tagItem) => (
                                  <span
                                    key={tagItem}
                                    className="bg-ash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand"
                                  >
                                    {tagItem}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap text-mute">
                            {formatDate(
                              (details.updated || lead.lastContact).slice(0, 10),
                              locale,
                            )}
                          </td>
                          <td className="max-w-[14rem]">
                            <span className="line-clamp-2">
                              {details.nextActivity || details.activityStatus || "—"}
                            </span>
                          </td>
                          <td>
                            <StatusBadge compact tone={leadTone(lead.status)}>
                              {stageLabelShort(lead.status)}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-col gap-3 text-sm text-mute sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p>
                    {t("pages.leads.pageOf", {
                      from: shownTotal === 0 ? 0 : page * PAGE_SIZE + 1,
                      to: Math.min(shownTotal, page * PAGE_SIZE + visibleRows.length),
                      total: shownTotal,
                    })}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      {t("common.back")}
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={page >= pageCount - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t("pages.leads.nextPage")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <BulkQuoteByTagModal
        open={bulkQuoteOpen}
        initialTag={tag}
        tags={tags}
        onClose={() => setBulkQuoteOpen(false)}
        onDone={() => setBulkQuoteOpen(false)}
      />

      <ScheduleActivityModal
        open={Boolean(activityRow)}
        onClose={() => setActivityRow(null)}
        relatedTo={
          activityRow?.lead.name ||
          activityRow?.lead.email ||
          activityRow?.lead.company ||
          ""
        }
        relatedType="lead"
        relatedId={activityRow?.lead.id ?? ""}
      />
    </div>
  );
}

function ListCard({
  lead,
  details,
  onOpen,
  stageLabelShort,
}: {
  lead: Lead;
  details: ContactDetails;
  onOpen: () => void;
  stageLabelShort: (id: string) => string;
}) {
  const { t, locale } = useLocale();
  const tags = tagList(details.tags);

  return (
    <article>
      <button
        type="button"
        onClick={onOpen}
        className="w-full border border-line bg-canvas px-3.5 py-3 text-left transition-colors active:bg-ash"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium leading-snug break-words">{lead.name || "—"}</p>
            {lead.company && lead.company !== lead.name ? (
              <p className="mt-0.5 text-sm text-mute break-words">{lead.company}</p>
            ) : null}
          </div>
          <StatusBadge compact tone={leadTone(lead.status)}>
            {stageLabelShort(lead.status)}
          </StatusBadge>
        </div>
        <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          <CardField label={t("common.email")} value={lead.email} />
          <CardField label={t("common.phone")} value={lead.phone} />
          <CardField
            label={t("pages.leads.expectedRevenue")}
            value={
              lead.value ? formatMoney(lead.value, lead.currency, false, locale) : ""
            }
          />
          <CardField
            label={t("pages.leads.nextActivity")}
            value={details.nextActivity || details.activityStatus}
            wide
          />
        </dl>
        {tags.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {tags.slice(0, 6).map((tagItem) => (
              <span
                key={tagItem}
                className="bg-ash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand"
              >
                {tagItem}
              </span>
            ))}
          </div>
        ) : null}
      </button>
    </article>
  );
}

function SortHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th>
      <button
        type="button"
        onClick={onClick}
        className={`uppercase tracking-[0.12em] ${active ? "text-gold" : "text-mute"}`}
      >
        {label}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function CardField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  const text = value.trim();
  if (!text) return null;
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm leading-snug">{text}</dd>
    </div>
  );
}
