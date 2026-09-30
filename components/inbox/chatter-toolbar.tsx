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
          ? "bg-cream/95 text-[#1c1b19] shadow-sm"
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
  followersOpen,
  onToggleFollowers,
  filesOpen,
  onToggleFiles,
  following,
  onToggleFollow,
  onScheduleActivity,
  whatsappUrl,
  extra,
}: {
  mode: ChatterMode;
  onModeChange: (mode: ChatterMode) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  followersOpen: boolean;
  onToggleFollowers: () => void;
  filesOpen: boolean;
  onToggleFiles: () => void;
  following: boolean;
  onToggleFollow: () => void;
  onScheduleActivity: () => void;
  whatsappUrl?: string | null;
  extra?: ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-line/80 bg-linear-to-b from-[#2a2825] to-panel/90 px-2 py-2 sm:px-3">
      <div className="mr-1 inline-flex rounded-full border border-line/70 bg-ash/50 p-0.5">
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
      <ToolBtn onClick={onScheduleActivity}>{t("pages.inbox.activities")}</ToolBtn>
      <ToolBtn active={searchOpen} onClick={onToggleSearch}>
        {t("pages.inbox.searchMessages")}
      </ToolBtn>
      <ToolBtn active={followersOpen} onClick={onToggleFollowers}>
        {t("pages.inbox.followers")}
      </ToolBtn>
      <ToolBtn active={filesOpen} onClick={onToggleFiles}>
        {t("pages.inbox.files")}
      </ToolBtn>
      <ToolBtn active={following} onClick={onToggleFollow}>
        {following ? t("pages.inbox.following") : t("pages.inbox.follow")}
      </ToolBtn>
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#6bdc7a] transition-colors hover:bg-[#6bdc7a]/12"
        >
          WhatsApp
        </a>
      ) : null}
      {extra}
    </div>
  );
}
