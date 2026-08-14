"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n";

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-ash/80"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 max-h-[100svh] w-full overflow-y-auto border border-line bg-panel shadow-xl sm:max-h-[92svh] ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-4 py-3 sm:px-5">
          <h2 id="modal-title" className="font-display text-xl tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-sm font-medium text-mute hover:text-ink"
          >
            {t("common.close")}
          </button>
        </div>
        <div className="px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
        {label}
      </span>
      {children}
    </label>
  );
}

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center bg-accent px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-accent-deep disabled:opacity-50";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center border border-line bg-panel px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ash disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-sand transition-colors hover:bg-accent-soft disabled:opacity-50";

export const inputClass =
  "w-full border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-mute/70 focus:border-gold";
