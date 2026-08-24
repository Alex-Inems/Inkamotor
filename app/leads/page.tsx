"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ContactForm, ContactFormActions } from "@/components/contact-form";
import { PriorityStars } from "@/components/priority-stars";
import { btnGhost, btnPrimary, btnSecondary, inputClass, Modal } from "@/components/modal";
import { EmptyHint, PageHeader, StatusBadge } from "@/components/ui";
import {
  contactWriteFromLead,
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
import { useCrm } from "@/lib/crm-store";
import { type Lead, type LeadStatus } from "@/lib/demo-data";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { leadTone } from "@/lib/status";

const PAGE_SIZE = 75;
const KANBAN_LIMIT = 400;
const FORM_ID = "lead-contact-form";

type ViewMode = "kanban" | "list";
type SortKey = "completeness" | "name" | "email" | "updated";
type LeadRow = { lead: Lead; details: ContactDetails; score?: number };

export default function LeadsPage() {
  const { sales, addSale, pushToast } = useCrm();
  const { t, locale } = useLocale();
  const [view, setView] = useState<ViewMode>("kanban");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [stage, setStage] = useState<LeadStatus | "all">("all");
  const [country, setCountry] = useState("all");
  const [kind, setKind] = useState<"all" | "person" | "company">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "completeness",
    dir: "desc",
  });
  const [page, setPage] = useState(0);
  const [pipeline, setPipeline] = useState<PipelineStage[]>(defaultPipelineStages);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<LeadRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [quickStage, setQuickStage] = useState<LeadStatus | null>(null);
  const [form, setForm] = useState<ContactWrite>(emptyContactWrite);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stageTotals, setStageTotals] = useState<Record<string, number>>({});
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<LeadStatus | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

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
    const timer = window.setTimeout(() => {
      setQuery(draft.trim());
      setPage(0);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      q: query,
      stage: view === "kanban" ? "all" : stage,
      country,
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
    setLoading(false);
  }, [country, kind, page, pushToast, query, sort.dir, sort.key, stage, t, view]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const selected = useMemo(() => {
    if (selectedRow && selectedRow.lead.id === selectedId) return selectedRow;
    return rows.find((row) => row.lead.id === selectedId) ?? selectedRow;
  }, [rows, selectedId, selectedRow]);

  function openLead(row: LeadRow) {
    setAdding(false);
    setQuickStage(null);
    setFormError("");
    setSelectedRow(row);
    setSelectedId(row.lead.id);
  }

  function closeEditor() {
    setAdding(false);
    setQuickStage(null);
    setSelectedId(null);
    setSelectedRow(null);
    setFormError("");
  }

  function openQuickAdd(status: LeadStatus) {
    setSelectedId(null);
    setSelectedRow(null);
    setQuickStage(status);
    setAdding(true);
  }

  const byStage = useMemo(() => {
    const map = Object.fromEntries(stageIds.map((id) => [id, [] as LeadRow[]])) as Record<
      string,
      LeadRow[]
    >;
    const fallback = stageIds[0] ?? "new";
    for (const row of rows) {
      const key = stageIds.includes(row.lead.status) ? row.lead.status : fallback;
      map[key].push(row);
    }
    return map;
  }, [rows, stageIds]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of stageIds) {
      counts[id] = stageTotals[id] ?? 0;
    }
    return counts;
  }, [stageIds, stageTotals]);

  useEffect(() => {
    if (adding) {
      setForm({
        ...emptyContactWrite(),
        status: quickStage ?? stageIds[0] ?? "new",
      });
      setFormError("");
      return;
    }
    if (selected) {
      setForm(contactWriteFromLead(selected.lead, selected.details));
      setFormError("");
    }
  }, [adding, quickStage, selected, stageIds]);

  const booked = selected
    ? sales.some(
        (s) =>
          s.leadId === selected.lead.id ||
          (selected.lead.email &&
            s.email.toLowerCase() === selected.lead.email.toLowerCase()),
      )
    : false;

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleFold(status: LeadStatus) {
    void persistPipeline(
      pipeline.map((s) => (s.id === status ? { ...s, folded: !s.folded } : s)),
    );
  }

  function beginRename(stageRow: PipelineStage) {
    setEditingStageId(stageRow.id);
    setEditingLabel(stageLabel(stageRow.id));
    setAddingColumn(false);
  }

  function commitRename() {
    if (!editingStageId) return;
    const label = editingLabel.trim();
    if (!label) {
      setEditingStageId(null);
      return;
    }
    void persistPipeline(
      pipeline.map((s) =>
        s.id === editingStageId ? { ...s, label } : s,
      ),
    );
    setEditingStageId(null);
  }

  function addColumn() {
    const label = newColumnLabel.trim();
    if (!label) return;
    const taken = new Set(pipeline.map((s) => s.id));
    const id = slugifyStageId(label, taken);
    void persistPipeline([...pipeline, { id, label, folded: false }]);
    setNewColumnLabel("");
    setAddingColumn(false);
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
    if (selectedRow?.lead.id === id) {
      setSelectedRow({
        ...selectedRow,
        details: { ...selectedRow.details, priority },
      });
    }

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
      if (selectedRow?.lead.id === id) {
        setSelectedRow({
          ...selectedRow,
          details: { ...selectedRow.details, priority: current.details.priority },
        });
      }
      pushToast({
        message: json.error || t("toast.saveFailed"),
        tone: "error",
      });
    }
  }

  async function saveContact() {
    if (!form.name.trim()) {
      setFormError(t("pages.leads.nameRequired"));
      return;
    }
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/leads", {
      method: adding ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adding ? form : { ...form, id: selectedId }),
    });
    const json = (await res.json()) as {
      error?: string;
      row?: LeadRow;
    };
    setSaving(false);
    if (!res.ok) {
      setFormError(json.error || t("toast.saveFailed"));
      return;
    }
    pushToast({
      message: adding
        ? t("toast.leadAdded", { name: form.name.trim() })
        : t("toast.leadSaved"),
      tone: "success",
    });
    const savedId = json.row?.lead.id;
    setAdding(false);
    setQuickStage(null);
    if (savedId) setSelectedId(savedId);
    await load();
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
        description={t("pages.leads.pipelineDescription", { n: total })}
        action={
          <div className="flex flex-wrap gap-2">
            <div
              role="group"
              aria-label={t("pages.leads.viewMode")}
              className="flex border border-line"
            >
              <button
                type="button"
                aria-pressed={view === "kanban"}
                className={`min-h-11 px-3 text-xs font-semibold uppercase tracking-[0.08em] ${
                  view === "kanban"
                    ? "bg-accent text-white"
                    : "bg-panel text-mute hover:bg-ash hover:text-ink"
                }`}
                onClick={() => setView("kanban")}
              >
                {t("pages.leads.kanban")}
              </button>
              <button
                type="button"
                aria-pressed={view === "list"}
                className={`min-h-11 px-3 text-xs font-semibold uppercase tracking-[0.08em] ${
                  view === "list"
                    ? "bg-accent text-white"
                    : "bg-panel text-mute hover:bg-ash hover:text-ink"
                }`}
                onClick={() => setView("list")}
              >
                {t("pages.leads.list")}
              </button>
            </div>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                setSelectedId(null);
                setQuickStage("new");
                setAdding(true);
              }}
            >
              {t("pages.leads.addLead")}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <input
          className={`${inputClass} col-span-2 lg:col-span-1`}
          placeholder={t("pages.leads.searchTable")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {view === "list" ? (
          <select
            className={inputClass}
            value={stage}
            onChange={(e) => {
              setStage(e.target.value as LeadStatus | "all");
              setPage(0);
            }}
          >
            <option value="all">{t("common.allStatuses")}</option>
            {pipeline.map((s) => (
              <option key={s.id} value={s.id}>
                {stageLabel(s.id)}
              </option>
            ))}
          </select>
        ) : (
          <div className="hidden lg:block" />
        )}
        <select
          className={inputClass}
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">{t("pages.leads.allCountries")}</option>
          {countries.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} col-span-2 lg:col-span-1`}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as "all" | "person" | "company");
            setPage(0);
          }}
        >
          <option value="all">{t("pages.leads.allKinds")}</option>
          <option value="person">{t("pages.leads.person")}</option>
          <option value="company">{t("pages.leads.company")}</option>
        </select>
      </div>

      {view === "kanban" ? (
        <div className="mt-4">
          {loading && rows.length === 0 ? (
            <EmptyHint>{t("common.loading")}</EmptyHint>
          ) : rows.length === 0 ? (
            <EmptyHint>
              {total === 0 && !query
                ? t("pages.leads.noLeads")
                : t("pages.leads.nothingMatches")}
            </EmptyHint>
          ) : (
            <>
              <p className="mb-3 text-xs text-mute">
                {t("pages.leads.kanbanHint", {
                  shown: formatNumber(rows.length, false, locale),
                  total: formatNumber(total, false, locale),
                })}
              </p>
              <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-4 sm:mx-0 sm:px-0">
                {pipeline.map((stageRow) => {
                  const status = stageRow.id;
                  const isFolded = stageRow.folded;
                  const cards = byStage[status] ?? [];
                  const isDropTarget = dropStage === status;
                  const renaming = editingStageId === status;
                  return (
                    <section
                      key={status}
                      className={`flex shrink-0 flex-col border border-line bg-panel ${
                        isFolded ? "w-14" : "w-[min(18.5rem,82vw)]"
                      } ${isDropTarget ? "border-gold bg-gold/5" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDropStage(status);
                      }}
                      onDragLeave={() => {
                        setDropStage((prev) => (prev === status ? null : prev));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/lead-id") || draggingId;
                        setDropStage(null);
                        setDraggingId(null);
                        if (id) void moveLead(id, status);
                      }}
                    >
                      <header
                        className={`flex items-center gap-2 border-b border-line px-2.5 py-2.5 ${
                          isFolded ? "flex-col px-1.5" : ""
                        }`}
                      >
                        {isFolded ? (
                          <button
                            type="button"
                            className="flex h-full min-h-48 w-full flex-col items-center justify-start gap-3 py-2 text-mute hover:text-ink"
                            onClick={() => toggleFold(status)}
                            title={stageLabel(status)}
                          >
                            <span className="text-[10px] font-bold">
                              {stageCounts[status] ?? 0}
                            </span>
                            <span className="origin-center rotate-180 text-[11px] font-semibold uppercase tracking-[0.12em] [writing-mode:vertical-rl]">
                              {stageLabelShort(status)}
                            </span>
                          </button>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              {renaming ? (
                                <input
                                  className={`${inputClass} py-1 text-xs font-semibold uppercase tracking-[0.08em]`}
                                  value={editingLabel}
                                  autoFocus
                                  aria-label={t("pages.leads.renameColumn")}
                                  onChange={(e) => setEditingLabel(e.target.value)}
                                  onBlur={commitRename}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitRename();
                                    }
                                    if (e.key === "Escape") {
                                      setEditingStageId(null);
                                    }
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="block w-full truncate text-left text-xs font-semibold uppercase tracking-[0.1em] text-ink hover:text-gold"
                                  title={t("pages.leads.renameColumn")}
                                  onClick={() => beginRename(stageRow)}
                                >
                                  {stageLabel(status)}
                                </button>
                              )}
                              <p className="mt-0.5 text-[11px] text-mute">
                                {t("pages.leads.stageCount", {
                                  n: formatNumber(stageCounts[status] ?? 0, false, locale),
                                })}
                              </p>
                            </div>
                            <button
                              type="button"
                              className={btnGhost}
                              aria-label={t("pages.leads.quickAdd")}
                              onClick={() => openQuickAdd(status)}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              aria-label={t("pages.leads.foldStage")}
                              onClick={() => toggleFold(status)}
                            >
                              «
                            </button>
                          </>
                        )}
                      </header>
                      {!isFolded ? (
                        <div className="flex max-h-[min(70vh,42rem)] flex-1 flex-col gap-2 overflow-y-auto p-2">
                          {cards.length === 0 ? (
                            <p className="px-1 py-8 text-center text-xs text-mute">
                              {t("pages.leads.emptyStage")}
                            </p>
                          ) : (
                            cards.map((row) => (
                              <KanbanCard
                                key={row.lead.id}
                                row={row}
                                busy={movingId === row.lead.id}
                                dragging={draggingId === row.lead.id}
                                onOpen={() => openLead(row)}
                                onPriority={(priority) =>
                                  void setLeadPriority(row.lead.id, priority)
                                }
                                onDragStart={() => setDraggingId(row.lead.id)}
                                onDragEnd={() => {
                                  setDraggingId(null);
                                  setDropStage(null);
                                }}
                              />
                            ))
                          )}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
                <section className="flex w-[min(16rem,75vw)] shrink-0 flex-col border border-dashed border-line bg-panel/40">
                  <div className="flex flex-1 flex-col items-stretch justify-center gap-2 p-3">
                    {addingColumn ? (
                      <>
                        <input
                          className={inputClass}
                          value={newColumnLabel}
                          autoFocus
                          placeholder={t("pages.leads.columnName")}
                          onChange={(e) => setNewColumnLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addColumn();
                            }
                            if (e.key === "Escape") {
                              setAddingColumn(false);
                              setNewColumnLabel("");
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={btnPrimary}
                            onClick={addColumn}
                          >
                            {t("pages.leads.addColumn")}
                          </button>
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => {
                              setAddingColumn(false);
                              setNewColumnLabel("");
                            }}
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={`${btnSecondary} w-full`}
                        onClick={() => {
                          setAddingColumn(true);
                          setEditingStageId(null);
                        }}
                      >
                        {t("pages.leads.addColumn")}
                      </button>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 border border-line bg-panel">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <h2 className="font-display text-base tracking-wide sm:text-lg">
              {t("pages.leads.count", {
                shown: rows.length,
                total,
              })}
            </h2>
          </div>
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            {loading && rows.length === 0 ? (
              <EmptyHint>{t("common.loading")}</EmptyHint>
            ) : rows.length === 0 ? (
              <EmptyHint>
                {total === 0 && !query
                  ? t("pages.leads.noLeads")
                  : t("pages.leads.nothingMatches")}
              </EmptyHint>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {rows.map((row) => (
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
                      {rows.map(({ lead, details }) => (
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
                                {tagList(details.tags).map((tag) => (
                                  <span
                                    key={tag}
                                    className="bg-ash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand"
                                  >
                                    {tag}
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
                      from: total === 0 ? 0 : page * PAGE_SIZE + 1,
                      to: Math.min(total, page * PAGE_SIZE + rows.length),
                      total,
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

      <Modal
        open={adding || Boolean(selected)}
        title={
          adding
            ? t("pages.leads.newContact")
            : selected?.lead.name || t("pages.leads.editContact")
        }
        onClose={closeEditor}
        wide
        footer={
          <ContactFormActions
            formId={FORM_ID}
            saving={saving}
            error={formError}
            onCancel={closeEditor}
            extraActions={
              selected && !adding ? (
                <>
                  {selected.lead.email ? (
                    <Link
                      href={`/inbox?chat=${encodeURIComponent(selected.lead.email)}`}
                      className={btnSecondary}
                    >
                      {t("pages.leads.openChat")}
                    </Link>
                  ) : null}
                  {!booked ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() =>
                        void addSale({
                          customer: selected.lead.name,
                          email: selected.lead.email,
                          product:
                            selected.lead.notes.slice(0, 80) ||
                            t("pages.leads.tourBooking"),
                          amount: selected.lead.value || 0,
                          source: "lead",
                          inquiryId: null,
                          leadId: selected.lead.id,
                          notes: selected.lead.notes,
                        })
                      }
                    >
                      {t("pages.leads.createSale")}
                    </button>
                  ) : null}
                </>
              ) : null
            }
          />
        }
      >
        <ContactForm
          formId={FORM_ID}
          value={form}
          onChange={setForm}
          onSubmit={() => void saveContact()}
          stages={pipeline}
          stageLabel={stageLabel}
        />
      </Modal>
    </div>
  );
}

function KanbanCard({
  row,
  busy,
  dragging,
  onOpen,
  onPriority,
  onDragStart,
  onDragEnd,
}: {
  row: LeadRow;
  busy: boolean;
  dragging: boolean;
  onOpen: () => void;
  onPriority: (priority: LeadPriority) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { t, locale } = useLocale();
  const { lead, details } = row;
  const tags = tagList(details.tags).slice(0, 3);
  const activity = details.nextActivity || details.activityStatus || details.upcomingActivity;
  const suppressClick = useRef(false);
  const initials = leadInitials(lead.name, lead.email, lead.company);
  const tone = avatarTone(lead.email || lead.id || lead.name);

  return (
    <article
      draggable={!busy}
      aria-label={t("pages.leads.dragToMove")}
      title={t("pages.leads.dragToMove")}
      onDragStart={(e) => {
        suppressClick.current = true;
        e.dataTransfer.setData("text/lead-id", lead.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`border border-line bg-canvas transition-colors ${
        dragging || busy ? "opacity-50" : ""
      } ${busy ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onOpen();
        }}
        className="w-full px-3 pb-1.5 pt-2.5 text-left hover:bg-ash/60 disabled:opacity-50"
      >
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${tone}`}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {lead.name || t("common.dash")}
                </p>
                {lead.company && lead.company !== lead.name ? (
                  <p className="mt-0.5 truncate text-xs text-mute">{lead.company}</p>
                ) : null}
              </div>
              {lead.value > 0 ? (
                <p className="shrink-0 text-xs font-semibold text-gold">
                  {formatMoney(lead.value, lead.currency, true, locale)}
                </p>
              ) : null}
            </div>
            {activity ? (
              <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-sand">
                {activity}
              </p>
            ) : null}
            {tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-ash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mute"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pl-[3.25rem]">
        <PriorityStars
          value={details.priority}
          disabled={busy}
          onChange={onPriority}
        />
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-mute">
          <span>
            {details.country || details.city || t(`sources.${lead.source}`)}
          </span>
          <span>
            {formatDate((details.updated || lead.lastContact).slice(0, 10), locale)}
          </span>
        </div>
      </div>
    </article>
  );
}

const AVATAR_TONES = [
  "bg-[#3d8b7a]",
  "bg-[#c47a3a]",
  "bg-[#5a7aa8]",
  "bg-[#8a5a7a]",
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

function leadInitials(name: string, email: string, company: string) {
  const base = (name || company || email.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : base.slice(0, 2);
  return (letters || "?").toUpperCase();
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
            {tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="bg-ash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand"
              >
                {tag}
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
