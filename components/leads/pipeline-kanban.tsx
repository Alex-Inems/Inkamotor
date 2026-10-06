"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PriorityStars } from "@/components/priority-stars";
import {
  Modal,
  btnGhost,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/modal";
import {
  tagList,
  type ContactDetails,
  type LeadPriority,
} from "@/lib/crm/contact-details";
import { isCoreStageId, type PipelineStage } from "@/lib/crm/pipeline";
import { type Lead, type LeadStatus } from "@/lib/demo-data";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

export type LeadRow = { lead: Lead; details: ContactDetails; score?: number };

export type QuickCreateInput = {
  company: string;
  contactName: string;
  name: string;
  email: string;
  phone: string;
  value: number;
  priority: LeadPriority;
};

export type QuickCreateOption = {
  id: string;
  label: string;
  company?: string;
  email?: string;
  phone?: string;
};

/** Soft theme border + panel fill — same for every stage. */
const STAGE_TONE = {
  column: "bg-panel",
  header: "border-line",
  accent: "bg-[#556ee6]",
  chip: "bg-[color-mix(in_srgb,#556ee6_16%,var(--ash))] text-[#4458c9]",
} as const;

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

function leadInitials(name: string, email: string, company: string) {
  const base = (name || company || email.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : base.slice(0, 2);
  return (letters || "?").toUpperCase();
}

function stageTone(_index: number) {
  return STAGE_TONE;
}

export function PipelineKanban({
  pipeline,
  byStage,
  stageCounts,
  stageLabel,
  stageLabelShort,
  draggingId,
  dropStage,
  movingId,
  onDragStart,
  onDragEnd,
  onDropStage,
  onSetDropStage,
  onOpen,
  onPriority,
  onQuickCreate,
  onQuickEdit,
  companyOptions,
  contactOptions,
  onToggleFold,
  onRename,
  onAddStage,
  onDeleteStage,
  onScheduleActivity,
}: {
  pipeline: PipelineStage[];
  byStage: Record<string, LeadRow[]>;
  stageCounts: Record<string, number>;
  stageLabel: (id: string) => string;
  stageLabelShort: (id: string) => string;
  draggingId: string | null;
  dropStage: LeadStatus | null;
  movingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropStage: (id: string, stage: LeadStatus) => void;
  onSetDropStage: (stage: LeadStatus | null) => void;
  onOpen: (row: LeadRow) => void;
  onPriority: (id: string, priority: LeadPriority) => void;
  onQuickCreate: (
    stage: LeadStatus,
    input: QuickCreateInput,
  ) => Promise<boolean>;
  onQuickEdit: (stage: LeadStatus, input: QuickCreateInput) => void;
  companyOptions: QuickCreateOption[];
  contactOptions: QuickCreateOption[];
  onToggleFold: (stage: LeadStatus) => void;
  onRename: (stage: PipelineStage, label: string) => void;
  onAddStage: (label: string) => void;
  onDeleteStage: (stage: PipelineStage) => void;
  onScheduleActivity: (row: LeadRow) => void;
}) {
  const { t, locale } = useLocale();
  const [menuStage, setMenuStage] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [quickStage, setQuickStage] = useState<LeadStatus | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuStage(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="-mx-3 flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain px-3 pb-4 sm:mx-0 sm:gap-3.5 sm:px-0">
      {pipeline.map((stageRow, index) => {
        const status = stageRow.id;
        const tone = stageTone(index);
        const isFolded = stageRow.folded;
        const cards = byStage[status] ?? [];
        const isDropTarget = dropStage === status;
        const revenue = cards.reduce((sum, row) => sum + (row.lead.value || 0), 0);
        const currency =
          cards.find((row) => row.lead.value > 0)?.lead.currency || "EUR";
        const renaming = renamingId === status;
        const quickOpen = quickStage === status;

        return (
          <section
            key={status}
            className={`o-kanban-column flex shrink-0 flex-col rounded-xl border ${tone.column} ${tone.header} ${
              isFolded ? "w-12" : "w-[min(17.5rem,calc(100vw-2.75rem))]"
            } ${isDropTarget ? "ring-2 ring-mute/35" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              onSetDropStage(status);
            }}
            onDragLeave={() => {
              if (dropStage === status) onSetDropStage(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/lead-id") || draggingId;
              onSetDropStage(null);
              onDragEnd();
              if (id) onDropStage(id, status);
            }}
          >
            {isFolded ? (
              <button
                type="button"
                className="flex h-full min-h-[22rem] w-full flex-col items-center gap-3 py-3 text-mute hover:text-ink"
                onClick={() => onToggleFold(status)}
                title={stageLabel(status)}
              >
                <span
                  className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-bold text-white shadow-sm ${tone.accent}`}
                >
                  {stageCounts[status] ?? 0}
                </span>
                <span className="origin-center rotate-180 text-[11px] font-semibold tracking-[0.08em] [writing-mode:vertical-rl]">
                  {stageLabelShort(status)}
                </span>
              </button>
            ) : (
              <>
                <header className="flex items-start gap-1 border-b border-line/50 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    {renaming ? (
                      <input
                        className={`${inputClass} py-1 text-sm font-semibold`}
                        value={renameValue}
                        autoFocus
                        aria-label={t("pages.leads.renameColumn")}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => {
                          const label = renameValue.trim();
                          if (label) onRename(stageRow, label);
                          setRenamingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const label = renameValue.trim();
                            if (label) onRename(stageRow, label);
                            setRenamingId(null);
                          }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                    ) : (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold text-ink">
                          {stageLabel(status)}
                        </h3>
                        <span
                          className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-[11px] font-bold text-white shadow-sm ${tone.accent}`}
                          title={stageLabel(status)}
                        >
                          {formatNumber(stageCounts[status] ?? 0, false, locale)}
                        </span>
                      </div>
                    )}
                    {revenue > 0 ? (
                      <p className="mt-0.5 truncate text-[11px] font-medium text-mute">
                        {formatMoney(revenue, currency, true, locale)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-mute">
                        {t("pages.leads.noExpectedRevenue")}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className={btnGhost}
                    aria-label={t("pages.leads.quickAdd")}
                    title={t("pages.leads.quickAdd")}
                    onClick={() => {
                      setQuickStage(status);
                      setMenuStage(null);
                    }}
                  >
                    +
                  </button>

                  <div
                    className="relative"
                    ref={menuStage === status ? menuRef : undefined}
                  >
                    <button
                      type="button"
                      className={btnGhost}
                      aria-label={t("pages.leads.stageSettings")}
                      aria-expanded={menuStage === status}
                      onClick={() =>
                        setMenuStage((prev) => (prev === status ? null : status))
                      }
                    >
                      ⚙
                    </button>
                    {menuStage === status ? (
                      <div className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-xl">
                        <MenuItem
                          label={t("pages.leads.foldStage")}
                          onClick={() => {
                            setMenuStage(null);
                            onToggleFold(status);
                          }}
                        />
                        <MenuItem
                          label={t("pages.leads.renameColumn")}
                          onClick={() => {
                            setMenuStage(null);
                            setRenamingId(status);
                            setRenameValue(stageLabel(status));
                          }}
                        />
                        {!isCoreStageId(status) ? (
                          <MenuItem
                            label={t("pages.leads.deleteStage")}
                            danger
                            onClick={() => {
                              setMenuStage(null);
                              onDeleteStage(stageRow);
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </header>

                <div className="max-h-[min(72vh,44rem)] flex-1 space-y-2 overflow-y-auto overflow-x-hidden p-2">
                  {quickOpen ? (
                    <QuickCreateCard
                      companyOptions={companyOptions}
                      contactOptions={contactOptions}
                      onCancel={() => setQuickStage(null)}
                      onEdit={(input) => {
                        setQuickStage(null);
                        onQuickEdit(status, input);
                      }}
                      onSubmit={async (input) => {
                        const ok = await onQuickCreate(status, input);
                        if (ok) setQuickStage(null);
                        return ok;
                      }}
                    />
                  ) : null}

                  {cards.length === 0 && !quickOpen ? (
                    <p className="px-1 py-10 text-center text-xs text-mute">
                      {t("pages.leads.emptyStage")}
                    </p>
                  ) : (
                    cards.map((row) => (
                      <KanbanCard
                        key={row.lead.id}
                        row={row}
                        chipClass={tone.chip}
                        busy={movingId === row.lead.id}
                        dragging={draggingId === row.lead.id}
                        onOpen={() => onOpen(row)}
                        onPriority={(priority) =>
                          onPriority(row.lead.id, priority)
                        }
                        onSchedule={() => onScheduleActivity(row)}
                        onDragStart={() => onDragStart(row.lead.id)}
                        onDragEnd={onDragEnd}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        );
      })}

      <section className="flex w-[min(15rem,72vw)] shrink-0 flex-col justify-start rounded-xl border border-dashed border-line/80 bg-panel/30 p-3">
        {addingColumn ? (
          <div className="space-y-2">
            <input
              className={inputClass}
              value={newColumnLabel}
              autoFocus
              placeholder={t("pages.leads.columnName")}
              onChange={(e) => setNewColumnLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const label = newColumnLabel.trim();
                  if (!label) return;
                  onAddStage(label);
                  setNewColumnLabel("");
                  setAddingColumn(false);
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
                onClick={() => {
                  const label = newColumnLabel.trim();
                  if (!label) return;
                  onAddStage(label);
                  setNewColumnLabel("");
                  setAddingColumn(false);
                }}
              >
                {t("pages.leads.addStage")}
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
          </div>
        ) : (
          <button
            type="button"
            className={`${btnSecondary} w-full`}
            onClick={() => setAddingColumn(true)}
          >
            {t("pages.leads.addStage")}
          </button>
        )}
      </section>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`block w-full px-3 py-2 text-left text-xs hover:bg-ash ${
        danger ? "text-[#f07171]" : "text-ink"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function QuickCreateCard({
  companyOptions,
  contactOptions,
  onCancel,
  onEdit,
  onSubmit,
}: {
  companyOptions: QuickCreateOption[];
  contactOptions: QuickCreateOption[];
  onCancel: () => void;
  onEdit: (input: QuickCreateInput) => void;
  onSubmit: (input: QuickCreateInput) => Promise<boolean>;
}) {
  const { t, locale } = useLocale();
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [value, setValue] = useState("0");
  const [priority, setPriority] = useState<LeadPriority>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function draft(): QuickCreateInput {
    const opportunity = name.trim();
    const contact = contactName.trim();
    const firm = company.trim();
    return {
      company: firm,
      contactName: contact,
      name: opportunity || contact || firm,
      email: email.trim(),
      phone: phone.trim(),
      value: Number(String(value).replace(",", ".")) || 0,
      priority,
    };
  }

  async function submit() {
    const input = draft();
    if (!input.name) {
      setError(t("pages.leads.nameRequired"));
      return;
    }
    setBusy(true);
    setError("");
    const ok = await onSubmit(input);
    setBusy(false);
    if (!ok) setError(t("toast.saveFailed"));
  }

  return (
    <div className="o-quick-create shrink-0 overflow-hidden rounded-xl border border-line bg-panel shadow-[0_12px_32px_-16px_rgba(0,0,0,0.7)]">
      <SuggestField
        icon={<BuildingIcon />}
        placeholder={t("pages.leads.society")}
        value={company}
        disabled={busy}
        options={companyOptions}
        searchKind="company"
        dropdown
        onChange={setCompany}
        onSelect={(opt) => {
          setCompany(opt.label);
        }}
        onEscape={onCancel}
      />
      <SuggestField
        icon={<PersonIcon />}
        placeholder={t("pages.leads.contact")}
        value={contactName}
        disabled={busy}
        options={contactOptions}
        searchKind="person"
        dropdown
        onChange={setContactName}
        onSelect={(opt) => {
          setContactName(opt.label);
          if (opt.company) setCompany(opt.company);
          if (opt.email) setEmail(opt.email);
          if (opt.phone) setPhone(opt.phone);
          if (!name.trim()) setName(opt.label);
        }}
        onEscape={onCancel}
      />
      <SuggestField
        icon={<BriefcaseIcon />}
        placeholder={t("pages.leads.opportunityName")}
        value={name}
        disabled={busy}
        onChange={setName}
        onEnter={() => void submit()}
        onEscape={onCancel}
      />
      <SuggestField
        icon={<MailIcon />}
        placeholder={t("pages.leads.contactEmail")}
        value={email}
        disabled={busy}
        onChange={setEmail}
        onEscape={onCancel}
      />
      <SuggestField
        icon={<PhoneIcon />}
        placeholder={t("pages.leads.contactPhone")}
        value={phone}
        disabled={busy}
        onChange={setPhone}
        onEscape={onCancel}
      />
      <div className="flex items-center gap-2 border-b border-line/60 px-2.5 py-2">
        <span className="shrink-0 text-mute" aria-hidden>
          <MoneyIcon />
        </span>
        <input
          className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-ink outline-none placeholder:text-mute"
          inputMode="decimal"
          disabled={busy}
          value={value}
          aria-label={t("pages.leads.expectedRevenue")}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape") onCancel();
          }}
        />
        <span className="shrink-0 text-xs text-mute">
          {locale.startsWith("fr") || locale.startsWith("es") ? "€" : "€"}
        </span>
        <PriorityStars
          value={priority}
          disabled={busy}
          onChange={setPriority}
        />
      </div>
      {error ? (
        <p className="px-3 py-1.5 text-xs text-[#f07171]">{error}</p>
      ) : null}
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <button
          type="button"
          className={`${btnPrimary} min-h-9 px-3 text-xs`}
          disabled={busy}
          onClick={() => void submit()}
        >
          {t("common.add")}
        </button>
        <button
          type="button"
          className={`${btnSecondary} min-h-9 px-3 text-xs`}
          disabled={busy}
          onClick={() => {
            const input = draft();
            if (!input.name) {
              setError(t("pages.leads.nameRequired"));
              return;
            }
            onEdit(input);
          }}
        >
          {t("common.edit")}
        </button>
        <button
          type="button"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-ash text-mute hover:text-ink"
          disabled={busy}
          aria-label={t("common.discard")}
          title={t("common.discard")}
          onClick={onCancel}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function SuggestField({
  icon,
  placeholder,
  value,
  disabled,
  options = [],
  dropdown = false,
  searchKind,
  autoFocus = false,
  onChange,
  onSelect,
  onEnter,
  onEscape,
}: {
  icon: ReactNode;
  placeholder: string;
  value: string;
  disabled?: boolean;
  options?: QuickCreateOption[];
  dropdown?: boolean;
  searchKind?: "company" | "person";
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onSelect?: (opt: QuickCreateOption) => void;
  onEnter?: () => void;
  onEscape?: () => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const q = value.trim().toLowerCase();
  const filtered = dropdown
    ? options
        .filter((opt) => !q || opt.label.toLowerCase().includes(q))
        .slice(0, 8)
    : [];
  const showMenu = dropdown && open;

  useEffect(() => {
    if (!dropdown) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [dropdown]);

  return (
    <div
      ref={rootRef}
      className="relative flex items-center gap-2 border-b border-line/60 px-2.5 py-1.5"
    >
      <span className="shrink-0 text-mute" aria-hidden>
        {icon}
      </span>
      <input
        className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-mute"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        onFocus={() => {
          if (dropdown) setOpen(true);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          if (dropdown) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
          }
          if (e.key === "Escape") {
            if (open) {
              setOpen(false);
              return;
            }
            onEscape?.();
          }
        }}
      />
      {dropdown ? (
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="shrink-0 text-mute hover:text-ink"
          aria-label={t("pages.leads.showSuggestions")}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDownIcon />
        </button>
      ) : null}
      {showMenu ? (
        <ul className="absolute left-0 right-0 top-full z-40 max-h-52 overflow-y-auto border border-line bg-panel py-1 shadow-xl">
          {filtered.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-ash"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect?.(opt);
                  setOpen(false);
                }}
              >
                <span className="truncate text-sm text-ink">{opt.label}</span>
                {opt.email || opt.company ? (
                  <span className="truncate text-[11px] text-mute">
                    {[opt.company, opt.email].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-mute">
              {t("pages.leads.noSuggestions")}
            </li>
          ) : null}
          {searchKind ? (
            <li className="border-t border-line/70">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-ink hover:bg-ash"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setAdvancedOpen(true);
                }}
              >
                <SearchIcon />
                {t("pages.leads.searchMore")}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      {searchKind ? (
        <AdvancedSearchModal
          open={advancedOpen}
          kind={searchKind}
          initialQuery={value}
          onClose={() => setAdvancedOpen(false)}
          onSelect={(opt) => {
            onSelect?.(opt);
            setAdvancedOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function AdvancedSearchModal({
  open,
  kind,
  initialQuery,
  onClose,
  onSelect,
}: {
  open: boolean;
  kind: "company" | "person";
  initialQuery: string;
  onClose: () => void;
  onSelect: (opt: QuickCreateOption) => void;
}) {
  const { t, locale } = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState(initialQuery);
  const [rows, setRows] = useState<QuickCreateOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = 50;

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setDraft(initialQuery);
    setPage(0);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setQuery(draft.trim());
      setPage(0);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [draft, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          kind,
          stage: "all",
          country: "all",
          tag: "all",
          sort: "name",
          dir: "asc",
          page: String(page),
          limit: String(pageSize),
        });
        const res = await fetch(`/api/leads?${params}`);
        const json = (await res.json()) as {
          rows?: {
            lead: Lead;
            details: ContactDetails;
          }[];
          total?: number;
        };
        if (cancelled) return;
        if (!res.ok) {
          setRows([]);
          setTotal(0);
          return;
        }
        const next = (json.rows ?? []).map((row) => {
          if (kind === "company") {
            const label =
              row.lead.company.trim() ||
              (row.details.isCompany ? row.lead.name.trim() : "") ||
              row.lead.name.trim();
            return {
              id: row.lead.id,
              label,
              company: label,
              email: row.lead.email || undefined,
              phone: row.lead.phone || undefined,
            } satisfies QuickCreateOption;
          }
          return {
            id: row.lead.id,
            label: row.lead.name.trim() || row.lead.email || "—",
            company: row.lead.company.trim() || undefined,
            email: row.lead.email || undefined,
            phone: row.lead.phone || undefined,
          } satisfies QuickCreateOption;
        });
        setRows(next);
        setTotal(json.total ?? next.length);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, open, page, query]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const title =
    kind === "company"
      ? t("pages.leads.searchCompanies")
      : t("pages.leads.searchContacts");

  return (
    <Modal
      open={open}
      title={title}
      subtitle={t("pages.leads.searchMoreHint")}
      onClose={onClose}
      wide
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-mute">
            {t("pages.leads.pageOf", {
              from: total === 0 ? 0 : page * pageSize + 1,
              to: Math.min(total, page * pageSize + rows.length),
              total,
            })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={page >= pageCount - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("pages.leads.nextPage")}
            </button>
            <button type="button" className={btnPrimary} onClick={onClose}>
              {t("common.close")}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-mute">
            {t("common.search")}
          </span>
          <input
            className={inputClass}
            value={draft}
            autoFocus
            placeholder={
              kind === "company"
                ? t("pages.leads.searchCompaniesPlaceholder")
                : t("pages.leads.searchContactsPlaceholder")
            }
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>

        <div className="max-h-[min(50vh,22rem)] overflow-y-auto rounded-lg border border-line">
          {loading ? (
            <p className="px-3 py-8 text-center text-sm text-mute">
              {t("common.loading")}
            </p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-mute">
              {t("pages.leads.nothingMatches")}
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-ash/60"
                    onClick={() => onSelect(row)}
                  >
                    <span
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white"
                      aria-hidden
                    >
                      {row.label.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {row.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-mute">
                        {[row.company, row.email, row.phone]
                          .filter(Boolean)
                          .join(" · ") || t("common.dash")}
                      </span>
                    </span>
                    <span className="shrink-0 self-center text-[11px] font-semibold text-mute">
                      {t("common.select")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[11px] text-mute">
          {formatNumber(total, false, locale)}{" "}
          {kind === "company"
            ? t("pages.leads.companiesFound")
            : t("pages.leads.contactsFound")}
        </p>
      </div>
    </Modal>
  );
}

function SearchIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.5 10.5 14 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 14V3.5A1.5 1.5 0 0 1 4.5 2h5A1.5 1.5 0 0 1 11 3.5V14M11 6h1.5A1.5 1.5 0 0 1 14 7.5V14M2 14h12M5.5 5h1M5.5 7.5h1M5.5 10h1M8.5 5h1M8.5 7.5h1M8.5 10h1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M3.5 13.5c.8-2.2 2.4-3.3 4.5-3.3s3.7 1.1 4.5 3.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="5"
        width="12"
        height="8.5"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M6 5V3.8A1.3 1.3 0 0 1 7.3 2.5h1.4A1.3 1.3 0 0 1 10 3.8V5M2 9h12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="4"
        width="12"
        height="8.5"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="m3 5.5 5 3.5 5-3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="4.5"
        y="1.5"
        width="7"
        height="13"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M7 12.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="4"
        width="13"
        height="8"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M4 6.2v3.6M12 6.2v3.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 4.5h9M6 4.5V3.2A1.2 1.2 0 0 1 7.2 2h1.6A1.2 1.2 0 0 1 10 3.2v1.3M5 4.5l.6 8.2A1.2 1.2 0 0 0 6.8 14h2.4a1.2 1.2 0 0 0 1.2-1.3L11 4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KanbanCard({
  row,
  chipClass,
  busy,
  dragging,
  onOpen,
  onPriority,
  onSchedule,
  onDragStart,
  onDragEnd,
}: {
  row: LeadRow;
  chipClass: string;
  busy: boolean;
  dragging: boolean;
  onOpen: () => void;
  onPriority: (priority: LeadPriority) => void;
  onSchedule: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { t, locale } = useLocale();
  const { lead, details } = row;
  const tags = tagList(details.tags).slice(0, 3);
  const activity =
    details.nextActivity || details.activityStatus || details.upcomingActivity;
  const needsReply = lead.status === "new";
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
      className={`o-kanban-card group relative block w-full shrink-0 overflow-hidden rounded-lg border border-line/70 bg-canvas shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_6px_16px_-12px_rgba(0,0,0,0.55)] transition-[opacity,box-shadow] ${
        dragging || busy ? "opacity-45" : "hover:border-mute/40"
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
        className="w-full px-2.5 pb-1 pt-2.5 text-left disabled:opacity-50"
      >
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${tone}`}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold leading-snug text-ink">
                  {lead.name || t("common.dash")}
                </p>
                {lead.company && lead.company !== lead.name ? (
                  <p className="mt-0.5 truncate text-[11px] text-mute">
                    {lead.company}
                  </p>
                ) : null}
                {lead.source === "website" ? (
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-gold">
                    {t("sources.website_form")}
                  </p>
                ) : null}
              </div>
              {lead.value > 0 ? (
                <p className="shrink-0 text-[11px] font-semibold text-mute">
                  {formatMoney(lead.value, lead.currency, true, locale)}
                </p>
              ) : null}
            </div>

            {activity ? (
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-mute">
                {activity}
              </p>
            ) : null}

            {tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${chipClass}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-line/40 px-2.5 py-1.5">
        <PriorityStars
          value={details.priority}
          disabled={busy}
          onChange={onPriority}
        />
        <div className="flex items-center gap-1.5">
          {needsReply ? (
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-md bg-[#f1b44c] px-1.5 text-[10px] font-bold text-[#1c1b19]"
              title={t("stages.new")}
              aria-label={`${t("stages.new")}: 1`}
            >
              <MailIcon />
              1
            </span>
          ) : null}
          <span className="text-[10px] text-mute">
            {formatDate(
              (details.updated || lead.lastContact).slice(0, 10),
              locale,
            )}
          </span>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-mute hover:bg-ash hover:text-ink"
            title={t("pages.leads.scheduleActivity")}
            aria-label={t("pages.leads.scheduleActivity")}
            onClick={(e) => {
              e.stopPropagation();
              onSchedule();
            }}
          >
            <ClockIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

function ClockIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 5v3.2L10 10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
