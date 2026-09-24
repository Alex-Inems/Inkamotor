"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

const FONT_FACES = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" },
  { value: "Trebuchet MS, Helvetica, sans-serif", label: "Trebuchet MS" },
  { value: "Gill Sans, Gill Sans MT, Calibri, sans-serif", label: "Gill Sans" },
  { value: "Segoe UI, Tahoma, sans-serif", label: "Segoe UI" },
  { value: "Calibri, Candara, Segoe, sans-serif", label: "Calibri" },
  { value: "Century Gothic, CenturyGothic, AppleGothic, sans-serif", label: "Century Gothic" },
  { value: "Impact, Charcoal, sans-serif", label: "Impact" },
  { value: "Comic Sans MS, Comic Sans, cursive", label: "Comic Sans MS" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Times New Roman, Times, serif", label: "Times New Roman" },
  { value: "Times, Times New Roman, serif", label: "Times" },
  { value: "Palatino Linotype, Palatino, Book Antiqua, serif", label: "Palatino" },
  { value: "Book Antiqua, Palatino, serif", label: "Book Antiqua" },
  { value: "Garamond, Baskerville, serif", label: "Garamond" },
  { value: "Courier New, Courier, monospace", label: "Courier New" },
  { value: "Courier, monospace", label: "Courier" },
  { value: "Lucida Console, Monaco, monospace", label: "Lucida Console" },
  { value: "Lucida Sans Unicode, Lucida Grande, sans-serif", label: "Lucida Sans" },
  { value: "Consolas, monaco, monospace", label: "Consolas" },
] as const;

/** Pixel sizes applied as inline styles (reliable in email HTML). */
const FONT_SIZES = [
  { value: "10px", label: "10" },
  { value: "11px", label: "11" },
  { value: "12px", label: "12" },
  { value: "13px", label: "13" },
  { value: "14px", label: "14" },
  { value: "16px", label: "16" },
  { value: "18px", label: "18" },
  { value: "20px", label: "20" },
  { value: "22px", label: "22" },
  { value: "24px", label: "24" },
  { value: "28px", label: "28" },
  { value: "32px", label: "32" },
  { value: "36px", label: "36" },
  { value: "48px", label: "48" },
] as const;

const TEXT_COLORS = [
  { value: "#000000", label: "Black" },
  { value: "#1c1b19", label: "Ink" },
  { value: "#333333", label: "Charcoal" },
  { value: "#666666", label: "Gray" },
  { value: "#999999", label: "Silver" },
  { value: "#cccccc", label: "Light gray" },
  { value: "#ffffff", label: "White" },
  { value: "#c62828", label: "Red" },
  { value: "#e1736c", label: "Coral" },
  { value: "#ef6c00", label: "Orange" },
  { value: "#f9a825", label: "Gold" },
  { value: "#ecbb5a", label: "Sand" },
  { value: "#2e7d32", label: "Green" },
  { value: "#65814f", label: "Olive" },
  { value: "#00897b", label: "Teal green" },
  { value: "#31595d", label: "Teal" },
  { value: "#0277bd", label: "Blue" },
  { value: "#1565c0", label: "Royal" },
  { value: "#4527a0", label: "Indigo" },
  { value: "#624e8a", label: "Plum" },
  { value: "#6a1b9a", label: "Purple" },
  { value: "#ad1457", label: "Magenta" },
  { value: "#4e342e", label: "Brown" },
  { value: "#5d4037", label: "Coffee" },
] as const;

type MenuKey = "font" | "size" | "color" | null;

function FormatPicker({
  open,
  onClose,
  tone,
  children,
  align = "left",
}: {
  open: boolean;
  onClose: () => void;
  tone: "light" | "dark";
  children: ReactNode;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`absolute top-[calc(100%+6px)] z-[10000] max-h-64 min-w-[12rem] overflow-y-auto rounded-lg border border-[#d0cdc6] bg-white p-1.5 text-[#1c1b19] shadow-[0_12px_32px_rgba(28,27,25,0.28)] ${
        align === "right" ? "right-0" : "left-0"
      } ${tone === "dark" ? "ring-1 ring-black/10" : ""}`}
      role="listbox"
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

/** Keep a live Selection range so toolbar clicks don't lose the highlight. */
const savedRangeByDoc = new WeakMap<Document, Range>();

function restoreSelection(doc: Document): Range | null {
  const sel = doc.getSelection();
  const saved = savedRangeByDoc.get(doc);
  if (saved && sel) {
    try {
      sel.removeAllRanges();
      sel.addRange(saved);
      return sel.getRangeAt(0);
    } catch {
      /* range may be stale after DOM edits */
    }
  }
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    return sel.getRangeAt(0);
  }
  return null;
}

