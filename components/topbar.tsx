"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserAvatar } from "@/components/user-avatar";
import { LanguageSwitcher, localeMeta, useLocale, type Locale } from "@/lib/i18n";
import { resolveCrmApp } from "@/lib/crm-apps";
import { useCrm } from "@/lib/crm-store";
import { useInboxNotifications } from "@/lib/inbox-notifications";
import { useWorkspaceNotices } from "@/lib/workspace-notices";
import { useSessionUser } from "@/lib/session-user";
import { currentWorkspace, formatLastLogin } from "@/lib/session";
import { startTour } from "@/lib/onboarding";

export function Topbar({
  menuOpen,
  onMenu,
}: {
  title?: string;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { pushToast } = useCrm();
  const { t, locale } = useLocale();
  const currentUser = useSessionUser();
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { unread, items: notifications, dismissAll } = useInboxNotifications();
  const { items: workspaceNotices, dismissAll: dismissWorkspace } =
    useWorkspaceNotices();
  const bellCount = unread + workspaceNotices.length;
  const app = resolveCrmApp(pathname);
  const AppIcon = app.Icon;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (userRef.current && !userRef.current.contains(target)) {
        setUserOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header className="crm-topbar sticky top-[6px] z-30 border-b border-line bg-ash text-ink shadow-[0_8px_24px_-18px_rgba(0,0,0,0.8)]">
        <div className="flex h-12 items-stretch gap-0.5 pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:gap-1 sm:pl-2 sm:pr-3">
          <button
            type="button"
            aria-label={t("apps.openApps")}
            aria-expanded={menuOpen}
            onClick={onMenu}
            className="flex h-12 w-11 shrink-0 items-center justify-center text-mute transition-colors hover:bg-panel hover:text-ink"
          >
            <AppsGridIcon />
          </button>

          <button
            type="button"
            onClick={onMenu}
            className="flex shrink-0 items-center gap-2 px-2 text-[15px] font-semibold text-ink transition-colors hover:bg-panel"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-white"
              style={{ background: app.color }}
            >
              <AppIcon className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">{t(app.labelKey)}</span>
            <ChevronDown className="text-mute" />
          </button>

          <nav
            aria-label={t(app.labelKey)}
            className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {app.menus.map((item) => {
              const active = item.match
                ? item.match(pathname, search)
                : pathname === item.href;
              return (
                <Link
                  key={item.href + item.labelKey}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center px-3 text-[14px] font-medium whitespace-nowrap transition-colors sm:px-3.5 sm:text-[15px] ${
                    active
                      ? "bg-panel text-ink"
                      : "text-mute hover:bg-panel/80 hover:text-ink"
                  }`}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                aria-label={t("topbar.notifications")}
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setUserOpen(false);
                }}
                className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                  notifOpen
                    ? "bg-panel text-ink"
                    : bellCount > 0
                      ? "text-gold hover:bg-panel"
                      : "text-mute hover:bg-panel hover:text-ink"
                }`}
              >
                <BellIcon />
                {bellCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold leading-none text-white">
                    {bellCount > 9 ? "9+" : bellCount}
                  </span>
                ) : null}
              </button>

              {notifOpen ? (
                <div className="absolute right-0 top-full z-40 mt-2 w-[min(calc(100vw-1.5rem),24rem)] overflow-hidden rounded-2xl border border-line bg-panel text-ink shadow-xl">
                  <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="font-display text-lg tracking-wide text-ink">
                        {t("topbar.notifications")}
                      </p>
                      <p className="mt-0.5 text-xs text-mute">
                        {t("topbar.emptyNotificationsHint")}
                      </p>
                    </div>
                    {notifications.length + workspaceNotices.length > 0 ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-full pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sand hover:text-gold"
                        onClick={() => {
                          dismissAll();
                          dismissWorkspace();
                        }}
                      >
                        {t("topbar.markAllRead")}
                      </button>
                    ) : null}
                  </div>
                  {notifications.length + workspaceNotices.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-10 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-ash text-sand">
                        <InboxEmptyGlyph />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-ink">
                        {t("topbar.emptyNotifications")}
                      </p>
                      <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-mute">
                        {t("topbar.emptyNotificationsHint")}
                      </p>
                    </div>
                  ) : (
                    <ul className="max-h-[min(24rem,60vh)] overflow-y-auto">
                      {[
                        ...workspaceNotices.map((n) => ({
                          type: "workspace" as const,
                          at: n.at,
                          notice: n,
                        })),
                        ...notifications.map((n) => ({
                          type: "inbox" as const,
                          at: n.receivedAt,
                          item: n,
                        })),
                      ]
                        .sort(
                          (a, b) =>
                            new Date(b.at).getTime() - new Date(a.at).getTime(),
                        )
                        .map((row) =>
                          row.type === "workspace" ? (
                            <li
                              key={row.notice.id}
                              className="border-b border-line last:border-b-0"
                            >
                              <Link
                                href={row.notice.href}
                                onClick={() => setNotifOpen(false)}
                                className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-ash"
                              >
                                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-ash text-[10px] font-bold uppercase tracking-wide text-gold">
                                  NL
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gold">
                                      {t("topbar.newsletterSend")}
                                    </p>
                                    <p className="shrink-0 text-[11px] text-gold">
                                      {formatNotifTime(row.notice.at, locale)}
                                    </p>
                                  </div>
                                  <p className="mt-0.5 truncate text-sm font-semibold text-ink">
                                    {row.notice.title}
                                  </p>
                                  {row.notice.body ? (
                                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-mute">
                                      {row.notice.body}
                                    </p>
                                  ) : null}
                                </div>
                              </Link>
                            </li>
                          ) : (
                            <li
                              key={row.item.id}
                              className="border-b border-line last:border-b-0"
                            >
                              <Link
                                href={`/inbox?chat=${encodeURIComponent(row.item.fromEmail)}`}
                                onClick={() => setNotifOpen(false)}
                                className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-ash"
                              >
                                <SenderMark
                                  name={row.item.fromName || row.item.fromEmail}
                                  email={row.item.fromEmail}
                                />
                                <div className="min-w-0 flex-1">
                                  {row.item.kind === "form" ? (
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gold">
                                      {t("topbar.websiteForm")}
                                    </p>
                                  ) : null}
                                  <div className="flex items-baseline justify-between gap-3">
                                    <p className="truncate text-sm font-semibold text-ink">
                                      {row.item.fromName || row.item.fromEmail}
                                    </p>
                                    <p className="shrink-0 text-[11px] text-gold">
                                      {formatNotifTime(
                                        row.item.receivedAt,
                                        locale,
                                      )}
                                    </p>
                                  </div>
                                  <p className="mt-0.5 truncate text-sm text-ink/90">
                                    {row.item.subject ||
                                      t("pages.inbox.messages")}
                                  </p>
                                  {row.item.preview ? (
                                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-mute">
                                      {row.item.preview}
                                    </p>
                                  ) : null}
                                </div>
                              </Link>
                            </li>
                          ),
                        )}
                    </ul>
                  )}
                  <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
                    <Link
                      href="/inbox"
                      onClick={() => setNotifOpen(false)}
                      className="flex min-h-10 items-center justify-center rounded-full bg-accent text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-accent-deep"
                    >
                      {t("topbar.openInbox")}
                    </Link>
                    <Link
                      href="/email-marketing"
                      onClick={() => setNotifOpen(false)}
                      className="flex min-h-10 items-center justify-center rounded-full border border-line bg-panel text-xs font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ash"
                    >
                      {t("topbar.openNewsletter")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <span className="hidden max-w-[9rem] truncate px-2 text-[13px] font-medium text-mute xl:inline">
              {currentWorkspace.name}
            </span>

            <LanguageSwitcher />

            <div className="relative" ref={userRef}>
              <button
                type="button"
                aria-expanded={userOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setUserOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="flex h-11 items-center gap-2.5 rounded-full border border-line bg-panel py-1 pl-1 pr-2.5 transition-colors hover:border-sand hover:bg-ash"
              >
                <UserAvatar
                  user={currentUser}
                  className="h-9 w-9 shrink-0 text-xs ring-2 ring-line"
                />
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block max-w-[8rem] truncate text-[13px] font-semibold leading-tight text-ink">
                    {currentUser.name}
                  </span>
                  <span className="block text-[10px] leading-tight text-mute">
                    {t("common.admin")}
                  </span>
                </span>
                <ChevronDown className="text-mute" />
              </button>

              {userOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-2 w-[min(calc(100vw-1.5rem),18rem)] overflow-hidden rounded-2xl border border-line bg-panel text-ink shadow-xl"
                >
                  <div className="border-b border-line px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        user={currentUser}
                        className="h-12 w-12 shrink-0 text-sm ring-2 ring-line"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">
                          {currentUser.name}
                        </p>
                        <p className="truncate text-xs text-mute">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-ash px-2.5 py-2">
                        <p className="text-mute">{t("topbar.role")}</p>
                        <p className="font-semibold text-ink">
                          {t("common.admin")}
                        </p>
                      </div>
                      <div className="bg-ash px-2.5 py-2">
                        <p className="text-mute">{t("topbar.title")}</p>
                        <p className="font-semibold text-ink">
                          {t("session.titleOps")}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-mute">
                      {t("topbar.lastLogin", {
                        time: formatLastLogin(currentUser.lastLoginAt, locale),
                      })}
                    </p>
                  </div>

                  <div className="py-1">
                    <MenuItem
                      label={t("tour.replay")}
                      onClick={() => {
                        setUserOpen(false);
                        startTour();
                      }}
                    />
                    <MenuItem
                      label={t("topbar.accountSettings")}
                      onClick={() => {
                        setUserOpen(false);
                        router.push("/settings");
                      }}
                    />
                    <MenuItem
                      label={t("topbar.workspacePrefs")}
                      onClick={() => {
                        setUserOpen(false);
                        router.push("/settings");
                      }}
                    />
                    <MenuItem
                      label={t("topbar.billing")}
                      onClick={() => {
                        setUserOpen(false);
                        router.push("/settings");
                        pushToast(
                          t("topbar.manageBilling", {
                            plan: currentWorkspace.plan,
                          }),
                        );
                      }}
                    />
                  </div>

                  <div className="border-t border-line py-1">
                    <MenuItem
                      label={t("topbar.signOut")}
                      danger
                      onClick={() => {
                        setUserOpen(false);
                        void (async () => {
                          await fetch("/api/auth/logout", { method: "POST" });
                          window.location.href = "/login";
                        })();
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
  );
}

const SENDER_HUES = [
  "#31595d",
  "#624e8a",
  "#9f2627",
  "#65814f",
  "#c45d57",
  "#244246",
];

function senderHue(email: string) {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SENDER_HUES[hash % SENDER_HUES.length]!;
}

function senderInitials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function SenderMark({ name, email }: { name: string; email: string }) {
  return (
    <span
      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ background: senderHue(email) }}
      aria-hidden
    >
      {senderInitials(name, email)}
    </span>
  );
}

function InboxEmptyGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4.5h12v8H2z" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2 6.5 8 10l6-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatNotifTime(iso: string, locale: Locale) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const now = Date.now();
  const diff = Math.max(0, now - at.getTime());
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Intl.DateTimeFormat(localeMeta[locale].bcp47, {
    day: "numeric",
    month: "short",
  }).format(at);
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-ash ${
        danger ? "font-semibold text-pink" : "text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function AppsGridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="1" y="1" width="4" height="4" fill="currentColor" />
      <rect x="7" y="1" width="4" height="4" fill="currentColor" />
      <rect x="13" y="1" width="4" height="4" fill="currentColor" />
      <rect x="1" y="7" width="4" height="4" fill="currentColor" />
      <rect x="7" y="7" width="4" height="4" fill="currentColor" />
      <rect x="13" y="7" width="4" height="4" fill="currentColor" />
      <rect x="1" y="13" width="4" height="4" fill="currentColor" />
      <rect x="7" y="13" width="4" height="4" fill="currentColor" />
      <rect x="13" y="13" width="4" height="4" fill="currentColor" />
    </svg>
  );
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.75a3.5 3.5 0 0 0-3.5 3.5v1.6c0 .5-.16.98-.46 1.38L3.2 9.4A1 1 0 0 0 4 11h8a1 1 0 0 0 .8-1.6l-.84-1.17a2.3 2.3 0 0 1-.46-1.38V5.25A3.5 3.5 0 0 0 8 1.75Z"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M6.5 11.5a1.5 1.5 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
