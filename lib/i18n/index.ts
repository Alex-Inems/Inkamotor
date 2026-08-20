export { LanguageSwitcher } from "./language-switcher";
export { LocaleProvider, useLocale, useT } from "./locale-provider";
export { en, type Messages } from "./en";
export { es } from "./es";
export { fr } from "./fr";
export {
  defaultLocale,
  interpolate,
  localeMeta,
  locales,
  type Locale,
} from "./config";

import { en, type Messages } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import type { Locale } from "./config";

export const dictionaries: Record<Locale, Messages> = { en, fr, es };

export function messagesFor(locale: Locale): Messages {
  return dictionaries[locale] ?? en;
}
