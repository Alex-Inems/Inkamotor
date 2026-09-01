"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/i18n";

export type SalesTab = "bookings" | "invoices" | "products" | "quoteTemplates";

export function SalesSubnav() {
  const { t } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const active: SalesTab =
    pathname === "/products"
      ? "products"
      : pathname === "/sales/quote-templates"
        ? "quoteTemplates"
        : tabParam === "invoices"
          ? "invoices"
          : "bookings";

  const items: { id: SalesTab; href: string; label: string }[] = [
    { id: "bookings", href: "/sales?tab=bookings", label: t("pages.sales.menuOrders") },
    { id: "invoices", href: "/sales?tab=invoices", label: t("pages.sales.menuInvoices") },
    { id: "products", href: "/products", label: t("pages.sales.menuProducts") },
    {
      id: "quoteTemplates",
      href: "/sales/quote-templates",
      label: t("pages.sales.menuQuoteTemplates"),
    },
  ];

  return (
    <nav
      aria-label={t("pages.sales.salesMenu")}
      className="-mb-px flex gap-6 border-b border-line"
    >
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`border-b-2 pb-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-accent text-ink"
                : "border-transparent text-mute hover:border-line hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
