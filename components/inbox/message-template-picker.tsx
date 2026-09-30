"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/lib/i18n";
import {
  searchMessageTemplates,
  type MessageTemplate,
  type MessageTemplateModel,
} from "@/lib/mail/message-templates";

const MODEL_META: Record<
  MessageTemplateModel,
  { label: string; tone: string; bar: string; iconBg: string }
> = {
  "crm.lead": {
    label: "CRM",
    tone: "text-[#9ec4ff]",
    bar: "bg-[#5a7aa8]",
    iconBg: "bg-[#5a7aa8]/25 text-[#9ec4ff]",
  },
  "sale.order": {
    label: "Sale",
    tone: "text-[#f0c26b]",
    bar: "bg-gold",
    iconBg: "bg-gold/20 text-gold",
  },
  "res.partner": {
    label: "Contact",
    tone: "text-[#7dcec8]",
    bar: "bg-accent",
    iconBg: "bg-accent/25 text-[#7dcec8]",
  },
  "account.move": {
    label: "Invoice",
    tone: "text-[#e8a0a0]",
    bar: "bg-[#a85a5a]",
    iconBg: "bg-[#a85a5a]/25 text-[#e8a0a0]",
  },
};

const FILTERS: Array<"all" | MessageTemplateModel> = [
  "all",
  "crm.lead",
  "sale.order",
  "res.partner",
  "account.move",
];

const PANEL_W = 420;
const PANEL_MAX_H = 460;
const GAP = 8;

function TemplateIcon({ model }: { model: MessageTemplateModel }) {
  const meta = MODEL_META[model];
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}
      aria-hidden
    >
      {model === "crm.lead" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2.5 3.5 5v6L8 13.5 12.5 11V5L8 2.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ) : model === "sale.order" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 4.5h10M4.5 4.5V12a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V4.5M6.5 7v3.5M9.5 7v3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ) : model === "account.move" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect
            x="3.5"
            y="2.5"
            width="9"
            height="11"
            rx="1.2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M6 6h4M6 8.5h4M6 11h2.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M3.5 13c.8-2.2 2.4-3.3 4.5-3.3S11.7 10.8 12.5 13"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

type Coords = { top: number; left: number; maxHeight: number; placeAbove: boolean };

export function MessageTemplatePicker({
  open,
  onClose,
  onPick,
  modelHint,
  anchorRef,
  align = "left",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (template: MessageTemplate) => void;
  modelHint?: MessageTemplateModel | MessageTemplateModel[];
  /** Button/control that opened the picker — used to float above the composer. */
  anchorRef?: RefObject<HTMLElement | null>;
  align?: "left" | "right";
}) {
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MessageTemplateModel>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [mounted, setMounted] = useState(false);

  const templates = useMemo(() => {
    const ranked = searchMessageTemplates(query, modelHint);
    if (filter === "all") return ranked;
    return ranked.filter((tpl) => tpl.model === filter);
  }, [query, modelHint, filter]);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_W, vw - 16);
    const spaceAbove = rect.top - GAP - 8;
    const spaceBelow = vh - rect.bottom - GAP - 8;
    const placeAbove = spaceAbove >= 280 || spaceAbove >= spaceBelow;
    const maxHeight = Math.min(
      PANEL_MAX_H,
      Math.max(240, placeAbove ? spaceAbove : spaceBelow),
    );
    let left =
      align === "right" ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    const top = placeAbove
      ? Math.max(8, rect.top - GAP - maxHeight)
      : rect.bottom + GAP;
    setCoords({ top, left, maxHeight, placeAbove });
  }, [anchorRef, align]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      updatePosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setFilter("all");
      setActiveIndex(0);
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filter]);

  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-tpl-index="${activeIndex}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, templates]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!templates.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % templates.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + templates.length) % templates.length);
      } else if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-tpl-index]")) return;
        event.preventDefault();
        const tpl = templates[activeIndex];
        if (tpl) onPick(tpl);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, onPick, templates, activeIndex, anchorRef]);

  if (!open || !mounted || !coords) return null;

  const width = Math.min(PANEL_W, typeof window !== "undefined" ? window.innerWidth - 16 : PANEL_W);

  return createPortal(
    <div
      ref={rootRef}
      role="listbox"
      aria-label={t("pages.inbox.messageTemplates")}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width,
        maxHeight: coords.maxHeight,
        zIndex: 10050,
      }}
      className="crm-modal-panel flex flex-col overflow-hidden rounded-2xl border border-line/70 bg-panel shadow-[0_28px_80px_rgba(0,0,0,0.62),0_0_0_1px_rgba(236,187,90,0.08)]"
    >
      <div className="relative shrink-0 border-b border-line/80 bg-linear-to-b from-[#2c2a27] to-panel px-3.5 pb-3 pt-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold/40 to-transparent" />
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[1.25rem] leading-none tracking-[0.04em] text-ink">
              {t("pages.inbox.messageTemplates")}
            </p>
            <p className="mt-1 text-[11px] text-mute">
              {t("pages.inbox.templatesHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line/70 bg-ash/50 text-mute transition-colors hover:border-mute/40 hover:bg-ash hover:text-ink"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3 3l8 8M11 3 3 11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <label className="relative block">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-mute">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="m9.2 9.2 2.3 2.3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pages.inbox.searchTemplates")}
            className="w-full rounded-xl border border-line/80 bg-canvas py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-mute/70 focus:border-gold/80 focus:shadow-[0_0_0_3px_rgba(236,187,90,0.12)]"
          />
        </label>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {FILTERS.map((key) => {
            const active = filter === key;
            const label =
              key === "all" ? t("pages.inbox.templatesAll") : MODEL_META[key].label;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors ${
                  active
                    ? "bg-cream/95 text-[#1c1b19]"
                    : "border border-line/70 bg-ash/40 text-mute hover:border-mute/40 hover:bg-ash hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <ul
        ref={listRef}
        className="compose-scroll min-h-0 flex-1 space-y-1 overflow-y-auto p-2.5"
      >
        {templates.length === 0 ? (
          <li className="rounded-xl border border-dashed border-line/70 px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">{t("pages.inbox.noTemplates")}</p>
            <p className="mt-1 text-[12px] text-mute">
              {t("pages.inbox.templatesEmptyHint")}
            </p>
          </li>
        ) : (
          templates.map((tpl, index) => {
            const meta = MODEL_META[tpl.model];
            const active = index === activeIndex;
            return (
              <li key={tpl.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-tpl-index={index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => onPick(tpl)}
                  className={`group relative flex w-full gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-gold/40 bg-gold/10"
                      : "border-transparent bg-ash/20 hover:border-line/60 hover:bg-ash/55"
                  }`}
                >
                  <span
                    className={`absolute inset-y-2 left-0 w-[3px] rounded-full ${meta.bar}`}
                    aria-hidden
                  />
                  <TemplateIcon model={tpl.model} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                        {tpl.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full bg-panel/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.tone}`}
                      >
                        {meta.label}
                      </span>
                    </span>
                    {tpl.subject ? (
                      <span className="mt-0.5 block truncate text-[12px] text-mute">
                        {tpl.subject}
                      </span>
                    ) : null}
                    <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-mute/75">
                      {tpl.body}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line/80 bg-[#211f1c] px-3.5 py-2 text-[11px] text-mute">
        <span className="font-medium text-ink/70">
          {t("pages.inbox.templatesCount", { n: templates.length })}
        </span>
        <span className="hidden sm:inline">{t("pages.inbox.templatesNavHint")}</span>
      </div>
    </div>,
    document.body,
  );
}
