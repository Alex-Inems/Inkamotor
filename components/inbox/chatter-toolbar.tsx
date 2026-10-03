"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n";

export type ChatterMode = "message" | "note";

function ToolBtn({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
        active
          ? "bg-panel text-ink shadow-sm ring-1 ring-line"
          : "bg-transparent text-mute hover:bg-ash hover:text-ink"
      } ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function ChatterToolbar({
  mode,
  onModeChange,
  searchOpen,
  onToggleSearch,
  filesOpen,
  onToggleFiles,
  onScheduleActivity,
  whatsappUrl,
  extra,
}: {
  mode: ChatterMode;
  onModeChange: (mode: ChatterMode) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  filesOpen: boolean;
  onToggleFiles: () => void;
  onScheduleActivity: () => void;
  whatsappUrl?: string | null;
  extra?: ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-line/80 bg-ash/60 px-2 py-2 [scrollbar-width:none] sm:px-3 [&::-webkit-scrollbar]:hidden">
      <div className="mr-1 inline-flex shrink-0 rounded-full border border-line/70 bg-panel/80 p-0.5">
        <ToolBtn
          active={mode === "message"}
          onClick={() => onModeChange("message")}
        >
          {t("pages.inbox.sendMessage")}
        </ToolBtn>
        <ToolBtn active={mode === "note"} onClick={() => onModeChange("note")}>
          {t("pages.inbox.logNote")}
        </ToolBtn>
      </div>
      <ToolBtn className="shrink-0" onClick={onScheduleActivity}>
        {t("pages.inbox.activities")}
      </ToolBtn>
      <ToolBtn
        className="shrink-0"
        active={searchOpen}
        onClick={onToggleSearch}
      >
        {t("pages.inbox.searchMessages")}
      </ToolBtn>
      <ToolBtn className="shrink-0" active={filesOpen} onClick={onToggleFiles}>
        {t("pages.inbox.files")}
      </ToolBtn>
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#6bdc7a] transition-colors hover:bg-[#6bdc7a]/12"
        >
          WhatsApp
        </a>
      ) : null}
      {extra}
    </div>
  );
}
