"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n";

export function EmailMarketingSubnav() {
  const { t } = useLocale();
  const pathname = usePathname();

  const items = [
    {
      href: "/email-marketing",
      label: t("pages.emailMarketing.tabMailings"),
      active: pathname === "/email-marketing" || pathname.startsWith("/email-marketing/"),
    },
    {
      href: "/newsletter",
      label: t("pages.emailMarketing.tabCampaigns"),
      active: pathname === "/newsletter",
    },
  ];

  return (
    <nav
      aria-label={t("pages.emailMarketing.title")}
      className="-mb-px flex gap-6 border-b border-line"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`border-b-2 pb-2.5 text-sm font-medium transition-colors ${
            item.active
              ? "border-accent text-ink"
              : "border-transparent text-mute hover:border-line hover:text-ink"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
