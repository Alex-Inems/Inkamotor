"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QuoteDocument } from "@/components/quote-document";
import { QuotationPageShell } from "@/components/sales/quotation-page-shell";
import { btnToolbar, btnToolbarPrimary } from "@/components/modal";
import { OdooFormToolbar } from "@/components/sales/odoo-form-toolbar";
import { useCrm } from "@/lib/crm-store";
import { loadQuotationDraft } from "@/lib/quotation-draft";
import { getTemplateNoteHtml } from "@/lib/quote-template-terms";
import { enrichSale } from "@/lib/sale-quote";
import { primaryProductLabel, linesTotal, QUOTE_TEMPLATES } from "@/lib/quotation-form-data";
import { useLocale } from "@/lib/i18n";

function PreviewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const { pushToast } = useCrm();
  const [draft, setDraft] = useState<ReturnType<typeof loadQuotationDraft>>(null);
  const autoPrint = searchParams.get("print") === "1";

  useEffect(() => {
    const stored = loadQuotationDraft();
    if (!stored) {
      router.replace("/sales/new");
      return;
    }
    setDraft(stored);
  }, [router]);

  useEffect(() => {
    if (!draft || !autoPrint) return;
    const id = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(id);
  }, [draft, autoPrint]);

  const template = useMemo(
    () => QUOTE_TEMPLATES.find((row) => row.name === draft?.quoteTemplateName) ?? null,
    [draft?.quoteTemplateName],
  );

  if (!draft) {
    return (
      <QuotationPageShell title={t("pages.sales.previewQuote")}>
        <p className="text-sm text-mute">{t("common.loading")}</p>
      </QuotationPageShell>
    );
  }

  const total = linesTotal(draft.lines);
  const sale = enrichSale({
    id: "draft",
    number: t("pages.sales.newQuotation"),
    customer: draft.customer || "—",
    email: draft.email || "—",
    product: primaryProductLabel(draft.lines),
    amount: total,
    currency: "EUR",
    status: "pending",
    source: "website",
    inquiryId: null,
    leadId: null,
    createdAt: new Date().toISOString().slice(0, 10),
    closedAt: null,
    notes: "",
    lines: draft.lines,
    quoteTemplateName: draft.quoteTemplateName,
    paymentTerms: draft.paymentTerms,
    validityDate: draft.validityDate,
    termsHtml: getTemplateNoteHtml(template, locale),
    salesperson: t("pages.sales.defaultSalesperson"),
    invoiceId: null,
  });

  return (
    <QuotationPageShell title={t("pages.sales.previewQuote")}>
      <OdooFormToolbar>
        <Link href="/sales/new" className={btnToolbar}>
          {t("common.back")}
        </Link>
        <button
          type="button"
          className={btnToolbarPrimary}
          onClick={() => {
            void import("@/lib/quote-pdf").then(({ downloadQuotePdf }) =>
              downloadQuotePdf(sale, locale).catch((err) =>
                pushToast(
                  err instanceof Error ? err.message : t("pages.sales.quotePdfFailed"),
                ),
              ),
            );
          }}
        >
          {t("pages.sales.downloadQuote")}
        </button>
        <button type="button" className={btnToolbar} onClick={() => window.print()}>
          {t("pages.invoices.printPdf")}
        </button>
      </OdooFormToolbar>

      <div className="border border-line bg-panel">
        <div className="p-4">
          <QuoteDocument sale={sale} locale={locale} />
        </div>
      </div>
    </QuotationPageShell>
  );
}

export default function QuotationPreviewPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("common.loading")}</p>}>
      <PreviewPageInner />
    </Suspense>
  );
}
