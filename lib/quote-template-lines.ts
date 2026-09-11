import type { SaleLine } from "@/lib/demo-data";
import type { Locale } from "@/lib/i18n";
import {
  cloneSaleLines,
  emptyProductLine,
  type OdooQuoteTemplate,
} from "@/lib/quote-templates";
import { QUOTE_TEMPLATE_LINES_I18N } from "@/lib/seed/quote-template-lines-i18n";

export function getLocalizedTemplateLines(
  template: OdooQuoteTemplate,
  locale: Locale,
): SaleLine[] {
  if (locale === "fr") return cloneSaleLines(template.lines);
  const translated = QUOTE_TEMPLATE_LINES_I18N[template.id]?.[locale];
  if (translated?.length) return cloneSaleLines(translated);
  return cloneSaleLines(template.lines);
}

export function applyLocalizedTemplateToQuotationLines(
  current: SaleLine[],
  template: OdooQuoteTemplate,
  locale: Locale,
): SaleLine[] {
  const boilerplate = getLocalizedTemplateLines(template, locale);
  const products = current.filter((line) => line.displayType === "product");
  const hasProduct = products.some((line) => line.description.trim());
  const productLines = hasProduct ? products : [emptyProductLine()];
  return [...productLines, ...boilerplate];
}
