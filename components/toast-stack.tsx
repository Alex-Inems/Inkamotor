"use client";

import { useCrm } from "@/lib/crm-store";
import { useT } from "@/lib/i18n";

export function ToastStack() {
  const { toasts, dismissToast } = useCrm();
  const t = useT();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-[min(100%-2rem,22rem)]">
      {toasts.map((toast) => {
        const toneClass =
          toast.tone === "success"
            ? "border-green/40 bg-green/15"
            : toast.tone === "error"
              ? "border-wine/40 bg-wine/15"
              : toast.tone === "info"
                ? "border-gold/35 bg-gold/15"
                : "border-line bg-panel";
        return (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start justify-between gap-3 border px-4 py-3 shadow-lg ${toneClass}`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{toast.message}</p>
              {toast.detail ? (
                <p className="mt-1 text-xs leading-relaxed text-ink/80">
                  {toast.detail}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-mute hover:text-ink"
              onClick={() => dismissToast(toast.id)}
            >
              {t("common.dismiss")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
