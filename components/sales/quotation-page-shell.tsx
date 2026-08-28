"use client";

import Link from "next/link";
import { SalesSubnav } from "@/components/sales/sales-subnav";
import { useLocale } from "@/lib/i18n";

export function QuotationPageShell({
  title,
  backHref = "/sales?tab=bookings",
  backLabel,
  children,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">
          {t("nav.sales")}
        </h1>
      </div>

      <SalesSubnav />

      <div className="mt-4">
        <div className="mb-3 text-xs text-mute">
          <Link href={backHref} className="hover:text-ink">
            {backLabel ?? t("pages.sales.menuOrders")}
          </Link>
          <span className="mx-1">/</span>
          <Link href="/sales/new" className="hover:text-ink">
            {t("pages.sales.newQuotation")}
          </Link>
          {title !== t("pages.sales.newQuotation") ? (
            <>
              <span className="mx-1">/</span>
              <span className="text-ink">{title}</span>
            </>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
