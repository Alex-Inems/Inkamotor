import { QUOTE_TEMPLATE_TERMS_I18N } from "@/lib/seed/quote-template-terms-i18n";
import type { Sale } from "@/lib/demo-data";
import type { Locale } from "@/lib/i18n";
import type { OdooQuoteTemplate } from "@/lib/quotation-form-data";
import { getQuoteTemplateByName } from "@/lib/sale-quote";

export function getTemplateNoteHtml(
  template: OdooQuoteTemplate | null | undefined,
  locale: Locale,
): string {
  if (!template) return "";
  if (locale === "fr") return template.noteHtml;
  const translated = QUOTE_TEMPLATE_TERMS_I18N[template.id]?.[locale];
  return translated ?? template.noteHtml;
}

export function resolveSaleTermsHtml(sale: Sale, locale: Locale): string {
  const template = getQuoteTemplateByName(sale.quoteTemplateName);
  const localized = getTemplateNoteHtml(template, locale);
  return localized || sale.termsHtml;
}
