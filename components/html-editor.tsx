"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { btnGhost, inputClass } from "@/components/modal";
import {
  FloatingSelectionToolbar,
  RichTextToolbar,
  checkpointHtmlHistory,
  redoHtmlHistory,
  resetHtmlHistory,
  undoHtmlHistory,
} from "@/components/rich-text-toolbar";
import { useT } from "@/lib/i18n";

export function HtmlEditor({
  html,
  onChange,
  resetKey,
  defaultMode = "visual",
  minHeightClass = "min-h-40",
}: {
  html: string;
  onChange: (html: string) => void;
  resetKey: string;
  defaultMode?: "visual" | "html";
  minHeightClass?: string;
}) {
  const t = useT();
  const [mode, setMode] = useState<"visual" | "html">(defaultMode);
  const ref = useRef<HTMLDivElement>(null);
  const typingBurst = useRef(false);
  const typingTimer = useRef(0);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode, resetKey]);

  useEffect(() => {
    if (mode !== "visual") return;
    if (ref.current) {
      ref.current.innerHTML = html || "<p></p>";
      resetHtmlHistory(ref.current.ownerDocument);
    }
    // Only remount content when the template/mode changes — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, mode]);

  function flushVisual() {
    if (mode === "visual" && ref.current) {
      onChange(ref.current.innerHTML || "");
    }
  }

  function switchMode(next: "visual" | "html") {
    if (next === mode) return;
    flushVisual();
    setMode(next);
  }

  function handleUndoRedo(event: KeyboardEvent<HTMLDivElement>) {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || mode !== "visual") return;
    const doc = ref.current?.ownerDocument;
    if (!doc) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      if (undoHtmlHistory(doc)) onChange(ref.current?.innerHTML || "");
      return;
    }
    if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      if (redoHtmlHistory(doc)) onChange(ref.current?.innerHTML || "");
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start gap-2 rounded-md border border-line bg-ash/40 p-2">
        {mode === "visual" ? (
          <RichTextToolbar
            className="flex-1"
            getDocument={() => ref.current?.ownerDocument ?? null}
            onChange={() => onChange(ref.current?.innerHTML || "")}
          />
        ) : null}
        <button
          type="button"
          className={`${btnGhost} ml-auto shrink-0`}
          onClick={() => switchMode(mode === "visual" ? "html" : "visual")}
        >
          {mode === "visual"
            ? t("pages.newsletter.showHtml")
            : t("pages.newsletter.showVisual")}
        </button>
      </div>
      {mode === "html" ? (
        <textarea
          className={`${inputClass} ${minHeightClass} font-mono text-xs`}
          value={html}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <>
          <div
            ref={ref}
            className={`html-editor ${minHeightClass}`}
            contentEditable
            suppressContentEditableWarning
            onKeyDown={handleUndoRedo}
            onBeforeInput={() => {
              const doc = ref.current?.ownerDocument;
              if (!doc) return;
              if (!typingBurst.current) {
                checkpointHtmlHistory(doc);
                typingBurst.current = true;
              }
              window.clearTimeout(typingTimer.current);
              typingTimer.current = window.setTimeout(() => {
                typingBurst.current = false;
              }, 450);
            }}
            onInput={(e) => onChange(e.currentTarget.innerHTML)}
            onBlur={flushVisual}
          />
          <FloatingSelectionToolbar
            active={mode === "visual"}
            getDocument={() => ref.current?.ownerDocument ?? null}
            onChange={() => onChange(ref.current?.innerHTML || "")}
          />
        </>
      )}
    </div>
  );
}
