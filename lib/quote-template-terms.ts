import { QUOTE_TEMPLATE_TERMS_I18N } from "@/lib/seed/quote-template-terms-i18n";
import type { Sale } from "@/lib/demo-data";
import type { Locale } from "@/lib/i18n";
import type { OdooQuoteTemplate } from "@/lib/quotation-form-data";
import { getQuoteTemplateByName, SEED_QUOTE_TEMPLATES } from "@/lib/quote-templates";

export function getTemplateNoteHtml(
  template: OdooQuoteTemplate | null | undefined,
  locale: Locale,
): string {
  if (!template) return "";
  if (locale === "fr") return template.noteHtml;
  const translated = QUOTE_TEMPLATE_TERMS_I18N[template.id]?.[locale];
  return translated ?? template.noteHtml;
}

export function resolveSaleTermsHtml(
  sale: Sale,
  locale: Locale,
  templates = SEED_QUOTE_TEMPLATES,
): string {
  const template = getQuoteTemplateByName(templates, sale.quoteTemplateName);
  const localized = getTemplateNoteHtml(template, locale);
  if (localized.trim()) return localized;
  const fallback = templates.find((row) => getTemplateNoteHtml(row, locale).trim());
  return (fallback ? getTemplateNoteHtml(fallback, locale) : "") || sale.termsHtml;
}