function rememberSelection(doc: Document) {
  const sel = doc.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  try {
    savedRangeByDoc.set(doc, sel.getRangeAt(0).cloneRange());
  } catch {
    /* ignore */
  }
}

const MAX_HTML_HISTORY = 40;

type DocHtmlHistory = { entries: string[]; index: number };

const htmlHistoryByDoc = new WeakMap<Document, DocHtmlHistory>();

export function serializeEditableHtml(doc: Document) {
  return doc.body?.innerHTML ?? "";
}

export function resetHtmlHistory(doc: Document) {
  htmlHistoryByDoc.set(doc, {
    entries: [serializeEditableHtml(doc)],
    index: 0,
  });
}

/** Seed history once per document without wiping existing undo steps. */
export function seedHtmlHistory(doc: Document) {
  if (!htmlHistoryByDoc.has(doc)) resetHtmlHistory(doc);
}

function ensureHtmlHistory(doc: Document) {
  if (!htmlHistoryByDoc.has(doc)) resetHtmlHistory(doc);
  return htmlHistoryByDoc.get(doc)!;
}

/** Save current HTML before a mutation (format, paste, etc.). */
export function checkpointHtmlHistory(doc: Document) {
  const h = ensureHtmlHistory(doc);
  const html = serializeEditableHtml(doc);
  if (h.entries[h.index] === html) return;
  h.entries = h.entries.slice(0, h.index + 1);
  h.entries.push(html);
  if (h.entries.length > MAX_HTML_HISTORY) {
    const drop = h.entries.length - MAX_HTML_HISTORY;
    h.entries = h.entries.slice(drop);
  }
  h.index = h.entries.length - 1;
}

export function canUndoHtml(doc: Document | null) {
  if (!doc) return false;
  const h = htmlHistoryByDoc.get(doc);
  if (!h) return false;
  if (h.index > 0) return true;
  return serializeEditableHtml(doc) !== h.entries[0];
}

export function canRedoHtml(doc: Document | null) {
  if (!doc) return false;
  const h = htmlHistoryByDoc.get(doc);
  if (!h) return false;
  return h.index < h.entries.length - 1;
}

export function undoHtmlHistory(doc: Document): boolean {
  const h = ensureHtmlHistory(doc);
  const current = serializeEditableHtml(doc);
  if (current !== h.entries[h.index]) {
    h.entries = h.entries.slice(0, h.index + 1);
    h.entries.push(current);
    if (h.entries.length > MAX_HTML_HISTORY) {
      const drop = h.entries.length - MAX_HTML_HISTORY;
      h.entries = h.entries.slice(drop);
    }
    h.index = h.entries.length - 1;
  }
  if (h.index <= 0) return false;
  h.index -= 1;
  if (doc.body) doc.body.innerHTML = h.entries[h.index];
  return true;
}

export function redoHtmlHistory(doc: Document): boolean {
  const h = ensureHtmlHistory(doc);
  if (h.index >= h.entries.length - 1) return false;
  h.index += 1;
  if (doc.body) doc.body.innerHTML = h.entries[h.index];
  return true;
}

/**
 * Wrap the current selection in a <span style="…">.
 * Works in iframes where fontName / fontSize / foreColor often fail.
 */
