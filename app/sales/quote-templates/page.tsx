"use client";

import { Suspense, useState } from "react";
import { QuoteTemplatesPanel } from "@/components/quote-templates/quote-templates-panel";
import { SalesSubnav } from "@/components/sales/sales-subnav";
import { useLocale } from "@/lib/i18n";

function QuoteTemplatesPageInner() {
  const { t } = useLocale();
  const [openAdd, setOpenAdd] = useState(false);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">
          {t("nav.sales")}
        </h1>
      </div>

      <SalesSubnav />

      <div className="mt-4">
        <QuoteTemplatesPanel openAdd={openAdd} onOpenAddChange={setOpenAdd} />
      </div>
    </div>
  );
}

export default function QuoteTemplatesPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("common.loading")}</p>}>
      <QuoteTemplatesPageInner />
    </Suspense>
  );
}
