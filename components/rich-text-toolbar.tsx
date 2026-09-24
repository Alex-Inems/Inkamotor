"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

const FONT_FACES = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Times New Roman, Times, serif", label: "Times" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" },
  { value: "Courier New, Courier, monospace", label: "Courier" },
] as const;

/** Browser fontSize command uses 1–7. */
const FONT_SIZES = [
  { value: "2", label: "12" },
  { value: "3", label: "14" },
  { value: "4", label: "16" },
  { value: "5", label: "18" },
  { value: "6", label: "24" },
  { value: "7", label: "32" },
] as const;

const TEXT_COLORS = [
  { value: "#1c1b19", label: "Ink" },
  { value: "#31595d", label: "Teal" },
  { value: "#e1736c", label: "Coral" },
  { value: "#624e8a", label: "Plum" },
  { value: "#65814f", label: "Olive" },
  { value: "#ffffff", label: "White" },
  { value: "#666666", label: "Gray" },
] as const;

/** Keep a live Selection range so toolbar clicks don't lose the highlight. */
const savedRangeByDoc = new WeakMap<Document, Range>();

export function runFormatCommand(
  doc: Document,
  command: string,
  value?: string,
) {
  const win = doc.defaultView;
  win?.focus();
  doc.body?.focus();

  const saved = savedRangeByDoc.get(doc);
  const sel = doc.getSelection();
  if (saved && sel) {
    try {
      sel.removeAllRanges();
      sel.addRange(saved);
    } catch {
      /* range may be stale after DOM edits */
    }
  }

  try {
    doc.execCommand("styleWithCSS", false, "true");
  } catch {
    /* older engines */
  }
  doc.execCommand(command, false, value);

  const next = doc.getSelection();
  if (next && next.rangeCount > 0) {
    try {
      savedRangeByDoc.set(doc, next.getRangeAt(0).cloneRange());
    } catch {
      /* ignore */
    }
  }
}

type ToolbarProps = {
  disabled?: boolean;
  tone?: "light" | "dark";
  /** Compact bubble (Word-style) — fewer controls, tighter layout. */
  compact?: boolean;
  getDocument: () => Document | null;
  onChange?: () => void;
  className?: string;
};

