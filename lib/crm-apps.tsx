import type { ComponentType } from "react";

export type CrmAppId =
  | "overview"
  | "inbox"
  | "leads"
  | "contacts"
  | "sales"
  | "search"
  | "email"
  | "settings";

export type CrmAppMenu = {
  href: string;
  labelKey: string;
  match?: (pathname: string, search: string) => boolean;
};

export type CrmApp = {
  id: CrmAppId;
  href: string;
  labelKey: string;
  tour?: string;
  /** Tile background — Odoo-style solid color */
  color: string;
  menus: CrmAppMenu[];
  Icon: ComponentType<{ className?: string }>;
};

function matchPrefix(prefix: string) {
  return (pathname: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export const CRM_APPS: CrmApp[] = [
  {
    id: "overview",
    href: "/",
    labelKey: "nav.overview",
    tour: "overview",
    color: "#31595d",
    menus: [{ href: "/", labelKey: "nav.overview", match: (p) => p === "/" }],
    Icon: OverviewGlyph,
  },
  {
    id: "inbox",
    href: "/inbox",
    labelKey: "nav.inbox",
    tour: "inbox",
    color: "#4a8a90",
    menus: [
      {
        href: "/inbox",
        labelKey: "nav.inbox",
        match: matchPrefix("/inbox"),
      },
    ],
    Icon: InboxGlyph,
  },
  {
    id: "leads",
    href: "/leads",
    labelKey: "nav.leads",
    tour: "leads",
    color: "#624e8a",
    menus: [
      {
        href: "/leads",
        labelKey: "nav.leads",
        match: matchPrefix("/leads"),
      },
    ],
    Icon: LeadsGlyph,
  },
  {
    id: "contacts",
    href: "/contacts",
    labelKey: "nav.contacts",
    color: "#65814f",
    menus: [
      {
        href: "/contacts",
        labelKey: "nav.contacts",
        match: matchPrefix("/contacts"),
      },
    ],
    Icon: ContactsGlyph,
  },
  {
    id: "sales",
    href: "/sales?tab=bookings",
    labelKey: "nav.sales",
    tour: "sales",
    color: "#9f2627",
    menus: [
      {
        href: "/sales?tab=bookings",
        labelKey: "pages.sales.menuOrders",
        match: (pathname, search) => {
          if (pathname === "/products" || pathname.startsWith("/products/"))
            return false;
          if (
            pathname === "/sales/quote-templates" ||
            pathname.startsWith("/sales/quote-templates/")
          )
            return false;
          if (pathname === "/invoices" || pathname.startsWith("/invoices/"))
            return false;
          if (!(pathname === "/sales" || pathname.startsWith("/sales/")))
            return false;
          const tab = new URLSearchParams(search).get("tab");
          return tab !== "invoices";
        },
      },
      {
        href: "/sales?tab=invoices",
        labelKey: "pages.sales.menuInvoices",
        match: (pathname, search) => {
          if (pathname === "/invoices" || pathname.startsWith("/invoices/"))
            return true;
          if (pathname !== "/sales") return false;
          return new URLSearchParams(search).get("tab") === "invoices";
        },
      },
      {
        href: "/products",
        labelKey: "pages.sales.menuProducts",
        match: matchPrefix("/products"),
      },
      {
        href: "/sales/quote-templates",
        labelKey: "pages.sales.menuQuoteTemplates",
        match: matchPrefix("/sales/quote-templates"),
      },
    ],
    Icon: SalesGlyph,
  },
  {
    id: "search",
    href: "/search-console",
    labelKey: "nav.searchConsole",
    color: "#244246",
    menus: [
      {
        href: "/search-console",
        labelKey: "nav.searchConsole",
        match: (p) =>
          p === "/search-console" ||
          p.startsWith("/search-console/") ||
          p === "/analytics" ||
          p.startsWith("/analytics/"),
      },
    ],
    Icon: SearchGlyph,
  },
  {
    id: "email",
    href: "/email-marketing",
    labelKey: "nav.newsletter",
    tour: "newsletter",
    color: "#c45d57",
    menus: [
      {
        href: "/email-marketing",
        labelKey: "pages.emailMarketing.tabMailings",
        match: matchPrefix("/email-marketing"),
      },
      {
        href: "/newsletter",
        labelKey: "pages.emailMarketing.tabCampaigns",
        match: matchPrefix("/newsletter"),
      },
    ],
    Icon: EmailGlyph,
  },
  {
    id: "settings",
    href: "/settings",
    labelKey: "nav.settings",
    color: "#3a3834",
    menus: [
      {
        href: "/settings",
        labelKey: "nav.settings",
        match: (p) =>
          p === "/settings" ||
          p.startsWith("/settings/") ||
          p === "/setup" ||
          p.startsWith("/setup/"),
      },
    ],
    Icon: SettingsGlyph,
  },
];

export function resolveCrmApp(pathname: string): CrmApp {
  if (pathname === "/") return CRM_APPS[0]!;
  if (pathname.startsWith("/inbox")) return CRM_APPS.find((a) => a.id === "inbox")!;
  if (pathname.startsWith("/leads") || pathname.startsWith("/follow-ups"))
    return CRM_APPS.find((a) => a.id === "leads")!;
  if (pathname.startsWith("/contacts"))
    return CRM_APPS.find((a) => a.id === "contacts")!;
  if (
    pathname.startsWith("/sales") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/bookings") ||
    pathname.startsWith("/invoices")
  )
    return CRM_APPS.find((a) => a.id === "sales")!;
  if (pathname.startsWith("/search-console") || pathname.startsWith("/analytics"))
    return CRM_APPS.find((a) => a.id === "search")!;
  if (
    pathname.startsWith("/email-marketing") ||
    pathname.startsWith("/newsletter")
  )
    return CRM_APPS.find((a) => a.id === "email")!;
  if (pathname.startsWith("/settings") || pathname.startsWith("/setup"))
    return CRM_APPS.find((a) => a.id === "settings")!;
  return CRM_APPS[0]!;
}

function OverviewGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function InboxGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 7h18v12H3z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m3 9 9 6 9-6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function LeadsGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19c1.5-3.2 4-4.8 7-4.8S17.5 15.8 19 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ContactsGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 19c1.2-2.6 3-4 5.5-4s4.3 1.4 5.5 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13 19c.8-1.8 2-2.7 3.8-2.7 1.7 0 3 1 3.7 2.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SalesGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V9M9 19V5M14 19v-7M19 19V8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EmailGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m3 7 9 7 9-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