export function applyInlineStyle(
  doc: Document,
  styles: Partial<Record<"fontFamily" | "fontSize" | "color", string>>,
) {
  const win = doc.defaultView;
  win?.focus();
  doc.body?.focus();

  const range = restoreSelection(doc);
  if (!range || range.collapsed) return false;

  checkpointHtmlHistory(doc);

  // If the selection is exactly one existing span, merge styles onto it.
  const start = range.startContainer;
  const end = range.endContainer;
  const startEl =
    start.nodeType === Node.ELEMENT_NODE
      ? (start as Element)
      : start.parentElement;
  const endEl =
    end.nodeType === Node.ELEMENT_NODE ? (end as Element) : end.parentElement;
  const sameSpan =
    startEl &&
    startEl === endEl &&
    startEl.tagName === "SPAN" &&
    startEl.childNodes.length === 1 &&
    range.toString() === (startEl.textContent || "");

  if (sameSpan && startEl instanceof HTMLElement) {
    if (styles.fontFamily) startEl.style.fontFamily = styles.fontFamily;
    if (styles.fontSize) startEl.style.fontSize = styles.fontSize;
    if (styles.color) startEl.style.color = styles.color;
    rememberSelection(doc);
    return true;
  }

  const span = doc.createElement("span");
  if (styles.fontFamily) span.style.fontFamily = styles.fontFamily;
  if (styles.fontSize) span.style.fontSize = styles.fontSize;
  if (styles.color) span.style.color = styles.color;

  try {
    const contents = range.extractContents();
    // Avoid empty wrapper junk
    span.appendChild(contents);
    range.insertNode(span);

    // Flatten nested empty spans left by extractContents
    span.normalize();

    const sel = doc.getSelection();
    if (sel) {
      const next = doc.createRange();
      next.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(next);
      savedRangeByDoc.set(doc, next.cloneRange());
    }
    return true;
  } catch {
    try {
      range.surroundContents(span);
      rememberSelection(doc);
      return true;
    } catch {
      return false;
    }
  }
}

