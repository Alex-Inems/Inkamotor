"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OrdersPanel } from "@/components/sales/orders-panel";
import { InvoicesPanel } from "@/components/sales/invoices-panel";
import { SalesSubnav } from "@/components/sales/sales-subnav";
import { useLocale } from "@/lib/i18n";

function SalesPageInner() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "invoices" ? "invoices" : "bookings";
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
        {tab === "invoices" ? (
          <InvoicesPanel openAdd={openAdd} onOpenAddChange={setOpenAdd} />
        ) : (
          <OrdersPanel />
        )}
      </div>
    </div>
  );
}

export default function SalesPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("common.loading")}</p>}>
      <SalesPageInner />
    </Suspense>
  );
}
