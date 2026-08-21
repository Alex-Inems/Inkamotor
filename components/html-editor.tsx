"use client";

import { useEffect, useRef, useState } from "react";
import { btnGhost, inputClass } from "@/components/modal";
import { useT } from "@/lib/i18n";

export function HtmlEditor({
  html,
  onChange,
  resetKey,
}: {
  html: string;
  onChange: (html: string) => void;
  resetKey: string;
}) {
  const t = useT();
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "visual") return;
    if (ref.current) ref.current.innerHTML = html || "<p></p>";
    // Only remount content when the template/mode changes — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, mode]);

  function cmd(command: string, value?: string) {
    document.execCommand(command, false, value);
    onChange(ref.current?.innerHTML || "");
  }

  function addLink() {
    const url = window.prompt(t("pages.newsletter.linkPrompt"), "https://");
    if (url) cmd("createLink", url);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <button type="button" className={btnGhost} onClick={() => cmd("bold")}>
          {t("pages.newsletter.bold")}
        </button>
        <button type="button" className={btnGhost} onClick={() => cmd("italic")}>
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
        <button
          type="button"
          className={`${btnGhost} ml-auto`}
          onClick={() => setMode((m) => (m === "visual" ? "html" : "visual"))}
        >
          {mode === "visual" ? t("pages.newsletter.showHtml") : t("pages.newsletter.showVisual")}
        </button>
      </div>
      {mode === "html" ? (
        <textarea
          className={`${inputClass} min-h-40 font-mono text-xs`}
          value={html}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div
          ref={ref}
          className="html-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange(e.currentTarget.innerHTML)}
        />
      )}
    </div>
  );
}
