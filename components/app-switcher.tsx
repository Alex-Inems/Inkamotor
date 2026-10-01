"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CRM_APPS } from "@/lib/crm-apps";
import { useInboxNotifications } from "@/lib/inbox-notifications";
import { useT } from "@/lib/i18n";

export function AppSwitcher({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { unread } = useInboxNotifications();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="crm-atmosphere flex flex-col pt-[6px] text-ink"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("apps.openApps")}
    >
      <div className="color-stripe relative z-10 shrink-0" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div>
          <p className="font-display text-2xl tracking-wide text-ink">
            {t("brand.crm")}
          </p>
          <p className="text-sm text-mute">{t("apps.switcherHint")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("nav.closeMenu")}
          className="flex h-11 w-11 items-center justify-center text-mute transition-colors hover:bg-panel hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-3 gap-y-6 min-[380px]:grid-cols-3 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-8 md:grid-cols-5 lg:grid-cols-6">
          {CRM_APPS.map((app) => {
            const Icon = app.Icon;
            return (
              <Link
                key={app.id}
                href={app.href}
                data-tour={app.tour}
                onClick={onClose}
                className="crm-app-tile group flex flex-col items-center gap-2.5 text-center"
              >
                <span
                  className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_12px_28px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:shadow-[0_18px_36px_-12px_rgba(0,0,0,0.55)] min-[380px]:h-16 min-[380px]:w-16 sm:h-[4.5rem] sm:w-[4.5rem] md:h-20 md:w-20"
                  style={{ background: app.color }}
                >
                  <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                  {app.id === "inbox" && unread > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-[6.5rem] text-[12px] font-medium leading-snug text-ink sm:text-[13px]">
                  {t(app.labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M4 4l10 10M14 4 4 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
