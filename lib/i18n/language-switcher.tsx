"use client";

import { localeMeta, locales } from "./config";
import { useLocale } from "./locale-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t("topbar.language")}
      className="flex shrink-0 border border-line"
    >
      {locales.map((code) => {
        const active = locale === code;
        const meta = localeMeta[code];
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={`min-h-9 px-2 text-xs font-semibold tracking-[0.08em] transition-colors sm:px-2.5 ${
              active
                ? "bg-accent text-white"
                : "text-mute hover:bg-ash hover:text-ink"
            }`}
            aria-pressed={active}
            title={meta.label}
          >
            {meta.short}
          </button>
        );
      })}
    </div>
  );
}
