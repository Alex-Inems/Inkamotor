"use client";

import { Suspense } from "react";
import { QuotationForm } from "@/components/sales/quotation-form";
import { QuotationPageShell } from "@/components/sales/quotation-page-shell";
import { useLocale } from "@/lib/i18n";

function NewQuotationPageInner() {
  const { t } = useLocale();

  return (
    <QuotationPageShell title={t("pages.sales.newQuotation")}>
      <QuotationForm />
    </QuotationPageShell>
  );
}

export default function NewQuotationPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("common.loading")}</p>}>
      <NewQuotationPageInner />
    </Suspense>
  );
}
