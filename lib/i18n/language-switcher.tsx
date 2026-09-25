"use client";

import { localeMeta, locales, type Locale } from "./config";
import { useLocale } from "./locale-provider";

function LocaleFlag({ code }: { code: Locale }) {
  const title = localeMeta[code].label;
  if (code === "en") {
    return (
      <svg viewBox="0 0 16 10" className="h-2.5 w-4 shrink-0" aria-hidden>
        <title>{title}</title>
        <rect width="16" height="10" fill="#012169" />
        <path d="M0 0 L16 10 M16 0 L0 10" stroke="#fff" strokeWidth="2" />
        <path d="M0 0 L16 10 M16 0 L0 10" stroke="#C8102E" strokeWidth="1" />
        <path d="M8 0 V10 M0 5 H16" stroke="#fff" strokeWidth="3.2" />
        <path d="M8 0 V10 M0 5 H16" stroke="#C8102E" strokeWidth="1.8" />
      </svg>
    );
  }
  if (code === "fr") {
    return (
      <svg viewBox="0 0 16 10" className="h-2.5 w-4 shrink-0" aria-hidden>
        <title>{title}</title>
        <rect width="16" height="10" fill="#fff" />
        <rect width="5.4" height="10" fill="#002395" />
        <rect x="10.6" width="5.4" height="10" fill="#ED2939" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 10" className="h-2.5 w-4 shrink-0" aria-hidden>
      <title>{title}</title>
      <rect width="16" height="10" fill="#C60B1E" />
      <rect y="2.5" width="16" height="5" fill="#FFC400" />
    </svg>
  );
}

export function LanguageSwitcher({
  variant = "bar",
}: {
  variant?: "bar" | "menu";
}) {
  const { locale, setLocale, t } = useLocale();

  if (variant === "menu") {
    return (
      <div role="group" aria-label={t("topbar.language")}>
        <p className="px-4 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
          {t("topbar.language")}
        </p>
        <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
          {locales.map((code) => {
            const active = locale === code;
            const meta = localeMeta[code];
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => setLocale(code)}
                className={`flex flex-col items-center gap-1 border px-2 py-2.5 text-[11px] font-semibold tracking-[0.06em] transition-colors ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-ash text-mute hover:border-sand hover:text-ink"
                }`}
                title={meta.label}
              >
                <LocaleFlag code={code} />
                {meta.short}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
            className={`flex min-h-10 w-9 flex-col items-center justify-center gap-0.5 px-0 text-[10px] font-semibold leading-none tracking-[0.06em] transition-colors sm:min-h-9 sm:w-10 sm:text-[11px] ${
              active
                ? "bg-accent text-white"
                : "text-mute hover:bg-ash hover:text-ink"
            }`}
            aria-pressed={active}
            title={meta.label}
          >
            <LocaleFlag code={code} />
            {meta.short}
          </button>
        );
      })}
    </div>
  );
}