export function RichTextToolbar({
  disabled = false,
  tone = "light",
  compact = false,
  getDocument,
  onChange,
  className = "",
}: ToolbarProps) {
  const t = useT();
  const uid = useId();

  function run(command: string, value?: string) {
    if (disabled) return;
    const doc = getDocument();
    if (!doc) return;
    runFormatCommand(doc, command, value);
    onChange?.();
  }

  function addLink() {
    if (disabled) return;
    const url = window.prompt(t("pages.newsletter.linkPrompt"), "https://");
    if (url?.trim()) run("createLink", url.trim());
  }

  const isDark = tone === "dark";
  const btn = isDark
    ? "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-white/20 bg-[#404040] px-2.5 text-sm font-semibold text-white shadow-sm hover:border-[#017e84] hover:bg-[#4a4a4a] disabled:opacity-40"
    : "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-line bg-panel px-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-ash disabled:opacity-40";
  const field = isDark
    ? "flex h-9 items-center gap-1.5 rounded-md border border-white/20 bg-[#404040] px-2 shadow-sm"
    : "flex h-9 items-center gap-1.5 rounded-md border border-line bg-panel px-2 shadow-sm";
  const labelCls = isDark
    ? "shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#b8b8b8]"
    : "shrink-0 text-[10px] font-bold uppercase tracking-wide text-mute";
  const selectCls = isDark
    ? "h-7 min-w-[4.5rem] border-0 bg-transparent text-sm font-medium text-white outline-none disabled:opacity-40"
    : "h-7 min-w-[4.5rem] border-0 bg-transparent text-sm font-medium text-ink outline-none disabled:opacity-40";
  const sep = isDark
    ? "mx-0.5 hidden h-6 w-px bg-white/20 sm:block"
    : "mx-0.5 hidden h-6 w-px bg-line sm:block";

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      role="toolbar"
      aria-label={t("pages.newsletter.formatToolbar")}
      onMouseDown={(e) => {
        // Keep the contentEditable selection when clicking the toolbar.
        e.preventDefault();
      }}
    >
      <button
        type="button"
        className={btn}
        disabled={disabled}
        title={t("pages.newsletter.bold")}
        aria-label={t("pages.newsletter.bold")}
        onClick={() => run("bold")}
      >
        <span className="font-bold">B</span>
      </button>
      <button
        type="button"
        className={btn}
        disabled={disabled}
        title={t("pages.newsletter.italic")}
        aria-label={t("pages.newsletter.italic")}
        onClick={() => run("italic")}
      >
        <span className="italic">I</span>
      </button>
      <button
        type="button"
        className={btn}
        disabled={disabled}
        title={t("pages.newsletter.underline")}
        aria-label={t("pages.newsletter.underline")}
        onClick={() => run("underline")}
      >
        <span className="underline">U</span>
      </button>
      {!compact ? (
        <button
          type="button"
          className={btn}
          disabled={disabled}
          title={t("pages.newsletter.strike")}
          aria-label={t("pages.newsletter.strike")}
          onClick={() => run("strikeThrough")}
        >
          <span className="line-through">S</span>
        </button>
      ) : null}

      <span className={sep} aria-hidden />

      <div className={field}>
        <label className={labelCls} htmlFor={`${uid}-font`}>
          {t("pages.newsletter.fontFamily")}
        </label>
        <select
          id={`${uid}-font`}
          className={`${selectCls} min-w-[6.5rem]`}
          disabled={disabled}
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value;
            if (value) run("fontName", value);
            e.target.value = "";
          }}
        >
          <option value="">—</option>
          {FONT_FACES.map((font) => (
            <option
              key={font.value}
              value={font.value}
              style={{ fontFamily: font.value }}
            >
              {font.label}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label className={labelCls} htmlFor={`${uid}-size`}>
          {t("pages.newsletter.fontSize")}
        </label>
        <select
          id={`${uid}-size`}
          className={`${selectCls} min-w-[3.25rem]`}
          disabled={disabled}
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value;
            if (value) run("fontSize", value);
            e.target.value = "";
          }}
        >
          <option value="">—</option>
          {FONT_SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label className={labelCls} htmlFor={`${uid}-color`}>
          {t("pages.newsletter.textColor")}
        </label>
        <select
          id={`${uid}-color`}
          className={`${selectCls} min-w-[4.5rem]`}
          disabled={disabled}
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value;
            if (value) run("foreColor", value);
            e.target.value = "";
          }}
        >
          <option value="">—</option>
          {TEXT_COLORS.map((color) => (
            <option key={color.value} value={color.value}>
              {color.label}
            </option>
          ))}
        </select>
      </div>

      {!compact ? (
        <>
          <span className={sep} aria-hidden />
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.alignLeft")}
            aria-label={t("pages.newsletter.alignLeft")}
            onClick={() => run("justifyLeft")}
          >
            {t("pages.newsletter.alignLeftShort")}
          </button>
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.alignCenter")}
            aria-label={t("pages.newsletter.alignCenter")}
            onClick={() => run("justifyCenter")}
          >
            {t("pages.newsletter.alignCenterShort")}
          </button>
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.alignRight")}
            aria-label={t("pages.newsletter.alignRight")}
            onClick={() => run("justifyRight")}
          >
            {t("pages.newsletter.alignRightShort")}
          </button>
          <span className={sep} aria-hidden />
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.heading")}
            onClick={() => run("formatBlock", "H2")}
          >
            H2
          </button>
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.list")}
            onClick={() => run("insertUnorderedList")}
          >
            •
          </button>
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.orderedList")}
            onClick={() => run("insertOrderedList")}
          >
            1.
          </button>
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.link")}
            onClick={addLink}
          >
            {t("pages.newsletter.link")}
          </button>
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.clearFormat")}
            onClick={() => run("removeFormat")}
          >
            {t("pages.newsletter.clearFormatShort")}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.link")}
            onClick={addLink}
          >
            {t("pages.newsletter.link")}
          </button>
          <button
            type="button"
            className={btn}
            disabled={disabled}
            title={t("pages.newsletter.clearFormat")}
            onClick={() => run("removeFormat")}
          >
            {t("pages.newsletter.clearFormatShort")}
          </button>
        </>
      )}
    </div>
  );
}

type FloatingProps = {
  disabled?: boolean;
  active?: boolean;
  getDocument: () => Document | null;
  /** Prefer this when editing inside an iframe (email preview). */
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  /** Extra offset when the editable lives inside an iframe. */
  getFrameElement?: () => HTMLElement | null;
  onChange?: () => void;
};

/**
 * Word-style mini toolbar that appears above the current text selection.
 */
