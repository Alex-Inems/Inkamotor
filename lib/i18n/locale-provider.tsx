"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { en, type Messages } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import {
  browserPreferredLocale,
  defaultLocale,
  detectLocale,
  interpolate,
  isLocale,
  localeMeta,
  localeStorageKey,
  type Locale,
} from "./config";

const dictionaries: Record<Locale, Messages> = { en, fr, es };

type MessagePath = string;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: MessagePath, vars?: Record<string, string | number>) => string;
  messages: Messages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function persistLocale(locale: Locale) {
  window.localStorage.setItem(localeStorageKey, locale);
  document.cookie = `${localeStorageKey}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = localeMeta[locale].bcp47;
}

function lookup(messages: Messages, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, messages);
  return typeof value === "string" ? value : path;
}

export function LocaleProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = detectLocale();
    if (stored !== initialLocale) {
      setLocaleState(stored);
      return;
    }
    if (stored !== defaultLocale) return;
    const preferred = browserPreferredLocale();
    if (preferred && preferred !== initialLocale) setLocaleState(preferred);
  }, [initialLocale]);

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  useEffect(() => {
    const onStorage = () => setLocaleState(detectLocale());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const messages = dictionaries[locale] ?? en;
    return {
      locale,
      setLocale,
      messages,
      t: (path, vars) => interpolate(lookup(messages, path), vars),
    };
  }, [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useT() {
  return useLocale().t;
}

export { isLocale };
export type { Locale };
