"use client";

import { useEffect, useRef, useState } from "react";
import { btnGhost, inputClass } from "@/components/modal";
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

  function cmd(command: string, value?: string) {
    document.execCommand(command, false, value);
    onChange(ref.current?.innerHTML || "");
  }

  function addLink() {
    const url = window.prompt(t("pages.newsletter.linkPrompt"), "https://");
    if (url) cmd("createLink", url);
  }

  function addImage() {
    const url = window.prompt("Image URL", "https://");
    if (!url?.trim()) return;
    cmd("insertImage", url.trim());
  }

  function switchMode(next: "visual" | "html") {
    if (next === mode) return;
    flushVisual();
    setMode(next);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {mode === "visual" ? (
          <>
            <button type="button" className={btnGhost} onClick={() => cmd("bold")}>
              {t("pages.newsletter.bold")}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => cmd("italic")}
            >
              {t("pages.newsletter.italic")}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => cmd("formatBlock", "H2")}
            >
              {t("pages.newsletter.heading")}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => cmd("insertUnorderedList")}
            >
              {t("pages.newsletter.list")}
            </button>
            <button type="button" className={btnGhost} onClick={addLink}>
              {t("pages.newsletter.link")}
            </button>
            <button type="button" className={btnGhost} onClick={addImage}>
              Image
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={`${btnGhost} ml-auto`}
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
        <div
          ref={ref}
          className={`html-editor ${minHeightClass}`}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange(e.currentTarget.innerHTML)}
          onBlur={flushVisual}
        />
      )}
    </div>
  );
}