export function FloatingSelectionToolbar({
  disabled = false,
  active = true,
  getDocument,
  iframeRef,
  getFrameElement,
  onChange,
}: FloatingProps) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [mounted, setMounted] = useState(false);
  const getDocumentRef = useRef(getDocument);
  const getFrameRef = useRef(getFrameElement);
  getDocumentRef.current = getDocument;
  getFrameRef.current = getFrameElement;

  useEffect(() => {
    setMounted(true);
  }, []);

  const resolveDoc = useCallback(() => {
    return (
      iframeRef?.current?.contentDocument ??
      getDocumentRef.current() ??
      null
    );
  }, [iframeRef]);

  const update = useCallback(() => {
    if (!active || disabled) {
      setStyle(null);
      return;
    }
    const doc = resolveDoc();
    if (!doc) {
      setStyle(null);
      return;
    }
    const sel = doc.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setStyle(null);
      return;
    }
    try {
      savedRangeByDoc.set(doc, sel.getRangeAt(0).cloneRange());
    } catch {
      /* ignore */
    }
    const text = sel.toString().replace(/\u00a0/g, " ").trim();
    if (!text) {
      setStyle(null);
      return;
    }
    const range = sel.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      const node = sel.focusNode;
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        rect = (node as Element).getBoundingClientRect();
      } else if (node?.parentElement) {
        rect = node.parentElement.getBoundingClientRect();
      }
    }
    if (!rect.width && !rect.height) {
      setStyle(null);
      return;
    }
    const frame =
      iframeRef?.current ?? getFrameRef.current?.() ?? null;
    const frameRect = frame?.getBoundingClientRect();
    const top = (frameRect?.top ?? 0) + rect.top;
    const left = (frameRect?.left ?? 0) + rect.left + rect.width / 2;
    const gap = 12;
    const bubbleH = 56;
    const placeAbove = top - bubbleH - gap > 12;
    setStyle({
      position: "fixed",
      top: placeAbove ? top - gap : top + Math.max(rect.height, 18) + gap,
      left: Math.min(Math.max(left, 160), window.innerWidth - 160),
      transform: placeAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      zIndex: 9999,
    });
  }, [active, disabled, iframeRef, resolveDoc]);

  useEffect(() => {
    if (!active || disabled) {
      setStyle(null);
      return;
    }

    let attached: Document | null = null;
    const listeners: Array<() => void> = [];

    const onSel = () => {
      window.requestAnimationFrame(update);
    };

    const detach = () => {
      for (const off of listeners.splice(0)) off();
      attached = null;
    };

    const attach = (doc: Document) => {
      if (attached === doc) return;
      detach();
      attached = doc;
      const opts = { capture: true } as const;
      doc.addEventListener("mouseup", onSel, opts);
      doc.addEventListener("pointerup", onSel, opts);
      doc.addEventListener("keyup", onSel, opts);
      doc.addEventListener("selectionchange", onSel);
      doc.body?.addEventListener("mouseup", onSel, opts);
      listeners.push(() => {
        doc.removeEventListener("mouseup", onSel, opts);
        doc.removeEventListener("pointerup", onSel, opts);
        doc.removeEventListener("keyup", onSel, opts);
        doc.removeEventListener("selectionchange", onSel);
        doc.body?.removeEventListener("mouseup", onSel, opts);
      });
    };

    const tryAttach = () => {
      const doc = resolveDoc();
      if (doc) attach(doc);
    };

    tryAttach();
    const poll = window.setInterval(tryAttach, 400);
    window.addEventListener("scroll", onSel, true);
    window.addEventListener("resize", onSel);
    const frame = iframeRef?.current;
    frame?.addEventListener("load", tryAttach);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("scroll", onSel, true);
      window.removeEventListener("resize", onSel);
      frame?.removeEventListener("load", tryAttach);
      detach();
      setStyle(null);
    };
  }, [active, disabled, iframeRef, resolveDoc, update]);

  if (!mounted || !style) return null;

  return createPortal(
    <div
      style={style}
      className="pointer-events-auto max-w-[min(96vw,44rem)] rounded-lg border border-[#d0cdc6] bg-white p-1.5 shadow-[0_10px_32px_rgba(28,27,25,0.28)] ring-1 ring-black/5"
      role="presentation"
    >
      <RichTextToolbar
        compact
        tone="light"
        disabled={disabled}
        getDocument={resolveDoc}
        onChange={() => {
          onChange?.();
          window.requestAnimationFrame(update);
        }}
      />
    </div>,
    document.body,
  );
}
