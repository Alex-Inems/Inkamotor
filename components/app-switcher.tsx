"use client";

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-canvas pt-[6px] text-ink">
      <div className="color-stripe shrink-0" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {CRM_APPS.map((app) => {
            const Icon = app.Icon;
            return (
              <Link
                key={app.id}
                href={app.href}
                data-tour={app.tour}
                onClick={onClose}
                className="group flex flex-col items-center gap-2.5 text-center"
              >
                <span
                  className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-xl text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.55)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_28px_-12px_rgba(0,0,0,0.5)] sm:h-20 sm:w-20"
                  style={{ background: app.color }}
                >
                  <Icon className="h-8 w-8" />
                  {app.id === "inbox" && unread > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-[6.5rem] text-[13px] font-medium leading-snug text-ink">
                  {t(app.labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
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
