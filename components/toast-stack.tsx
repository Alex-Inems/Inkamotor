"use client";

import { useCrm } from "@/lib/crm-store";
import { useT } from "@/lib/i18n";

export function ToastStack() {
  const { toasts, dismissToast } = useCrm();
  const t = useT();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-[min(100%-2rem,20rem)]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start justify-between gap-3 border border-line bg-panel px-4 py-3 shadow-lg"
        >
          <p className="text-sm font-medium text-ink">{toast.message}</p>
          <button
            type="button"
            className="text-xs font-semibold text-mute hover:text-ink"
            onClick={() => dismissToast(toast.id)}
          >
            {t("common.dismiss")}
          </button>
        </div>
      ))}
    </div>
  );
}
