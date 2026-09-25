"use client";

import Link from "next/link";
import { useInboxNotifications } from "@/lib/inbox-notifications";
import { useT } from "@/lib/i18n";

const nav = [
  { href: "/", key: "nav.overview", icon: OverviewIcon, tour: "overview" },
  { href: "/inbox", key: "nav.inbox", icon: InboxIcon, tour: "inbox" },
  { href: "/leads", key: "nav.leads", icon: LeadsIcon, tour: "leads" },
  { href: "/contacts", key: "nav.contacts", icon: ContactsIcon },
  { href: "/sales", key: "nav.sales", icon: SalesIcon, tour: "sales" },
  { href: "/search-console", key: "nav.searchConsole", icon: SearchConsoleIcon },
  {
    href: "/email-marketing",
    key: "nav.newsletter",
    icon: NewsletterIcon,
    tour: "newsletter",
  },
  { href: "/settings", key: "nav.settings", icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/email-marketing") {
    return (
      pathname === "/email-marketing" ||
      pathname.startsWith("/email-marketing/") ||
      pathname === "/newsletter" ||
      pathname.startsWith("/newsletter/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavLinks({
  pathname,
  onNavigate,
  layout = "horizontal",
  navId,
}: {
  pathname: string;
  onNavigate?: () => void;
  layout?: "horizontal" | "stack";
  navId?: string;
}) {
  const t = useT();
  const { unread } = useInboxNotifications();
  const stack = layout === "stack";
  const items = nav;

  return (
    <nav
      id={navId}
      aria-label={t("brand.crm")}
      className={
        stack
          ? "flex flex-col gap-1 p-3"
          : "flex min-w-0 items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={item.tour}
            suppressHydrationWarning
            onClick={onNavigate}
            className={
              stack
                ? `group relative flex min-h-12 items-center gap-3 px-3.5 text-[15px] font-semibold tracking-[0.02em] transition-colors ${
                    active
                      ? "bg-accent text-white"
                      : "text-mute hover:bg-panel hover:text-ink"
                  }`
                : `group relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-[14px] font-semibold tracking-[0.02em] transition-colors xl:gap-2.5 xl:px-3.5 xl:text-[15px] ${
                    active
                      ? "text-ink"
                      : "text-mute hover:text-ink"
                  }`
            }
          >
            <span className={stack ? "" : "inline-flex"}>
              <Icon active={active} />
            </span>
            <span className="whitespace-nowrap">{t(item.key)}</span>
            {item.href === "/inbox" && unread > 0 ? (
              <span
                className={`flex h-5 min-w-5 items-center justify-center px-1.5 text-[11px] font-bold leading-none text-white ${
                  stack && active ? "bg-pink/90" : "bg-pink"
                }`}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
            {!stack ? (
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-x-2.5 bottom-0 h-[2.5px] origin-left transition-transform duration-200 ${
                  active
                    ? "scale-x-100 bg-gold"
                    : "scale-x-0 bg-sand/70 group-hover:scale-x-100"
                }`}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** @deprecated Prefer AppNavLinks — kept for any residual imports. */
export function Sidebar({
  pathname,
  open,
  onClose,
}: {
  pathname: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="border-t border-line bg-ash lg:hidden">
      <AppNavLinks pathname={pathname} onNavigate={onClose} layout="stack" />
    </div>
  );
}

function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1.5" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
      <rect
        x="9"
        y="9"
        width="5.5"
        height="5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={active ? 1 : 0.95}
      />
    </svg>
  );
}

function InboxIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 4.5h12v8H2z"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={active === false ? 0.85 : 1}
      />
      <path
        d="M2 6.5 8 10l6-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SalesIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="3.2"
        width="12"
        height="11"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={active === false ? 0.85 : 1}
      />
      <path
        d="M2 6.5h12M5.2 1.8v2.6M10.8 1.8v2.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LeadsIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 13.5c1.2-2.4 3-3.5 5.5-3.5s4.3 1.1 5.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity={active ? 1 : 0.9}
      />
    </svg>
  );
}

function ContactsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5.5" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <circle
        cx="10.5"
        cy="5"
        r="2.2"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={active === false ? 0.85 : 1}
      />
      <path
        d="M1.8 13c.9-2 2.3-3 3.7-3s2.8 1 3.7 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M7 13c.7-1.6 1.8-2.4 3.5-2.4S13.3 11.4 14 13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity={active === false ? 0.85 : 1}
      />
    </svg>
  );
}

function SearchConsoleIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle
        cx="7"
        cy="7"
        r="4.2"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={active === false ? 0.85 : 1}
      />
      <path
        d="M10.2 10.2 14 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NewsletterIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="3"
        width="13"
        height="10"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={active === false ? 0.85 : 1}
      />
      <path
        d="m1.5 4.5 6.5 4.5 6.5-4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="2.2"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={active === false ? 0.85 : 1}
      />
      <path
        d="M8 1.5v1.4M8 13.1V14.5M1.5 8h1.4M13.1 8H14.5M3.2 3.2l1 1M11.8 11.8l1 1M12.8 3.2l-1 1M4.2 11.8l-1 1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity={active === false ? 0.85 : 1}
      />
    </svg>
  );
}
