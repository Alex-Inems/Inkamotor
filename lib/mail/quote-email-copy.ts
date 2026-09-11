import {
  invoiceCompany,
  invoiceCompanyPhonesLine,
} from "@/lib/invoice-company";
import { type Sale } from "@/lib/demo-data";
import { formatSalesMoney } from "@/lib/format";
import { messagesFor, type Locale } from "@/lib/i18n";
import { saleTotal } from "@/lib/sale-quote";

export function quoteEmailSubject(sale: Sale, locale: Locale) {
  const copy = messagesFor(locale);
  return copy.pages.sales.quoteEmailSubject.replace("{number}", sale.number);
}

export function quoteEmailBodyText(sale: Sale, locale: Locale) {
  const copy = messagesFor(locale);
  const total = formatSalesMoney(
    saleTotal(sale) || sale.amount,
    locale,
  );
  return copy.pages.sales.quoteEmailBody
    .replace("{name}", sale.customer)
    .replace("{number}", sale.number)
    .replace("{total}", total);
}

export function quoteEmailHtmlFromText(bodyText: string, locale: Locale) {
  const copy = messagesFor(locale);
  const paragraphs = bodyText
    .split(/\n+/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  return `<div style="font-family:Georgia,serif;line-height:1.5;color:#1c1b19">
    ${paragraphs}
    <p style="margin-top:1rem;color:#666;font-size:13px">${escapeHtml(copy.pages.sales.quoteEmailAttached)}</p>
    <p style="color:#666;font-size:13px">— ${escapeHtml(invoiceCompany.name)}<br/>${escapeHtml(invoiceCompany.email)}<br/>${escapeHtml(invoiceCompanyPhonesLine())}<br/>${escapeHtml(`R.U.C. : ${invoiceCompany.ruc}`)}</p>
  </div>`;
}

export function quoteEmailHtml(sale: Sale, locale: Locale) {
  return quoteEmailHtmlFromText(quoteEmailBodyText(sale, locale), locale);
}

export function quotePdfFileName(sale: Sale) {
  return `${sale.number.replace(/\s+/g, "-")}-quotation.pdf`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
