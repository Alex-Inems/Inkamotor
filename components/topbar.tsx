"use client";

import { useEffect, useRef, useState } from "react";
import { InkamotoLogo } from "@/components/brand";
import { LanguageSwitcher, useT } from "@/lib/i18n";
import { useCrm } from "@/lib/crm-store";
import {
  currentUser,
  currentWorkspace,
  formatLastLogin,
  notifications as seedNotifications,
} from "@/lib/session";

export function Topbar({
  title,
  menuOpen,
  onMenu,
}: {
  title?: string;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const { pushToast } = useCrm();
  const t = useT();
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(seedNotifications);
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => n.unread).length;

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
    <header className="crm-topbar sticky top-[6px] z-30 border-b border-line bg-panel/95 backdrop-blur-sm">
      <div className="flex min-h-14 items-center justify-between gap-2 px-3 py-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:gap-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={menuOpen}
            aria-controls="app-nav"
            onClick={onMenu}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-pink transition-colors hover:bg-ash hover:text-ink lg:hidden"
          >
            <MenuIcon />
          </button>
          <InkamotoLogo className="h-6 w-auto lg:hidden" />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold text-ink">
              {title ?? currentWorkspace.name}
            </p>
            <p className="truncate text-xs text-mute">
              {currentWorkspace.slug} · {currentWorkspace.plan} {t("common.plan")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          <div className="relative hidden md:block">
            <input
              type="search"
              placeholder={t("topbar.search")}
              className="w-44 border border-line bg-ash py-2 pl-3 pr-3 text-sm outline-none transition-colors placeholder:text-mute/70 focus:border-gold md:w-56 lg:w-72"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  pushToast(t("topbar.searchReady"));
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              aria-label={t("topbar.notifications")}
              aria-expanded={notifOpen}
              onClick={() => {
                setNotifOpen((v) => !v);
                setUserOpen(false);
              }}
              className="relative flex h-11 w-11 items-center justify-center border border-transparent text-mute transition-colors hover:border-line hover:bg-ash hover:text-ink"
            >
              <BellIcon />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 bg-pink" />
              ) : null}
            </button>

            {notifOpen ? (
              <div className="absolute right-0 top-full z-40 mt-2 w-[min(calc(100vw-1.5rem),22rem)] border border-line bg-panel shadow-xl">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="text-sm font-semibold">{t("topbar.notifications")}</p>
                  <button
                    type="button"
                    className="text-xs font-semibold uppercase tracking-[0.08em] text-sand hover:text-gold"
                    onClick={() =>
                      setNotifications((prev) =>
                        prev.map((n) => ({ ...n, unread: false })),
                      )
                    }
                  >
                    {t("topbar.markAllRead")}
                  </button>
                </div>
                <ul className="max-h-80 overflow-y-auto">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`border-b border-line px-4 py-3 last:border-b-0 ${
                        n.unread ? "bg-accent-soft" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-ink">{n.title}</p>
                        {n.unread ? (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-gold" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-mute">{n.body}</p>
                      <p className="mt-1 text-[11px] text-mute">{n.time}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="relative" ref={userRef}>
            <button
              type="button"
              aria-expanded={userOpen}
              aria-haspopup="menu"
              onClick={() => {
                setUserOpen((v) => !v);
                setNotifOpen(false);
              }}
              className="flex h-11 items-center gap-2 border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-line hover:bg-ash"
            >
              <span
                className="flex h-8 w-8 items-center justify-center text-xs font-bold text-white"
                style={{ background: currentUser.avatarHue }}
                aria-hidden
              >
                {currentUser.initials}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-semibold leading-tight text-ink">
                  {currentUser.name}
                </span>
                <span className="block text-[11px] leading-tight text-mute">
                  {currentUser.role}
                </span>
              </span>
              <ChevronIcon />
            </button>

            {userOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-2 w-[min(calc(100vw-1.5rem),18rem)] border border-line bg-panel shadow-xl"
              >
                <div className="border-b border-line px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center text-sm font-bold text-white"
                      style={{ background: currentUser.avatarHue }}
                    >
                      {currentUser.initials}
                    </span>
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
                      <p className="font-semibold text-ink">{currentUser.role}</p>
                    </div>
                    <div className="bg-ash px-2.5 py-2">
                      <p className="text-mute">{t("topbar.title")}</p>
                      <p className="font-semibold text-ink">{currentUser.title}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-mute">
                    {t("topbar.lastLogin", {
                      time: formatLastLogin(currentUser.lastLoginAt),
                    })}
                  </p>
                </div>

                <div className="py-1">
                  <MenuItem
                    label={t("topbar.accountSettings")}
                    onClick={() => {
                      setUserOpen(false);
                      pushToast(t("topbar.openingAccount"));
                    }}
                  />
                  <MenuItem
                    label={t("topbar.workspacePrefs")}
                    onClick={() => {
                      setUserOpen(false);
                      pushToast(t("topbar.openingWorkspace"));
                    }}
                  />
                  <MenuItem
                    label={t("topbar.billing")}
                    onClick={() => {
                      setUserOpen(false);
                      pushToast(
                        t("topbar.manageBilling", { plan: currentWorkspace.plan }),
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

function MenuIcon() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
      <path d="M1 1.5h20" stroke="currentColor" strokeWidth="2" />
      <path d="M1 8h20" stroke="currentColor" strokeWidth="2" />
      <path d="M1 14.5h20" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.75a3.5 3.5 0 0 0-3.5 3.5v1.6c0 .5-.16.98-.46 1.38L3.2 9.4A1 1 0 0 0 4 11h8a1 1 0 0 0 .8-1.6l-.84-1.17a2.3 2.3 0 0 1-.46-1.38V5.25A3.5 3.5 0 0 0 8 1.75Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M6.5 11.5a1.5 1.5 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="hidden text-mute sm:block"
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
