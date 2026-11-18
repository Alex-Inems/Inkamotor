export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "inkamoto.theme";

/** Strip Cursor/browser overlay attrs so they cannot mismatch SSR HTML during hydrate. */
const STRIP_CURSOR_REF_SCRIPT = `try{function __crmStripCursorRef(n){if(!n)return;if(n.removeAttribute)n.removeAttribute("data-cursor-ref");if(n.querySelectorAll){var a=n.querySelectorAll("[data-cursor-ref]");for(var i=0;i<a.length;i++)a[i].removeAttribute("data-cursor-ref");}}__crmStripCursorRef(document.documentElement);var __crmCursorObs=new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.type==="attributes"&&m.attributeName==="data-cursor-ref")m.target.removeAttribute("data-cursor-ref");var ns=m.addedNodes;for(var j=0;j<ns.length;j++)__crmStripCursorRef(ns[j]);}});__crmCursorObs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["data-cursor-ref"]});setTimeout(function(){try{__crmCursorObs.disconnect();}catch(x){}},2500);}catch(x){}`;

export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute("data-theme","dark");document.documentElement.style.colorScheme="dark";}${STRIP_CURSOR_REF_SCRIPT}})();`;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function resolveTheme(stored?: ThemeMode | null): ThemeMode {
  if (stored) return stored;
  if (typeof window === "undefined") return "dark";
  try {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  } catch {
    /* ignore */
  }
  return "dark";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "light" ? "#f0f2f7" : "#1c1b19");
  }
}

export function persistTheme(theme: ThemeMode) {
  applyTheme(theme);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}
