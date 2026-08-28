"use client";

import { ColorStripe, InkamotoLogo } from "@/components/brand";
import { invoiceCompany } from "@/lib/invoice-company";
import { type Sale } from "@/lib/demo-data";
import { saleTotal } from "@/lib/sale-quote";
import { resolveSaleTermsHtml } from "@/lib/quote-template-terms";
import { formatDate, formatSalesMoney } from "@/lib/format";
import { messagesFor, type Locale } from "@/lib/i18n";

export function QuoteDocument({
  sale,
  locale = "fr",
}: {
  sale: Sale;
  locale?: Locale;
}) {
  const copy = messagesFor(locale).quoteDoc;
  const total = saleTotal(sale) || sale.amount;
  const termsHtml = resolveSaleTermsHtml(sale, locale);

  return (
    <article className="invoice-sheet relative overflow-hidden bg-white text-[#1c1b19]">
      <ColorStripe className="absolute inset-x-0 top-0 z-10" />
      <div
        className="pointer-events-none absolute right-10 top-36 z-10 rotate-12 border-2 border-[#b8b3a8] px-3 py-1 font-display text-2xl tracking-[0.2em] text-[#b8b3a8] uppercase opacity-80"
      >
        {copy.stampQuotation}
      </div>

      <header className="bg-[#31595d] px-8 pb-6 pt-8 text-white">
        <div className="flex items-start justify-between gap-6">
          <div>
            <InkamotoLogo className="h-8 w-auto" />
            <p className="mt-3 text-xs leading-relaxed text-white/80">
              {copy.tagline}
              <br />
              {invoiceCompany.address}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl tracking-wide">{copy.quotation}</p>
            <p className="mt-1 text-sm font-semibold text-[#ecbb5a]">{sale.number}</p>
          </div>
        </div>
      </header>

      <div className="px-8 pb-8 pt-6">
        <dl className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
              {copy.number}
            </dt>
            <dd className="mt-1 font-medium">{sale.number}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
              {copy.issued}
            </dt>
            <dd className="mt-1">{formatDate(sale.createdAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
              {copy.validUntil}
            </dt>
            <dd className="mt-1">
              {sale.validityDate ? formatDate(sale.validityDate, locale) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
              {copy.salesperson}
            </dt>
            <dd className="mt-1">{sale.salesperson || "—"}</dd>
          </div>
        </dl>

        {sale.quoteTemplateName ? (
          <p className="mt-4 text-sm font-medium text-[#31595d]">{sale.quoteTemplateName}</p>
        ) : null}

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
              {copy.from}
            </p>
            <p className="mt-2 font-semibold">{invoiceCompany.name}</p>
            <p className="text-sm text-[#5c5850]">{invoiceCompany.email}</p>
            <p className="text-sm text-[#5c5850]">{invoiceCompany.phone}</p>
            <p className="text-sm text-[#5c5850]">{invoiceCompany.website}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
              {copy.customer}
            </p>
            <p className="mt-2 font-semibold">{sale.customer}</p>
            <p className="text-sm text-[#5c5850]">{sale.email}</p>
            {sale.paymentTerms ? (
              <p className="mt-3 text-sm text-[#5c5850]">
                <span className="font-semibold text-[#1c1b19]">{copy.paymentTerms}: </span>
                {sale.paymentTerms}
              </p>
            ) : null}
          </div>
        </div>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#31595d] text-white">
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em]">
                {copy.description}
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em]">
                {copy.qty}
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em]">
                {copy.unit}
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em]">
                {copy.amount}
              </th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line, i) => {
              if (line.displayType === "section") {
                return (
                  <tr key={`section-${i}`} className="bg-[#f7f4ef]">
                    <td colSpan={4} className="px-3 py-2 font-semibold text-[#31595d]">
                      {line.description}
                    </td>
                  </tr>
                );
              }
              if (line.displayType === "note") {
                return (
                  <tr key={`note-${i}`} className="border-b border-[#e6e1d8]">
                    <td colSpan={4} className="whitespace-pre-line px-3 py-2.5 text-xs leading-relaxed text-[#5c5850]">
                      {line.description}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={`product-${i}`} className="border-b border-[#e6e1d8]">
                  <td className="px-3 py-2.5">{line.description}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{line.qty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatSalesMoney(line.unitPrice, locale)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {formatSalesMoney(line.qty * line.unitPrice, locale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <div className="min-w-[220px] bg-[#f4e5c1] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#31595d]">
              {copy.total}
            </p>
            <p className="font-display text-3xl tracking-wide text-[#31595d]">
              {formatSalesMoney(total, locale)}
            </p>
          </div>
        </div>

        {termsHtml ? (
          <footer
            className="quote-terms mt-10 border-t border-[#e6e1d8] pt-4 text-xs leading-relaxed text-[#5c5850] [&_li]:ml-4 [&_p]:mb-2 [&_strong]:text-[#1c1b19]"
            dangerouslySetInnerHTML={{ __html: termsHtml }}
          />
        ) : null}

        <p className="mt-6 font-medium text-[#31595d]">{copy.thanks}</p>
      </div>
    </article>
  );
}
