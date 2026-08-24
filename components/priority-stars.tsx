"use client";

import type { LeadPriority } from "@/lib/crm/contact-details";
import { useT } from "@/lib/i18n";

export function PriorityStars({
  value,
  onChange,
  disabled,
  size = "sm",
}: {
  value: LeadPriority;
  onChange?: (next: LeadPriority) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const t = useT();
  const editable = Boolean(onChange) && !disabled;
  const starClass =
    size === "md" ? "text-xl leading-none" : "text-base leading-none";

  return (
    <div
      role={editable ? "group" : "img"}
      aria-label={t("pages.leads.priorityValue", { n: value })}
      className="inline-flex items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {([1, 2, 3] as const).map((level) => {
        const filled = value >= level;
        const label = t("pages.leads.setPriority", { n: level });
        if (!editable) {
          return (
            <span
              key={level}
              aria-hidden
              className={`${starClass} ${filled ? "text-gold" : "text-mute/40"}`}
            >
              ★
            </span>
          );
        }
        return (
          <button
            key={level}
            type="button"
            disabled={disabled}
            aria-label={label}
            title={label}
            aria-pressed={filled}
            onClick={() => onChange?.(value === level ? 0 : level)}
            className={`${starClass} rounded-sm px-0.5 transition-colors hover:text-gold disabled:opacity-50 ${
              filled ? "text-gold" : "text-mute/45 hover:text-gold/70"
            }`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
