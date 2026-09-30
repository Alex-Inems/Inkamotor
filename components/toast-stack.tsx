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
        const hasProgress = typeof toast.progress === "number";
        const percent = hasProgress ? Math.round(toast.progress!) : 0;
        const toneClass =
          toast.tone === "success"
            ? "border-green/45 bg-green/15"
            : toast.tone === "error"
              ? "border-wine/45 bg-wine/15"
              : toast.tone === "info"
                ? "border-gold/40 bg-gold/15"
                : "border-line bg-panel";
        const iconClass =
          toast.tone === "success"
            ? "bg-green/25 text-sand"
            : toast.tone === "error"
              ? "bg-wine/25 text-pink"
              : toast.tone === "info"
                ? "bg-gold/25 text-gold"
                : "bg-ash text-mute";

        if (hasProgress) {
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto overflow-hidden border border-line bg-panel shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 animate-pulse"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3v12" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M5 19h14" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-ink">
                      {toast.message}
                    </p>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">
                      {percent}%
                    </span>
                  </div>
                  {toast.detail ? (
                    <p className="mt-0.5 truncate text-xs text-mute">
                      {toast.detail}
                    </p>
                  ) : null}
                  <div
                    className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ash"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-label={toast.message}
                  >
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.max(3, percent)}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-0.5 shrink-0 text-mute hover:text-ink"
                  aria-label={t("common.dismiss")}
                  onClick={() => dismissToast(toast.id)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 border px-4 py-3 shadow-lg ${toneClass}`}
          >
            <span
              aria-hidden
              className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${iconClass}`}
            >
              {toast.tone === "success"
                ? "✓"
                : toast.tone === "error"
                  ? "!"
                  : "i"}
            </span>
            <div className="min-w-0 flex-1">
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
