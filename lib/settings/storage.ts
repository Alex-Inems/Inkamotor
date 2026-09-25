import { SETTINGS_DEFAULTS } from "@/lib/settings/defaults";
import type { SettingValues } from "@/lib/settings/types";

export const SETTINGS_STORAGE_KEY = "inkamoto.crm.settings.v1";

export function loadSettings(): SettingValues {
  if (typeof window === "undefined") return { ...SETTINGS_DEFAULTS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...SETTINGS_DEFAULTS };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...SETTINGS_DEFAULTS };
    return { ...SETTINGS_DEFAULTS, ...(parsed as SettingValues) };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

export function saveSettings(values: SettingValues) {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(values));
}

export function settingsEqual(a: SettingValues, b: SettingValues) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
