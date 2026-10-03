"use client";

import { useLayoutEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import {
  applyTheme,
  isThemeMode,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type ThemeMode,
} from "@/lib/theme";

function themeFromDom(): ThemeMode {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  return isThemeMode(attr) ? attr : resolveTheme(readStoredTheme());
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useLocale();
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const next = resolveTheme(readStoredTheme());
    setTheme(next);
    applyTheme(next);
    setReady(true);
  }, []);

  function toggle() {
    const current = themeFromDom();
    const next: ThemeMode = current === "dark" ? "light" : "dark";
    setTheme(next);
    persistTheme(next);
  }

  const label =
    theme === "dark" ? t("topbar.switchToLight") : t("topbar.switchToDark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`relative flex h-11 w-11 items-center justify-center rounded-full text-mute transition-colors hover:bg-panel hover:text-ink ${className}`}
    >
      <span className="sr-only">{label}</span>
      {ready && theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="3.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 1.75v1.5M9 14.75v1.5M1.75 9h1.5M14.75 9h1.5M3.4 3.4l1.06 1.06M13.54 13.54l1.06 1.06M14.6 3.4l-1.06 1.06M4.46 13.54l-1.06 1.06"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M14.5 10.2A5.75 5.75 0 0 1 7.8 3.5 5.9 5.9 0 1 0 14.5 10.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
