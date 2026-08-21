"use client";

import Link from "next/link";
import { InkamotoLogo } from "@/components/brand";
import { currentUser, currentWorkspace } from "@/lib/session";
import { useT } from "@/lib/i18n";

const nav = [
  { href: "/", key: "nav.overview", icon: OverviewIcon, tour: "overview" },
  { href: "/inbox", key: "nav.inbox", icon: InboxIcon, tour: "inbox" },
  { href: "/leads", key: "nav.leads", icon: LeadsIcon, tour: "leads" },
  { href: "/bookings", key: "nav.sales", icon: SalesIcon, tour: "bookings" },
  { href: "/search-console", key: "nav.searchConsole", icon: SearchConsoleIcon },
  { href: "/invoices", key: "nav.invoices", icon: InvoiceIcon, tour: "invoices" },
  { href: "/newsletter", key: "nav.newsletter", icon: NewsletterIcon, tour: "newsletter" },
  { href: "/setup", key: "nav.setup", icon: SetupIcon, tour: "setup" },
];

export function Sidebar({
  pathname,
  open,
  onClose,
}: {
  pathname: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const visibleNav = nav;

  return (
    <aside
      id="app-nav"
      className={`fixed inset-y-0 left-0 z-[45] flex w-[min(20rem,88vw)] flex-col border-r border-line bg-ash pt-[6px] shadow-xl transition-transform duration-200 ease-out lg:bottom-0 lg:top-[6px] lg:z-40 lg:w-60 lg:translate-x-0 lg:pt-0 lg:shadow-none ${
        open ? "translate-x-0" : "pointer-events-none -translate-x-full lg:pointer-events-auto lg:translate-x-0"
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <InkamotoLogo className="h-7 w-auto" />
          <p className="mt-2 font-display text-sm tracking-[0.14em] text-mute">
            {t("brand.crm")}
          </p>
          <p className="truncate text-xs text-mute">{currentWorkspace.slug}</p>
        </div>
        <button
          type="button"
          aria-label={t("nav.closeMenu")}
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-mute transition-colors hover:bg-panel hover:text-ink lg:hidden"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mx-3 mb-3 border border-line bg-panel px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
          {t("brand.workspace")}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink">
          {currentWorkspace.name}
        </p>
        <p className="text-xs text-mute">
          {currentWorkspace.plan} · {currentWorkspace.region}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {visibleNav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tour}
              suppressHydrationWarning
              className={`flex min-h-11 shrink-0 items-center gap-2.5 px-3 py-2.5 text-sm font-medium uppercase tracking-[0.06em] transition-colors ${
                active
                  ? "bg-accent text-white"
                  : "text-mute hover:bg-panel hover:text-ink"
              }`}
            >
              <Icon active={active} />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center text-xs font-bold text-white"
            style={{ background: currentUser.avatarHue }}
          >
            {currentUser.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {currentUser.name}
            </p>
            <p className="truncate text-xs text-mute">
              {t("common.admin")} · {t("common.online")}
            </p>
          </div>
          <span
            className="ml-auto h-2 w-2 shrink-0 bg-green"
            title={t("common.online")}
          />
        </div>
      </div>
    </aside>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M4 4l10 10M14 4 4 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1.5" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" opacity={active ? 1 : 0.95} />
    </svg>
  );
}

function AnalyticsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 13V8.5M6 13V3.5M10 13V6.5M14 13V5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity={active === false ? 0.85 : 1}
      />
    </svg>
  );
}

function InboxIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 12.5 8 3.5l5 9H3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity={active === false ? 0.85 : 1}
      />
      <path
        d="M6.2 9.5h3.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LeadsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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

function SearchConsoleIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2.5v11M3.5 6.5 8 2.5l4.5 4M3.5 9.5 8 13.5l4.5-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active === false ? 0.85 : 1}
      />
    </svg>
  );
}

function MetaIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 10.5c1.2-3.5 2.8-5.5 4.2-5.5 1.2 0 1.9 1.4 2.8 3.5.9 2.1 1.6 3.5 2.8 3.5 1.4 0 3-2 4.2-5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity={active === false ? 0.85 : 1}
      />
    </svg>
  );
}

function InvoiceIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 1.5h8v13l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1v-13Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity={active === false ? 0.85 : 1}
      />
      <path
        d="M6 5h4M6 8h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NewsletterIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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

function SetupIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="2.2"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={active === false ? 0.85 : 1}
      />
      <path
        d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
