"use client";

import { useEffect, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
  extraWide,
  flush,
  size = "md",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  extraWide?: boolean;
  /** Skip default body padding (composer layouts). */
  flush?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = extraWide
    ? "sm:max-w-5xl"
    : wide || size === "xl"
      ? "sm:max-w-3xl"
      : size === "lg"
        ? "sm:max-w-2xl"
        : size === "sm"
          ? "sm:max-w-md"
          : "sm:max-w-lg";

  return (
    <div className="crm-modal-root fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5">
      <button
        type="button"
        aria-label={t("common.close")}
        className="crm-modal-backdrop absolute inset-0 bg-[#0c0b0a]/72 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`crm-modal-panel relative z-10 flex max-h-svh w-full flex-col overflow-hidden border border-line/70 bg-panel shadow-[0_28px_90px_rgba(0,0,0,0.58),0_0_0_1px_rgba(236,187,90,0.06)] sm:max-h-[min(92svh,52rem)] ${maxW} rounded-t-[1.35rem] sm:rounded-2xl`}
      >
        <div className="relative shrink-0 border-b border-line/80 bg-linear-to-b from-[#2c2a27] to-panel px-4 py-3.5 sm:px-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-mute/35 sm:hidden" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold/35 to-transparent" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pt-0.5">
              <h2
                id="modal-title"
                className="truncate font-display text-[1.35rem] leading-none tracking-[0.04em] text-ink sm:text-[1.5rem]"
              >
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1.5 truncate text-[12px] text-mute">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line/70 bg-ash/50 text-mute transition-colors hover:border-mute/40 hover:bg-ash hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M3 3l8 8M11 3 3 11"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-y-auto compose-scroll ${
            flush ? "" : "px-4 py-4 sm:px-5 sm:py-5"
          }`}
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-line/80 bg-[#211f1c]/95 px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-5">
            {footer}
          </div>
        ) : (
          <div className="h-[env(safe-area-inset-bottom)]" />
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-mute/80">{hint}</span> : null}
    </label>
  );
}

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:bg-accent-deep disabled:opacity-50";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-panel px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ash disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold tracking-wide text-mute transition-colors hover:bg-ash hover:text-ink disabled:opacity-50";

export const btnCompact =
  "inline-flex items-center justify-center rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-ash disabled:opacity-50";

export const btnCompactPrimary =
  "inline-flex items-center justify-center rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-deep disabled:opacity-50";

export const btnToolbar =
  "inline-flex min-h-8 items-center justify-center rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors hover:border-mute/40 hover:bg-ash disabled:opacity-50";

export const btnToolbarPrimary =
  "inline-flex min-h-8 items-center justify-center rounded-lg border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:border-accent-deep hover:bg-accent-deep disabled:opacity-50";

export const inputClass =
  "w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-mute/70 focus:border-gold/80 focus:shadow-[0_0_0_3px_rgba(236,187,90,0.12)]";

export const inputUnderlineClass =
  "w-full rounded-none border-0 border-b border-line bg-transparent px-0 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-mute/70 focus:border-gold";

/** Compact row field used in compose sheets (label | control). */
export const composeRowClass =
  "grid grid-cols-[4.5rem_1fr] items-center gap-3 border-b border-line/60 px-4 py-2.5 sm:grid-cols-[5.5rem_1fr] sm:px-5";

export const composeInputClass =
  "w-full border-0 bg-transparent px-0 py-1 text-sm text-ink outline-none placeholder:text-mute/60";
