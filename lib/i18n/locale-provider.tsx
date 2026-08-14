"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { en, type Messages } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import {
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

const localeListeners = new Set<() => void>();

function subscribeLocale(onChange: () => void) {
  localeListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    localeListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function emitLocaleChange() {
  localeListeners.forEach((fn) => fn());
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

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeLocale,
    detectLocale,
    () => defaultLocale,
  );

  useEffect(() => {
    document.documentElement.lang = localeMeta[locale].bcp47;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    window.localStorage.setItem(localeStorageKey, next);
    emitLocaleChange();
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
