"use client";

import { ColorStripe, InkamotoLogo } from "@/components/brand";
import { invoiceCompany } from "@/lib/invoice-company";
import { invoiceTotal, type Invoice } from "@/lib/demo-data";
import { formatDate, formatMoney } from "@/lib/format";
import { messagesFor, type Locale } from "@/lib/i18n";

export function InvoiceDocument({
  invoice,
  locale = "en",
}: {
  invoice: Invoice;
  locale?: Locale;
}) {
  const copy = messagesFor(locale).invoiceDoc;
  const total = invoiceTotal(invoice);
  const stamp =
    invoice.status === "paid"
      ? copy.stampPaid
      : invoice.status === "void"
        ? copy.stampVoid
        : invoice.status === "overdue"
          ? copy.stampOverdue
          : invoice.status === "draft"
            ? copy.stampDraft
            : null;

  return (
    <article className="invoice-sheet relative overflow-hidden bg-white text-[#1c1b19]">
      <ColorStripe className="absolute inset-x-0 top-0 z-10" />
      {stamp ? (
        <div
          className={`pointer-events-none absolute right-10 top-36 z-10 rotate-12 border-2 px-3 py-1 font-display text-2xl tracking-[0.2em] uppercase opacity-80 ${
            invoice.status === "paid"
              ? "border-[#65814f] text-[#65814f]"
              : invoice.status === "void"
                ? "border-[#9f2627] text-[#9f2627]"
                : invoice.status === "overdue"
                  ? "border-[#e1736c] text-[#e1736c]"
                  : "border-[#b8b3a8] text-[#b8b3a8]"
          }`}
        >
          {stamp}
        </div>
      ) : null}

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
            <p className="font-display text-4xl tracking-wide">{copy.invoice}</p>
            <p className="mt-1 text-sm font-semibold text-[#ecbb5a]">
              {invoice.number}
            </p>
          </div>
        </div>
      </header>

      <div className="px-8 pb-8 pt-6">

      <dl className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
            {copy.number}
          </dt>
          <dd className="mt-1 font-medium">{invoice.number}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
            {copy.issued}
          </dt>
          <dd className="mt-1">{formatDate(invoice.issueDate, locale)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
            {copy.due}
          </dt>
          <dd className="mt-1">{formatDate(invoice.dueDate, locale)}</dd>
        </div>
        {invoice.paidDate ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8478]">
              {copy.paid}
            </dt>
            <dd className="mt-1">{formatDate(invoice.paidDate, locale)}</dd>
          </div>
        ) : (
          <div />
        )}
      </dl>

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
            {copy.billTo}
          </p>
          <p className="mt-2 font-semibold">{invoice.client}</p>
          <p className="text-sm text-[#5c5850]">{invoice.email}</p>
          {invoice.clientAddress ? (
            <p className="whitespace-pre-line text-sm text-[#5c5850]">
              {invoice.clientAddress}
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
          {invoice.lines.map((line, i) => (
            <tr key={`${line.description}-${i}`} className="border-b border-[#e6e1d8]">
              <td className="px-3 py-2.5">{line.description}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{line.qty}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatMoney(line.unitPrice, invoice.currency, false, locale)}
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                {formatMoney(
                  line.qty * line.unitPrice,
                  invoice.currency,
                  false,
                  locale,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="min-w-[220px] bg-[#f4e5c1] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#31595d]">
            {copy.total}
          </p>
          <p className="font-display text-3xl tracking-wide text-[#31595d]">
            {formatMoney(total, invoice.currency, false, locale)}
          </p>
        </div>
      </div>

      <footer className="mt-10 border-t border-[#e6e1d8] pt-4 text-xs leading-relaxed text-[#5c5850]">
        {invoice.notes ? (
          <p className="mb-3">
            <span className="font-semibold text-[#1c1b19]">{copy.notes}: </span>
            {invoice.notes}
          </p>
        ) : (
          <p>{copy.paymentNote}</p>
        )}
        <p className="mt-3 font-medium text-[#31595d]">{copy.thanks}</p>
      </footer>
      </div>
    </article>
  );
}
