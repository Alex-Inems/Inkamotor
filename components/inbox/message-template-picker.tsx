"use client";

import Link from "next/link";
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

const PANEL_W = 280;
const PANEL_MAX_H = 420;
const GAP = 4;

type Coords = { top: number; left: number; maxHeight: number };

export function MessageTemplatePicker({
  open,
  onClose,
  onPick,
  onSaveAsTemplate,
  modelHint,
  anchorRef,
  align = "left",
  manageHref = "/settings/message-templates",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (template: MessageTemplate) => void;
  /** Save the current composer content as a new template (Odoo “Save as template”). */
  onSaveAsTemplate?: () => void;
  modelHint?: MessageTemplateModel | MessageTemplateModel[];
  anchorRef?: RefObject<HTMLElement | null>;
  align?: "left" | "right";
  manageHref?: string;
}) {
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  const templates = useMemo(() => {
    void tick;
    return searchMessageTemplates("", modelHint);
  }, [modelHint, tick]);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_W, vw - 16);
    const spaceAbove = rect.top - GAP - 8;
    const spaceBelow = vh - rect.bottom - GAP - 8;
    const placeAbove = spaceAbove >= 240 || spaceAbove >= spaceBelow;
    const maxHeight = Math.min(
      PANEL_MAX_H,
      Math.max(200, placeAbove ? spaceAbove : spaceBelow),
    );
    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    const top = placeAbove
      ? Math.max(8, rect.top - GAP - maxHeight)
      : rect.bottom + GAP;
    setCoords({ top, left, maxHeight });
  }, [anchorRef, align]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    setTick((n) => n + 1);
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
      setActiveIndex(0);
      return;
    }
  }, [open]);

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

  const width = Math.min(
    PANEL_W,
    typeof window !== "undefined" ? window.innerWidth - 16 : PANEL_W,
  );

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
      className="flex flex-col overflow-hidden rounded-md border border-white/10 bg-[#2c2c36] text-[#f2f2f2] shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
    >
      <p className="shrink-0 px-3 pb-1 pt-2.5 text-[12px] text-[#9b9ba3]">
        {t("pages.inbox.selectModel")}
      </p>

      <ul
        ref={listRef}
        className="compose-scroll min-h-0 flex-1 overflow-y-auto py-0.5"
      >
        {templates.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-[#9b9ba3]">
            {t("pages.inbox.noTemplates")}
          </li>
        ) : (
          templates.map((tpl, index) => {
            const active = index === activeIndex;
            return (
              <li key={`${tpl.custom ? "c" : "s"}-${tpl.id}-${tpl.name}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-tpl-index={index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => onPick(tpl)}
                  className={`block w-full truncate px-3 py-1.5 text-left text-[13px] leading-snug ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-[#ececf0] hover:bg-white/8"
                  }`}
                >
                  {tpl.name}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {onSaveAsTemplate ? (
        <div className="shrink-0 border-t border-white/10 py-0.5">
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-[13px] text-[#ececf0] hover:bg-white/10"
            onClick={() => {
              onSaveAsTemplate();
              onClose();
            }}
          >
            {t("pages.inbox.saveAsTemplate")}
          </button>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-white/10 py-0.5">
        <Link
          href={manageHref}
          className="block w-full px-3 py-1.5 text-left text-[13px] text-[#00b4b6] hover:bg-white/10"
          onClick={onClose}
        >
          {t("pages.inbox.manageTemplates")}
        </Link>
      </div>
    </div>,
    document.body,
  );
}
