export const locales = ["en", "fr", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeStorageKey = "inkamoto-locale";

export const localeMeta: Record<
  Locale,
  { label: string; short: string; bcp47: string }
> = {
  en: { label: "English", short: "EN", bcp47: "en-US" },
  fr: { label: "Français", short: "FR", bcp47: "fr-FR" },
  es: { label: "Español", short: "ES", bcp47: "es-ES" },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const stored = window.localStorage.getItem(localeStorageKey);
  if (isLocale(stored)) return stored;
  const nav = window.navigator.language.toLowerCase();
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("es")) return "es";
  return "en";
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] == null ? `{${key}}` : String(vars[key]),
  );
}