export function runFormatCommand(
  doc: Document,
  command: string,
  value?: string,
) {
  const win = doc.defaultView;
  win?.focus();
  doc.body?.focus();
  restoreSelection(doc);

  // Prefer inline CSS spans for styles that break under execCommand in iframes.
  if (command === "fontName" && value) {
    applyInlineStyle(doc, { fontFamily: value });
    return;
  }
  if (command === "fontSize" && value) {
    // Accept legacy 1–7 or direct px.
    const px =
      /^\d+$/.test(value) && Number(value) <= 7
        ? (
            {
              1: "10px",
              2: "12px",
              3: "14px",
              4: "16px",
              5: "18px",
              6: "24px",
              7: "32px",
            } as Record<string, string>
          )[value] || "16px"
        : value.includes("px")
          ? value
          : `${value}px`;
    applyInlineStyle(doc, { fontSize: px });
    return;
  }
  if (command === "foreColor" && value) {
    applyInlineStyle(doc, { color: value });
    return;
  }

  checkpointHtmlHistory(doc);
  try {
    doc.execCommand("styleWithCSS", false, "true");
  } catch {
    /* older engines */
  }
  doc.execCommand(command, false, value);
  rememberSelection(doc);
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
  const [menu, setMenu] = useState<MenuKey>(null);
  const [histTick, setHistTick] = useState(0);

  const docNow = getDocument();
  const undoEnabled = !disabled && canUndoHtml(docNow);
  const redoEnabled = !disabled && canRedoHtml(docNow);
  void histTick;

  function bumpHistory() {
    setHistTick((n) => n + 1);
  }

  function run(command: string, value?: string) {
    if (disabled) return;
    const doc = getDocument();
    if (!doc) return;
    runFormatCommand(doc, command, value);
    bumpHistory();
    onChange?.();
  }

  function stashSelection() {
    const doc = getDocument();
    if (!doc) return;
    const sel = doc.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    try {
      savedRangeByDoc.set(doc, sel.getRangeAt(0).cloneRange());
    } catch {
      /* ignore */
    }
  }

  function applyStyle(
    styles: Partial<Record<"fontFamily" | "fontSize" | "color", string>>,
  ) {
    if (disabled) return;
    const doc = getDocument();
    if (!doc) return;
    applyInlineStyle(doc, styles);
    bumpHistory();
    onChange?.();
    setMenu(null);
  }

  function undo() {
    if (disabled) return;
    const doc = getDocument();
    if (!doc) return;
    if (!undoHtmlHistory(doc)) return;
    bumpHistory();
    onChange?.();
  }

  function redo() {
    if (disabled) return;
    const doc = getDocument();
    if (!doc) return;
    if (!redoHtmlHistory(doc)) return;
    bumpHistory();
    onChange?.();
  }

  function toggleMenu(key: MenuKey) {
    if (disabled) return;
    stashSelection();
    setMenu((prev) => (prev === key ? null : key));
  }

  function addLink() {
    if (disabled) return;
    const url = window.prompt(t("pages.newsletter.linkPrompt"), "https://");
    if (url?.trim()) run("createLink", url.trim());
  }

  const isDark = tone === "dark";
  const shell = isDark
    ? "rounded-lg border border-white/15 bg-[#2a2a2a] p-2"
    : "rounded-lg border border-line bg-white p-2 shadow-sm";
  const group =
    "flex flex-wrap items-center gap-1 rounded-md border border-transparent px-1 py-0.5";
  const groupLabel = isDark
    ? "mb-1 w-full text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a9a9a]"
    : "mb-1 w-full text-[10px] font-bold uppercase tracking-[0.12em] text-mute";
  const btn = isDark
    ? "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/20 bg-[#404040] px-2.5 text-sm font-semibold text-white shadow-sm hover:border-[#017e84] hover:bg-[#4a4a4a] disabled:opacity-40"
    : "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-line bg-[#f7f5f1] px-2.5 text-sm font-semibold text-[#1c1b19] shadow-sm hover:bg-[#efece6] disabled:opacity-40";
  const primaryBtn = isDark
    ? "inline-flex h-9 items-center gap-1.5 rounded-md border border-[#017e84] bg-[#017e84] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#016a6f] disabled:opacity-40"
    : "inline-flex h-9 items-center gap-1.5 rounded-md border border-[#017e84] bg-[#017e84] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#016a6f] disabled:opacity-40";
  const primaryBtnOpen = `${primaryBtn} ring-2 ring-[#017e84]/40 ring-offset-1 ${isDark ? "ring-offset-[#2a2a2a]" : "ring-offset-white"}`;
  const menuItem =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-[#1c1b19] hover:bg-[#f0eeea]";

  function ToolBtn({
    label,
    title,
    onClick,
    enabled = true,
    mark,
    primary = false,
    open = false,
  }: {
    label: string;
    title: string;
    onClick: () => void;
    enabled?: boolean;
    mark?: ReactNode;
    primary?: boolean;
    open?: boolean;
  }) {
    return (
      <button
        type="button"
        className={primary ? (open ? primaryBtnOpen : primaryBtn) : btn}
        disabled={!enabled}
        title={title}
        aria-label={title}
        aria-expanded={open || undefined}
        onClick={onClick}
      >
        {mark}
        {compact && !mark ? <span>{label}</span> : null}
        {!compact ? <span>{label}</span> : <span className="sr-only">{label}</span>}
      </button>
    );
  }

  return (
    <div
      className={`${shell} ${className}`}
      role="toolbar"
      aria-label={t("pages.newsletter.formatToolbar")}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("input[type='color']")) return;
        e.preventDefault();
      }}
    >
      {!compact ? (
        <p className={`mb-2 text-xs ${isDark ? "text-[#b0b0b0]" : "text-mute"}`}>
          {t("pages.newsletter.selectTextHint")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-2">
        <div className={`${group} ${isDark ? "bg-white/5" : "bg-ash/50"}`}>
          {!compact ? (
            <span className={groupLabel}>{t("pages.newsletter.formatGroupHistory")}</span>
          ) : null}
          <ToolBtn
            label={t("pages.newsletter.undo")}
            title={`${t("pages.newsletter.undo")} (Ctrl+Z)`}
            enabled={undoEnabled}
            onClick={undo}
            mark={<span aria-hidden>↶</span>}
          />
          <ToolBtn
            label={t("pages.newsletter.redo")}
            title={`${t("pages.newsletter.redo")} (Ctrl+Y)`}
            enabled={redoEnabled}
            onClick={redo}
            mark={<span aria-hidden>↷</span>}
          />
        </div>

        <div className={`${group} ${isDark ? "bg-white/5" : "bg-ash/50"}`}>
          {!compact ? (
            <span className={groupLabel}>{t("pages.newsletter.formatGroupStyle")}</span>
          ) : null}
          <ToolBtn
            label={t("pages.newsletter.bold")}
            title={t("pages.newsletter.bold")}
            enabled={!disabled}
            onClick={() => run("bold")}
            mark={<span className="font-bold">B</span>}
          />
          <ToolBtn
            label={t("pages.newsletter.italic")}
            title={t("pages.newsletter.italic")}
            enabled={!disabled}
            onClick={() => run("italic")}
            mark={<span className="italic">I</span>}
          />
          <ToolBtn
            label={t("pages.newsletter.underline")}
            title={t("pages.newsletter.underline")}
            enabled={!disabled}
            onClick={() => run("underline")}
            mark={<span className="underline">U</span>}
          />
          {!compact ? (
            <ToolBtn
              label={t("pages.newsletter.strike")}
              title={t("pages.newsletter.strike")}
              enabled={!disabled}
              onClick={() => run("strikeThrough")}
              mark={<span className="line-through">S</span>}
            />
          ) : null}
        </div>

        <div className={`${group} ${isDark ? "bg-[#017e84]/15" : "bg-[#017e84]/10"}`}>
          {!compact ? (
            <span className={groupLabel}>{t("pages.newsletter.formatGroupType")}</span>
          ) : null}
          <div className="relative">
            <ToolBtn
              label={t("pages.newsletter.fontFamily")}
              title={t("pages.newsletter.fontFamily")}
              enabled={!disabled}
              primary
              open={menu === "font"}
              onClick={() => toggleMenu("font")}
              mark={<span className="font-serif text-base leading-none">Aa</span>}
            />
            <FormatPicker
              open={menu === "font"}
              onClose={() => setMenu(null)}
              tone={tone}
            >
              {FONT_FACES.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  role="option"
                  className={menuItem}
                  style={{ fontFamily: font.value }}
                  onClick={() => applyStyle({ fontFamily: font.value })}
                >
                  {font.label}
                </button>
              ))}
            </FormatPicker>
          </div>
          <div className="relative">
            <ToolBtn
              label={t("pages.newsletter.fontSize")}
              title={t("pages.newsletter.fontSize")}
              enabled={!disabled}
              primary
              open={menu === "size"}
              onClick={() => toggleMenu("size")}
              mark={<span className="text-xs font-bold">12</span>}
            />
            <FormatPicker
              open={menu === "size"}
              onClose={() => setMenu(null)}
              tone={tone}
            >
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  role="option"
                  className={menuItem}
                  onClick={() => applyStyle({ fontSize: size.value })}
                >
                  <span style={{ fontSize: size.value }} className="leading-none">
                    {size.label}
                  </span>
                  <span className="ml-auto text-[11px] text-[#8a8478]">px</span>
                </button>
              ))}
            </FormatPicker>
          </div>
          <div className="relative">
            <ToolBtn
              label={t("pages.newsletter.textColor")}
              title={t("pages.newsletter.textColor")}
              enabled={!disabled}
              primary
              open={menu === "color"}
              onClick={() => toggleMenu("color")}
              mark={
                <span
                  className="inline-block h-3.5 w-3.5 rounded-sm border border-white/50"
                  style={{
                    background:
                      "conic-gradient(#c62828,#f9a825,#2e7d32,#0277bd,#6a1b9a,#c62828)",
                  }}
                  aria-hidden
                />
              }
            />
            <FormatPicker
              open={menu === "color"}
              onClose={() => setMenu(null)}
              tone={tone}
            >
              <div className="grid grid-cols-6 gap-1.5 p-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    role="option"
                    title={color.label}
                    aria-label={color.label}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[#d0cdc6] hover:ring-2 hover:ring-[#017e84]"
                    style={{ backgroundColor: color.value }}
                    onClick={() => applyStyle({ color: color.value })}
                  >
                    {color.value === "#ffffff" ? (
                      <span className="text-[9px] font-bold text-[#999]">W</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <label
                className={`${menuItem} mt-1 cursor-pointer border-t border-[#ebe7e0] pt-2`}
              >
                <span className="text-[#8a8478]">Custom</span>
                <input
                  type="color"
                  className="ml-auto h-7 w-10 cursor-pointer rounded border border-[#d0cdc6] bg-white"
                  defaultValue="#1c1b19"
                  onMouseDown={stashSelection}
                  onChange={(e) => applyStyle({ color: e.target.value })}
                />
              </label>
            </FormatPicker>
          </div>
        </div>

        {!compact ? (
          <>
            <div className={`${group} ${isDark ? "bg-white/5" : "bg-ash/50"}`}>
              <span className={groupLabel}>
                {t("pages.newsletter.formatGroupAlign")}
              </span>
              <ToolBtn
                label={t("pages.newsletter.alignLeftShort")}
                title={t("pages.newsletter.alignLeft")}
                enabled={!disabled}
                onClick={() => run("justifyLeft")}
              />
              <ToolBtn
                label={t("pages.newsletter.alignCenterShort")}
                title={t("pages.newsletter.alignCenter")}
                enabled={!disabled}
                onClick={() => run("justifyCenter")}
              />
              <ToolBtn
                label={t("pages.newsletter.alignRightShort")}
                title={t("pages.newsletter.alignRight")}
                enabled={!disabled}
                onClick={() => run("justifyRight")}
              />
            </div>
            <div className={`${group} ${isDark ? "bg-white/5" : "bg-ash/50"}`}>
              <span className={groupLabel}>
                {t("pages.newsletter.formatGroupInsert")}
              </span>
              <ToolBtn
                label={t("pages.newsletter.heading")}
                title={t("pages.newsletter.heading")}
                enabled={!disabled}
                onClick={() => run("formatBlock", "H2")}
                mark={<span className="text-xs font-bold">H2</span>}
              />
              <ToolBtn
                label={t("pages.newsletter.list")}
                title={t("pages.newsletter.list")}
                enabled={!disabled}
                onClick={() => run("insertUnorderedList")}
                mark={<span>•</span>}
              />
              <ToolBtn
                label={t("pages.newsletter.orderedList")}
                title={t("pages.newsletter.orderedList")}
                enabled={!disabled}
                onClick={() => run("insertOrderedList")}
                mark={<span>1.</span>}
              />
              <ToolBtn
                label={t("pages.newsletter.link")}
                title={t("pages.newsletter.link")}
                enabled={!disabled}
                onClick={addLink}
              />
              <ToolBtn
                label={t("pages.newsletter.clearFormatShort")}
                title={t("pages.newsletter.clearFormat")}
                enabled={!disabled}
                onClick={() => run("removeFormat")}
              />
            </div>
          </>
        ) : (
          <div className={group}>
            <ToolBtn
              label={t("pages.newsletter.link")}
              title={t("pages.newsletter.link")}
              enabled={!disabled}
              onClick={addLink}
            />
            <ToolBtn
              label={t("pages.newsletter.clearFormatShort")}
              title={t("pages.newsletter.clearFormat")}
              enabled={!disabled}
              onClick={() => run("removeFormat")}
            />
          </div>
        )}
      </div>
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

    const onChangeRef = { current: onChange };
    onChangeRef.current = onChange;

    const attach = (doc: Document) => {
      if (attached === doc) return;
      detach();
      attached = doc;
      seedHtmlHistory(doc);
      const opts = { capture: true } as const;
      let typingBurst = false;
      let typingTimer = 0;

      const onSel = () => {
        window.requestAnimationFrame(update);
      };

      const onBeforeInput = () => {
        if (!typingBurst) {
          checkpointHtmlHistory(doc);
          typingBurst = true;
        }
        window.clearTimeout(typingTimer);
        typingTimer = window.setTimeout(() => {
          typingBurst = false;
        }, 450);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        const mod = event.ctrlKey || event.metaKey;
        if (!mod) return;
        const key = event.key.toLowerCase();
        if (key === "z" && !event.shiftKey) {
          event.preventDefault();
          if (undoHtmlHistory(doc)) onChangeRef.current?.();
          return;
        }
        if (key === "y" || (key === "z" && event.shiftKey)) {
          event.preventDefault();
          if (redoHtmlHistory(doc)) onChangeRef.current?.();
        }
      };

      doc.addEventListener("mouseup", onSel, opts);
      doc.addEventListener("pointerup", onSel, opts);
      doc.addEventListener("keyup", onSel, opts);
      doc.addEventListener("selectionchange", onSel);
      doc.addEventListener("keydown", onKeyDown, opts);
      doc.addEventListener("beforeinput", onBeforeInput, opts);
      doc.body?.addEventListener("mouseup", onSel, opts);
      listeners.push(() => {
        window.clearTimeout(typingTimer);
        doc.removeEventListener("mouseup", onSel, opts);
        doc.removeEventListener("pointerup", onSel, opts);
        doc.removeEventListener("keyup", onSel, opts);
        doc.removeEventListener("selectionchange", onSel);
        doc.removeEventListener("keydown", onKeyDown, opts);
        doc.removeEventListener("beforeinput", onBeforeInput, opts);
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
      className="pointer-events-auto max-w-[min(96vw,44rem)] overflow-visible rounded-lg border border-[#d0cdc6] bg-white p-1.5 shadow-[0_10px_32px_rgba(28,27,25,0.28)] ring-1 ring-black/5"
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
