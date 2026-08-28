"use client";

import { Suspense, useState } from "react";
import { ProductsPanel } from "@/components/products/products-panel";
import { SalesSubnav } from "@/components/sales/sales-subnav";
import { useLocale } from "@/lib/i18n";

function ProductsPageInner() {
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
        <ProductsPanel openAdd={openAdd} onOpenAddChange={setOpenAdd} />
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("common.loading")}</p>}>
      <ProductsPageInner />
    </Suspense>
  );
}
