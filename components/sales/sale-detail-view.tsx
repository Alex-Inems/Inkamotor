"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  btnToolbar,
  Modal,
} from "@/components/modal";
import { InvoiceDocument } from "@/components/invoice-document";
import { QuoteDocument } from "@/components/quote-document";
import { SaleChatPanel } from "@/components/sales/sale-chat-thread";
import { SendQuotationModal } from "@/components/sales/send-quotation-modal";
import { OdooFormToolbar } from "@/components/sales/odoo-form-toolbar";
import { SalesSubnav } from "@/components/sales/sales-subnav";
import { EmptyHint, StatusBadge } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import { type Invoice, type Sale, type SaleStatus } from "@/lib/demo-data";
import { enrichSale } from "@/lib/sale-quote";
import { orderQuotationDocumentLines } from "@/lib/quote-templates";
import { SalesAmount } from "@/components/sales/sales-amount";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { saleTone } from "@/lib/status";

export function SaleDetailView({ saleId }: { saleId: string }) {
  const router = useRouter();
  const {
    sales,
    invoices,
    ready,
    updateSaleStatus,
    sendSaleQuote,
    addInvoiceFromSale,
    deleteSale,
    pushToast,
  } = useCrm();
  const { t, locale } = useLocale();

  const [quotePreview, setQuotePreview] = useState<Sale | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<Invoice | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);
  const [sendQuoteSale, setSendQuoteSale] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);

  const raw = sales.find((row) => row.id === saleId) ?? null;
  const sale = useMemo(() => (raw ? enrichSale(raw) : null), [raw]);
  const documentLines = useMemo(
    () => (sale ? orderQuotationDocumentLines(sale.lines) : []),
    [sale],
  );

  const stageLabel = (id: SaleStatus) => t(`saleStages.${id}`);

  async function sendQuotation(target: Sale, message: string) {
    setSendingQuoteId(target.id);
    try {
      await sendSaleQuote(target.id, message);
      setSendQuoteSale(null);
    } catch {
      /* toast in store */
    } finally {
      setSendingQuoteId(null);
    }
  }

  async function moveSale(status: SaleStatus) {
    if (!sale || sale.status === status) return;
    setMoving(true);
    await updateSaleStatus(sale.id, status);
    setMoving(false);
  }

  async function deleteSaleOrder() {
    if (!sale) return;
    if (
      !window.confirm(
        t("pages.sales.deleteSaleConfirm", { number: sale.number }),
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteSale(sale.id);
      router.push("/sales?tab=bookings");
    } catch {
      /* toast in store */
    } finally {
      setDeleting(false);
    }
  }

  if (!ready) {
    return <EmptyHint>{t("common.loadingWorkspace")}</EmptyHint>;
  }

  if (!sale) {
    return (
      <div className="space-y-3">
        <EmptyHint>{t("pages.sales.saleNotFound")}</EmptyHint>
        <Link href="/sales?tab=bookings" className="text-sm font-semibold text-gold hover:underline">
          {t("pages.sales.backToOrders")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <SalesSubnav />

      <div className="mb-3 mt-4 text-xs text-mute">
        <Link href="/sales?tab=bookings" className="hover:text-ink">
          {t("pages.sales.menuOrders")}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-ink">{sale.number}</span>
      </div>

      <OdooFormToolbar>
        {sale.status === "pending" ? (
          <>
            <button
              type="button"
              className={btnToolbar}
              disabled={sendingQuoteId === sale.id}
              onClick={() => setSendQuoteSale(sale)}
            >
              {sendingQuoteId === sale.id
                ? t("common.sending")
                : t("pages.sales.sendQuotation")}
            </button>
            <button
              type="button"
              className={btnToolbar}
              disabled={moving}
              onClick={() => void moveSale("confirmed")}
            >
              {t("pages.sales.confirmOrder")}
            </button>
          </>
        ) : null}
        {sale.status === "sent" ? (
          <button
            type="button"
            className={btnToolbar}
            disabled={moving}
            onClick={() => void moveSale("confirmed")}
          >
            {t("pages.sales.confirmOrder")}
          </button>
        ) : null}
        {sale.status === "confirmed" ? (
          <button
            type="button"
            className={btnToolbar}
            disabled={moving}
            onClick={() => void moveSale("fulfilled")}
          >
            {t("pages.sales.lockOrder")}
          </button>
        ) : null}
        <button
          type="button"
          className={btnToolbar}
          onClick={() => setQuotePreview(sale)}
        >
          {t("pages.sales.previewQuote")}
        </button>
        {sale.invoiceId ? (
          <button
            type="button"
            className={btnToolbar}
            onClick={() => {
              const invoice = invoices.find((inv) => inv.id === sale.invoiceId);
              if (invoice) setInvoicePreview(invoice);
            }}
          >
            {t("pages.sales.previewInvoice")}
          </button>
        ) : (
          <button
            type="button"
            className={btnToolbar}
            onClick={() => {
              void addInvoiceFromSale(sale.id).then((invoice) => {
                if (invoice) setInvoicePreview(invoice);
              });
            }}
          >
            {t("pages.sales.createInvoice")}
          </button>
        )}
        {sale.status !== "cancelled" && sale.status !== "fulfilled" ? (
          <button
            type="button"
            className={btnToolbar}
            disabled={moving}
            onClick={() => void moveSale("cancelled")}
          >
            {t("pages.sales.cancelOrder")}
          </button>
        ) : null}
        <button
          type="button"
          className={btnGhost}
          disabled={deleting}
          onClick={() => void deleteSaleOrder()}
        >
          {deleting ? t("common.deleting") : t("pages.sales.deleteSale")}
        </button>
      </OdooFormToolbar>

      <div className="grid min-h-0 flex-1 border border-line bg-panel lg:grid-cols-[minmax(0,1fr)_minmax(300px,38%)]">
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl tracking-wide text-ink">{sale.number}</h1>
              <p className="mt-2 font-medium">{sale.customer}</p>
              <p className="text-sm text-mute">{sale.email}</p>
              {sale.quoteTemplateName ? (
                <p className="mt-1 text-sm text-mute">{sale.quoteTemplateName}</p>
              ) : null}
            </div>
            <StatusBadge tone={saleTone(sale.status)}>
              {stageLabel(sale.status)}
            </StatusBadge>
          </div>

          {documentLines.length > 0 ? (
            <div className="table-wrap mb-6">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("pages.sales.lineProduct")}</th>
                    <th className="w-24 text-right">{t("pages.sales.lineQty")}</th>
                    <th className="w-32 text-right">{t("pages.sales.lineUnitPrice")}</th>
                    <th className="w-32 text-right">{t("pages.sales.lineAmount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {documentLines.map((line, i) =>
                    line.displayType === "section" ? (
                      <tr key={`line-${i}`} className="bg-ash/40">
                        <td colSpan={4} className="font-semibold">
                          {line.description}
                        </td>
                      </tr>
                    ) : line.displayType === "note" ? (
                      <tr key={`line-${i}`}>
                        <td colSpan={4} className="whitespace-pre-line text-sm text-mute">
                          {line.description}
                        </td>
                      </tr>
                    ) : (
                      <tr key={`line-${i}`}>
                        <td>{line.description}</td>
                        <td className="text-right tabular-nums">{line.qty}</td>
                        <td className="text-right tabular-nums">
                          <SalesAmount amount={line.unitPrice} locale={locale} className="inline-block" />
                        </td>
                        <td className="text-right font-medium tabular-nums">
                          <SalesAmount
                            amount={line.qty * line.unitPrice}
                            locale={locale}
                            className="inline-block"
                          />
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-6 text-sm">{sale.product}</p>
          )}

          <div className="mb-6 flex justify-end">
            <div className="min-w-[220px] space-y-1 border border-line bg-ash/30 px-4 py-3 text-sm">
              <div className="flex justify-between font-semibold text-ink">
                <span>{t("pages.sales.total")}</span>
                <SalesAmount amount={sale.amount} locale={locale} size="md" />
              </div>
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                {t("pages.sales.orderDate")}
              </dt>
              <dd>{formatDate(sale.createdAt, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                {t("common.source")}
              </dt>
              <dd>{t(`sources.${sale.source}`)}</dd>
            </div>
            {sale.paymentTerms ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                  {t("pages.sales.paymentTerms")}
                </dt>
                <dd>{sale.paymentTerms}</dd>
              </div>
            ) : null}
            {sale.salesperson ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                  {t("pages.sales.salesperson")}
                </dt>
                <dd>{sale.salesperson}</dd>
              </div>
            ) : null}
          </dl>

          {sale.notes ? (
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                {t("common.notes")}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm text-mute">{sale.notes}</p>
            </div>
          ) : null}
        </div>

        <SaleChatPanel email={sale.email} customerName={sale.customer} />
      </div>

      <Modal
        open={!!quotePreview}
        title={t("pages.sales.previewQuote")}
        onClose={() => setQuotePreview(null)}
        wide
        footer={
          quotePreview ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  void import("@/lib/quote-pdf").then(({ downloadQuotePdf }) =>
                    downloadQuotePdf(quotePreview, locale).catch((err) =>
                      pushToast(
                        err instanceof Error ? err.message : t("pages.sales.quotePdfFailed"),
                      ),
                    ),
                  );
                }}
              >
                {t("pages.sales.downloadQuote")}
              </button>
              <button type="button" className={btnSecondary} onClick={() => window.print()}>
                {t("pages.invoices.printPdf")}
              </button>
            </div>
          ) : null
        }
      >
        {quotePreview ? (
          <div className="printing-invoice">
            <QuoteDocument sale={quotePreview} locale={locale} />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!invoicePreview}
        title={t("pages.sales.previewInvoice")}
        onClose={() => setInvoicePreview(null)}
        wide
        footer={
          invoicePreview ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={downloadingInvoice}
                onClick={() => {
                  if (!invoicePreview) return;
                  setDownloadingInvoice(true);
                  void import("@/lib/invoice-pdf")
                    .then(({ downloadInvoicePdf }) =>
                      downloadInvoicePdf(invoicePreview, locale),
                    )
                    .then(() =>
                      pushToast(
                        t("pages.invoices.downloaded", {
                          file: `${invoicePreview.number}.pdf`,
                        }),
                      ),
                    )
                    .catch((err) =>
                      pushToast(
                        err instanceof Error
                          ? err.message
                          : t("pages.invoices.pdfFailed"),
                      ),
                    )
                    .finally(() => setDownloadingInvoice(false));
                }}
              >
                {downloadingInvoice
                  ? t("common.downloading")
                  : t("pages.invoices.downloadPdf")}
              </button>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  document.body.classList.add("printing-invoice");
                  const done = () => document.body.classList.remove("printing-invoice");
                  window.addEventListener("afterprint", done, { once: true });
                  window.print();
                  window.setTimeout(done, 1000);
                }}
              >
                {t("pages.invoices.printPdf")}
              </button>
            </div>
          ) : null
        }
      >
        {invoicePreview ? (
          <div className="printing-invoice">
            <InvoiceDocument invoice={invoicePreview} locale={locale} />
          </div>
        ) : null}
      </Modal>

      <SendQuotationModal
        open={!!sendQuoteSale}
        sale={sendQuoteSale}
        sending={!!sendQuoteSale && sendingQuoteId === sendQuoteSale.id}
        onClose={() => {
          if (sendingQuoteId) return;
          setSendQuoteSale(null);
        }}
        onSend={(message) => {
          if (!sendQuoteSale) return;
          void sendQuotation(sendQuoteSale, message);
        }}
      />
    </div>
  );
}
