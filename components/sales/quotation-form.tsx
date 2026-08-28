"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { btnSecondary, btnToolbar, btnToolbarPrimary, inputUnderlineClass } from "@/components/modal";
import { ClientSearchInput } from "@/components/sales/client-search-input";
import { ProductSearchInput } from "@/components/sales/product-search-input";
import { QuoteTemplateSearchInput } from "@/components/sales/quote-template-search-input";
import { SendQuotationModal } from "@/components/sales/send-quotation-modal";
import { OdooFormToolbar } from "@/components/sales/odoo-form-toolbar";
import { useCrm } from "@/lib/crm-store";
import { type Sale, type SaleLine, type SaleStatus } from "@/lib/demo-data";
import {
  defaultValidityDate,
  emptyQuotationLine,
  getPaymentTermLabel,
  lineTotal,
  linesTotal,
  PAYMENT_TERMS,
  primaryProductLabel,
  QUOTE_TEMPLATES,
  type OdooQuoteTemplate,
} from "@/lib/quotation-form-data";
import { getTemplateNoteHtml } from "@/lib/quote-template-terms";
import {
  clearQuotationDraft,
  loadQuotationDraft,
  saveQuotationDraft,
} from "@/lib/quotation-draft";
import { formatSalesMoney } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

type Tab = "lines" | "other";

const STAGES: SaleStatus[] = ["pending", "sent", "confirmed"];

function stageOdooLabel(status: SaleStatus, t: (key: string) => string) {
  if (status === "pending") return t("pages.sales.stageQuotation");
  if (status === "sent") return t("pages.sales.stageSent");
  return t("pages.sales.stageSalesOrder");
}

