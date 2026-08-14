import { localeMeta, type Locale } from "@/lib/i18n/config";

function tag(locale?: Locale) {
  return locale ? localeMeta[locale].bcp47 : "en-US";
}

export function formatMoney(
  amount: number,
  currency: string = "USD",
  compact = false,
  locale?: Locale,
) {
  return new Intl.NumberFormat(tag(locale), {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(amount);
}

export function formatNumber(n: number, compact = false, locale?: Locale) {
  return new Intl.NumberFormat(tag(locale), {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
}

export function formatDate(iso: string, locale?: Locale) {
  return new Intl.DateTimeFormat(tag(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatPercent(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}
