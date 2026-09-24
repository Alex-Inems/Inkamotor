"use client";

import { useEffect, useRef, useState } from "react";
import { btnGhost, inputClass } from "@/components/modal";
import {
  FloatingSelectionToolbar,
  RichTextToolbar,
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

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode, resetKey]);

  useEffect(() => {
    if (mode !== "visual") return;
    if (ref.current) ref.current.innerHTML = html || "<p></p>";
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