export function QuotationForm() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { leads, products, addSale, sendSaleQuote, pushToast } = useCrm();
  const [tab, setTab] = useState<Tab>("lines");
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");
  const [quoteTemplateName, setQuoteTemplateName] = useState(
    QUOTE_TEMPLATES[0]?.name ?? "",
  );
  const [validityDate, setValidityDate] = useState(
    defaultValidityDate(QUOTE_TEMPLATES[0]?.numberOfDays ?? 10),
  );
  const [paymentTerms, setPaymentTerms] = useState(PAYMENT_TERMS[1]?.name ?? "");
  const [lines, setLines] = useState<SaleLine[]>([emptyQuotationLine()]);
  const [salesperson] = useState(t("pages.sales.defaultSalesperson"));
  const [saving, setSaving] = useState(false);
  const [sendQuoteSale, setSendQuoteSale] = useState<Sale | null>(null);
  const [sendingQuote, setSendingQuote] = useState(false);

  useEffect(() => {
    const draft = loadQuotationDraft();
    if (!draft) return;
    setCustomer(draft.customer);
    setEmail(draft.email);
    setQuoteTemplateName(draft.quoteTemplateName);
    setValidityDate(draft.validityDate);
    setPaymentTerms(draft.paymentTerms);
    setLines(draft.lines.length > 0 ? draft.lines : [emptyQuotationLine()]);
  }, []);

  const template = useMemo(
    () => QUOTE_TEMPLATES.find((row) => row.name === quoteTemplateName) ?? null,
    [quoteTemplateName],
  );

  const termsHtml = useMemo(
    () => getTemplateNoteHtml(template, locale),
    [template, locale],
  );

  const total = linesTotal(lines);

  const catalogProducts = useMemo(
    () =>
      [...products]
        .filter((product) => product.active && product.saleOk)
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [products, locale],
  );

  function onProductPick(index: number, product: { name: string; listPrice: number }) {
    updateLine(index, {
      description: product.name,
      unitPrice: product.listPrice,
    });
  }

  function persistDraft() {
    saveQuotationDraft({
      customer,
      email,
      quoteTemplateName,
      validityDate,
      paymentTerms,
      lines,
    });
  }

  function openPreview() {
    persistDraft();
    router.push("/sales/new/preview");
  }

  function openPrint() {
    persistDraft();
    router.push("/sales/new/preview?print=1");
  }

  function openCatalogue() {
    persistDraft();
    router.push("/sales/new/catalogue");
  }

  function onTemplateSelect(tpl: OdooQuoteTemplate) {
    setQuoteTemplateName(tpl.name);
    setValidityDate(defaultValidityDate(tpl.numberOfDays));
  }

  function onLeadSelect(lead: { name: string; email: string; company: string }) {
    const label =
      lead.name.trim() || lead.company.trim() || lead.email.trim();
    setCustomer(label);
    if (lead.email) setEmail(lead.email);
  }

  function updateLine(index: number, patch: Partial<SaleLine>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function addLine(type: SaleLine["displayType"]) {
    setLines((prev) => [
      ...prev,
      {
        description: "",
        displayType: type,
        qty: type === "product" ? 1 : 0,
        unitPrice: 0,
      },
    ]);
  }

  async function save(status: SaleStatus = "pending") {
    if (!customer.trim()) {
      pushToast(t("pages.sales.customerRequired"));
      return null;
    }
    const billable = lines.filter(
      (line) => line.displayType === "product" && line.description.trim(),
    );
    if (billable.length === 0) {
      pushToast(t("pages.sales.lineRequired"));
      return null;
    }
    if (status === "sent") {
      const emailTrim = email.trim();
      if (
        !emailTrim ||
        !emailTrim.includes("@") ||
        emailTrim.endsWith("@inkamototours.local")
      ) {
        pushToast(t("pages.sales.clientEmailRequired"));
        return null;
      }
    }
    setSaving(true);
    try {
      const draftStatus = status === "sent" ? "pending" : status;
      const sale = await addSale({
        customer: customer.trim(),
        email: email.trim() || `quote+${Date.now()}@inkamototours.local`,
        product: primaryProductLabel(lines),
        amount: total,
        currency: "EUR",
        source: "website",
        inquiryId: null,
        leadId: null,
        notes: t("pages.sales.createdInCrm"),
        lines,
        quoteTemplateName,
        paymentTerms,
        validityDate,
        termsHtml,
        salesperson,
        status: draftStatus,
      });
      return sale;
    } catch {
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function prepareSendQuotation() {
    const sale = await save("sent");
    if (sale) setSendQuoteSale(sale);
  }

  async function confirmSendQuotation(message: string) {
    if (!sendQuoteSale) return;
    setSendingQuote(true);
    try {
      await sendSaleQuote(sendQuoteSale.id, message);
      clearQuotationDraft();
      setSendQuoteSale(null);
      router.push("/sales?tab=bookings");
    } catch {
      /* toasts handled in store */
    } finally {
      setSendingQuote(false);
    }
  }

  return (
    <>
      <OdooFormToolbar>
        <button
          type="button"
          className={btnToolbar}
          disabled={saving || sendingQuote}
          onClick={() => void prepareSendQuotation()}
        >
          {t("pages.sales.sendQuotation")}
        </button>
        <button
          type="button"
          className={btnToolbar}
          disabled={saving || sendingQuote}
          onClick={() => void save("confirmed").then((sale) => {
            if (sale) {
              clearQuotationDraft();
              router.push("/sales?tab=bookings");
            }
          })}
        >
          {t("pages.sales.confirmOrder")}
        </button>
        <button
          type="button"
          className={btnToolbar}
          disabled={!customer.trim()}
          onClick={openPrint}
        >
          {t("pages.invoices.printPdf")}
        </button>
        <button
          type="button"
          className={btnToolbar}
          disabled={!customer.trim()}
          onClick={openPreview}
        >
          {t("pages.sales.quoteOverview")}
        </button>
        <span className="min-w-2 flex-1" aria-hidden />
        <button
          type="button"
          className={btnToolbarPrimary}
          disabled={saving || sendingQuote}
          onClick={() => void save("pending").then((sale) => {
            if (sale) {
              clearQuotationDraft();
              router.push("/sales?tab=bookings");
            }
          })}
        >
          {t("common.save")}
        </button>
      </OdooFormToolbar>

      <div className="border border-line bg-panel">
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {STAGES.map((stage, index) => (
              <span
                key={stage}
                className={`rounded-sm px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  index === 0 ? "bg-accent text-white" : "bg-ash/60 text-mute"
                }`}
              >
                {stageOdooLabel(stage, t)}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
              {t("pages.sales.customer")}
            </span>
            <ClientSearchInput
              required
              className={inputUnderlineClass}
              value={customer}
              leads={leads}
              placeholder={t("pages.sales.customerPlaceholder")}
              onValueChange={setCustomer}
              onLeadSelect={onLeadSelect}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
              {t("common.email")}
            </span>
            <input
              type="email"
              className={inputUnderlineClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
              {t("pages.sales.quoteTemplate")}
            </span>
            <QuoteTemplateSearchInput
              className={inputUnderlineClass}
              value={quoteTemplateName}
              placeholder={t("pages.sales.pickTemplate")}
              onTemplateSelect={onTemplateSelect}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
              {t("pages.sales.expiration")}
            </span>
            <input
              type="date"
              className={inputUnderlineClass}
              value={validityDate}
              onChange={(e) => setValidityDate(e.target.value)}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
              {t("pages.sales.paymentTerms")}
            </span>
            <select
              className={inputUnderlineClass}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            >
              {PAYMENT_TERMS.map((term) => (
                <option key={term.id} value={term.name}>
                  {getPaymentTermLabel(term, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="border-b border-line px-4">
          <div className="-mb-px flex gap-6">
            {(
              [
                ["lines", t("pages.sales.tabOrderLines")],
                ["other", t("pages.sales.tabOtherInfo")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`border-b-2 pb-2.5 text-sm font-medium ${
                  tab === id
                    ? "border-accent text-ink"
                    : "border-transparent text-mute hover:text-ink"
                }`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "lines" ? (
          <div className="px-4 py-4">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("pages.sales.lineProduct")}</th>
                    <th className="w-24 text-right">{t("pages.sales.lineQty")}</th>
                    <th className="w-32 text-right">{t("pages.sales.lineUnitPrice")}</th>
                    <th className="w-32 text-right">{t("pages.sales.lineAmount")}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) =>
                    line.displayType === "section" ? (
                      <tr key={`line-${index}`} className="bg-ash/40">
                        <td colSpan={4}>
                          <input
                            className={`${inputUnderlineClass} font-semibold`}
                            value={line.description}
                            onChange={(e) =>
                              updateLine(index, { description: e.target.value })
                            }
                            placeholder={t("pages.sales.sectionTitle")}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-xs text-mute hover:text-ink"
                            onClick={() => removeLine(index)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ) : line.displayType === "note" ? (
                      <tr key={`line-${index}`}>
                        <td colSpan={4}>
                          <textarea
                            className={`${inputUnderlineClass} min-h-16 text-sm`}
                            value={line.description}
                            onChange={(e) =>
                              updateLine(index, { description: e.target.value })
                            }
                            placeholder={t("pages.sales.notePlaceholder")}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-xs text-mute hover:text-ink"
                            onClick={() => removeLine(index)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={`line-${index}`}>
                        <td>
                          <ProductSearchInput
                            className={inputUnderlineClass}
                            products={catalogProducts}
                            value={line.description}
                            placeholder={t("pages.sales.pickProduct")}
                            onValueChange={(text) =>
                              updateLine(index, { description: text })
                            }
                            onProductSelect={(product) => onProductPick(index, product)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={`${inputUnderlineClass} text-right`}
                            value={line.qty}
                            onChange={(e) =>
                              updateLine(index, { qty: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={`${inputUnderlineClass} text-right`}
                            value={line.unitPrice}
                            onChange={(e) =>
                              updateLine(index, {
                                unitPrice: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="text-right font-medium tabular-nums">
                          {formatSalesMoney(lineTotal(line), locale)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-xs text-mute hover:text-ink"
                            onClick={() => removeLine(index)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={openCatalogue}>
                {t("pages.sales.addProduct")}
              </button>
              <button type="button" className={btnSecondary} onClick={() => addLine("section")}>
                {t("pages.sales.addSection")}
              </button>
              <button type="button" className={btnSecondary} onClick={() => addLine("note")}>
                {t("pages.sales.addNote")}
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <div className="min-w-[220px] space-y-1 border border-line bg-ash/30 px-4 py-3 text-sm">
                <div className="flex justify-between text-mute">
                  <span>{t("pages.sales.amountUntaxed")}</span>
                  <span>{formatSalesMoney(total, locale)}</span>
                </div>
                <div className="flex justify-between font-semibold text-ink">
                  <span>{t("pages.sales.total")}</span>
                  <span>{formatSalesMoney(total, locale)}</span>
                </div>
              </div>
            </div>

            {termsHtml ? (
              <div
                className="quote-terms mt-6 border-t border-line pt-4 text-xs leading-relaxed text-mute [&_li]:ml-4 [&_p]:mb-2 [&_strong]:text-ink"
                dangerouslySetInnerHTML={{ __html: termsHtml }}
              />
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 px-4 py-4 text-sm">
            <p>
              <span className="text-mute">{t("pages.sales.salesperson")}: </span>
              {salesperson}
            </p>
            <p>
              <span className="text-mute">{t("pages.sales.quoteTemplate")}: </span>
              {quoteTemplateName || "—"}
            </p>
            <p>
              <span className="text-mute">{t("pages.sales.paymentTerms")}: </span>
              {paymentTerms || "—"}
            </p>
          </div>
        )}
      </div>

      <SendQuotationModal
        open={!!sendQuoteSale}
        sale={sendQuoteSale}
        sending={sendingQuote}
        onClose={() => {
          if (sendingQuote) return;
          setSendQuoteSale(null);
        }}
        onSend={(message) => void confirmSendQuotation(message)}
      />
    </>
  );
}
