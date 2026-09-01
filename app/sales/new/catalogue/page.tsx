"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuotationPageShell } from "@/components/sales/quotation-page-shell";
import { btnToolbar, btnToolbarPrimary } from "@/components/modal";
import { OdooFormToolbar } from "@/components/sales/odoo-form-toolbar";
import { useCrm } from "@/lib/crm-store";
import {
  loadQuotationDraft,
  saveQuotationDraft,
  type QuotationDraft,
} from "@/lib/quotation-draft";
import { SalesAmount } from "@/components/sales/sales-amount";
import { useLocale } from "@/lib/i18n";

function CataloguePageInner() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { products } = useCrm();
  const [draft, setDraft] = useState<QuotationDraft | null>(null);

  useEffect(() => {
    const stored = loadQuotationDraft();
    if (!stored) {
      router.replace("/sales/new");
      return;
    }
    setDraft(stored);
  }, [router]);

  function addProduct(name: string, price: number) {
    if (!draft) return;
    const next: QuotationDraft = {
      ...draft,
      lines: [
        ...draft.lines.filter(
          (line) => !(line.displayType === "product" && !line.description.trim()),
        ),
        {
          description: name,
          displayType: "product",
          qty: 1,
          unitPrice: price,
        },
      ],
    };
    saveQuotationDraft(next);
    router.push("/sales/new");
  }

  if (!draft) {
    return (
      <QuotationPageShell title={t("pages.sales.catalogue")}>
        <p className="text-sm text-mute">{t("common.loading")}</p>
      </QuotationPageShell>
    );
  }

  return (
    <QuotationPageShell title={t("pages.sales.catalogue")}>
      <OdooFormToolbar>
        <Link href="/sales/new" className={btnToolbar}>
          {t("common.back")}
        </Link>
      </OdooFormToolbar>

      <div className="border border-line bg-panel">
        <ul className="divide-y divide-line px-4">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium">{product.name}</p>
                <SalesAmount amount={product.listPrice} locale={locale} className="text-xs" />
              </div>
              <button
                type="button"
                className={btnToolbarPrimary}
                onClick={() => addProduct(product.name, product.listPrice)}
              >
                {t("pages.sales.addProduct")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </QuotationPageShell>
  );
}

export default function QuotationCataloguePage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("common.loading")}</p>}>
      <CataloguePageInner />
    </Suspense>
  );
}
