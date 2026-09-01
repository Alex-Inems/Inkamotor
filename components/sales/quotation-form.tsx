"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { btnToolbar, btnToolbarPrimary, inputUnderlineClass } from "@/components/modal";
import { ClientSearchInput } from "@/components/sales/client-search-input";
import { QuoteTemplateSearchInput } from "@/components/sales/quote-template-search-input";
import { QuotationLinesEditor } from "@/components/sales/quotation-lines-editor";
import { QuotationOtherInfoTab } from "@/components/sales/quotation-other-info-tab";
import { SendQuotationModal } from "@/components/sales/send-quotation-modal";
import { OdooFormToolbar } from "@/components/sales/odoo-form-toolbar";
import { useCrm } from "@/lib/crm-store";
import { type Sale, type SaleLine, type SaleStatus } from "@/lib/demo-data";
import {
  defaultQuotationOtherInfo,
  defaultValidityDate,
  emptyQuotationLine,
  getPaymentTermLabel,
  linesTotal,
  PAYMENT_TERMS,
  primaryProductLabel,
  type OdooQuoteTemplate,
  type QuotationOtherInfo,
} from "@/lib/quotation-form-data";
import { applyLocalizedTemplateToQuotationLines } from "@/lib/quote-template-lines";
import { buildQuotationLines, parseStoredQuotationLines } from "@/lib/quote-templates";
import { useQuoteTemplates } from "@/lib/quote-templates-store";
import { getTemplateNoteHtml } from "@/lib/quote-template-terms";
import {
  clearQuotationDraft,
  loadQuotationDraft,
  saveQuotationDraft,
} from "@/lib/quotation-draft";
import { SalesAmount } from "@/components/sales/sales-amount";
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
  const { templates, ready: templatesReady } = useQuoteTemplates();
  const defaultTemplate = templates[0] ?? null;
  const [tab, setTab] = useState<Tab>("lines");
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");
  const [quoteTemplateName, setQuoteTemplateName] = useState("");
  const [validityDate, setValidityDate] = useState(() => defaultValidityDate(10));
  const [paymentTerms, setPaymentTerms] = useState(PAYMENT_TERMS[1]?.name ?? "");
  const [trip, setTrip] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([emptyQuotationLine()]);
  const [otherInfo, setOtherInfo] = useState<QuotationOtherInfo>(() =>
    defaultQuotationOtherInfo(null, t),
  );
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendQuoteSale, setSendQuoteSale] = useState<Sale | null>(null);
  const [sendingQuote, setSendingQuote] = useState(false);
  const prevLocale = useRef<string | null>(null);

  useEffect(() => {
    if (!templatesReady) return;
    const draft = loadQuotationDraft();
    if (draft) {
      setCustomer(draft.customer);
      setEmail(draft.email);
      setQuoteTemplateName(draft.quoteTemplateName);
      setValidityDate(draft.validityDate);
      setPaymentTerms(draft.paymentTerms);
      if (draft.trip != null || draft.voyage != null) {
        setTrip(draft.trip ?? draft.voyage ?? "");
        setLines(draft.lines.length > 0 ? draft.lines : [emptyQuotationLine()]);
      } else {
        const parsed = parseStoredQuotationLines(draft.lines);
        setTrip(parsed.trip);
        setLines(parsed.bodyLines.length > 0 ? parsed.bodyLines : [emptyQuotationLine()]);
      }
      if (draft.otherInfo) setOtherInfo(draft.otherInfo);
      setDraftHydrated(true);
      return;
    }

    const tpl = defaultTemplate;
    if (!tpl) {
      setDraftHydrated(true);
      return;
    }
    setQuoteTemplateName(tpl.name);
    setValidityDate(defaultValidityDate(tpl.numberOfDays));
    setOtherInfo(defaultQuotationOtherInfo(tpl, t));
    setTrip("");
    setLines(applyLocalizedTemplateToQuotationLines([], tpl, locale));
    setDraftHydrated(true);
  }, [templatesReady, defaultTemplate, t, locale]);

  const template = useMemo(
    () => templates.find((row) => row.name === quoteTemplateName) ?? defaultTemplate,
    [templates, quoteTemplateName, defaultTemplate],
  );

  useEffect(() => {
    if (!draftHydrated || !template) return;
    if (prevLocale.current === null) {
      prevLocale.current = locale;
      return;
    }
    if (prevLocale.current === locale) return;
    prevLocale.current = locale;
    setLines((prev) => applyLocalizedTemplateToQuotationLines(prev, template, locale));
  }, [locale, template, draftHydrated]);

  const termsHtml = useMemo(() => {
    const primary = getTemplateNoteHtml(template, locale);
    if (primary.trim()) return primary;
    const fallbackTemplate = templates.find((row) =>
      getTemplateNoteHtml(row, locale).trim(),
    );
    return fallbackTemplate ? getTemplateNoteHtml(fallbackTemplate, locale) : "";
  }, [template, templates, locale]);

  const total = linesTotal(lines);

  function onTemplateSelect(tpl: OdooQuoteTemplate) {
    setQuoteTemplateName(tpl.name);
    setValidityDate(defaultValidityDate(tpl.numberOfDays));
    setOtherInfo((prev) => ({
      ...prev,
      onlineSignature: tpl.requireSignature,
      onlinePayment: tpl.requirePayment,
    }));
    setLines((prev) => applyLocalizedTemplateToQuotationLines(prev, tpl, locale));
  }
  function persistDraft() {
    saveQuotationDraft({
      customer,
      email,
      quoteTemplateName,
      validityDate,
      paymentTerms,
      trip,
      voyage: trip,
      lines,
      otherInfo,
    });
  }

  const saleLines = useMemo(
    () => buildQuotationLines(trip, lines, t("pages.sales.voyage")),
    [trip, lines, t],
  );

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

  function onLeadSelect(lead: { name: string; email: string; company: string }) {
    const label =
      lead.name.trim() || lead.company.trim() || lead.email.trim();
    setCustomer(label);
    if (lead.email) setEmail(lead.email);
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
        product: primaryProductLabel(saleLines),
        amount: total,
        currency: "EUR",
        source: "website",
        inquiryId: null,
        leadId: null,
        notes: t("pages.sales.createdInCrm"),
        lines: saleLines,
        quoteTemplateName,
        paymentTerms,
        validityDate,
        termsHtml,
        salesperson: otherInfo.seller,
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
      router.push(`/sales/${sendQuoteSale.id}`);
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
              templates={templates}
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
            {!draftHydrated || !templatesReady ? (
              <p className="text-sm text-mute">{t("common.loading")}</p>
            ) : (
              <>
                <label className="mb-4 grid grid-cols-1 gap-2 border border-line bg-ash/40 px-3 py-3 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)] sm:items-center sm:gap-4">
                  <span className="text-sm font-semibold text-ink">
                    {t("pages.sales.tripName")}
                  </span>
                  <input
                    className={inputUnderlineClass}
                    value={trip}
                    onChange={(e) => setTrip(e.target.value)}
                    placeholder={t("pages.sales.tripNamePlaceholder")}
                  />
                </label>
                <QuotationLinesEditor
                  lines={lines}
                  products={products}
                  onChange={setLines}
                  onOpenCatalogue={openCatalogue}
                  termsHtml={termsHtml}
                />
              </>
            )}

            <div className="mt-6 flex justify-end">
              <div className="min-w-[220px] space-y-1 border border-line bg-ash/30 px-4 py-3 text-sm">
                <div className="flex justify-between text-mute">
                  <span>{t("pages.sales.amountUntaxed")}</span>
                  <SalesAmount amount={total} locale={locale} className="text-right" />
                </div>
                <div className="flex justify-between font-semibold text-ink">
                  <span>{t("pages.sales.total")}</span>
                  <SalesAmount amount={total} locale={locale} size="md" className="text-right" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <QuotationOtherInfoTab
            value={otherInfo}
            onChange={(patch) => setOtherInfo((prev) => ({ ...prev, ...patch }))}
          />
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
