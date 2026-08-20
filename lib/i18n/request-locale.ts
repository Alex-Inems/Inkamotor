import {
  defaultLocale,
  isLocale,
  localeStorageKey,
  type Locale,
} from "./config";

export function localeFromRequest(req: Request): Locale {
  const url = new URL(req.url);
  const query = url.searchParams.get("locale");
  if (isLocale(query)) return query;

  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(
    new RegExp(`(?:^|;\\s*)${localeStorageKey}=([^;]+)`),
  );
  if (match) {
    const value = decodeURIComponent(match[1]);
    if (isLocale(value)) return value;
  }

  return defaultLocale;
}
