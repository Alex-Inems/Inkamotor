"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSwitcher } from "./app-switcher";
import { ColorStripe } from "./brand";
import { Topbar } from "./topbar";
import { ToastStack } from "./toast-stack";
import { FirstRunTour } from "./first-run-tour";
import { CrmProvider } from "@/lib/crm-store";
import { QuoteTemplatesProvider } from "@/lib/quote-templates-store";
import { LocaleProvider, type Locale } from "@/lib/i18n";
import { InboxNotificationsProvider } from "@/lib/inbox-notifications";
import { SessionUserProvider } from "@/lib/session-user";
import type { SessionUser } from "@/lib/session";

export function CrmShell({
  children,
  user,
  locale,
}: {
  children: React.ReactNode;
  user: SessionUser;
  locale?: Locale;
}) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>;
  }

  return (
    <LocaleProvider initialLocale={locale}>
      <SessionUserProvider user={user}>
        <CrmProvider>
          <QuoteTemplatesProvider>
            <InboxNotificationsProvider>
              <CrmShellInner>{children}</CrmShellInner>
            </InboxNotificationsProvider>
          </QuoteTemplatesProvider>
        </CrmProvider>
      </SessionUserProvider>
    </LocaleProvider>
  );
}

function CrmShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSaleDetail = /^\/sales\/(?!new)[^/]+$/.test(pathname);
  const isContactDetail = /^\/contacts\/[^/]+$/.test(pathname);
  const fullBleed =
    pathname === "/inbox" || isSaleDetail || isContactDetail;
  const wideMain = isSaleDetail || isContactDetail;
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!fullBleed) return;
    const vv = window.visualViewport;
    const set = () => {
      const h = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty(
        "--crm-vvh",
        `${Math.round(h)}px`,
      );
    };
    set();
    vv?.addEventListener("resize", set);
    vv?.addEventListener("scroll", set);
    window.addEventListener("resize", set);
    return () => {
      vv?.removeEventListener("resize", set);
      vv?.removeEventListener("scroll", set);
      window.removeEventListener("resize", set);
      document.documentElement.style.removeProperty("--crm-vvh");
    };
  }, [fullBleed]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

  return (
    <div
      className={`bg-canvas pt-[6px] text-ink ${
        fullBleed
          ? "h-[var(--crm-vvh,100dvh)] overflow-hidden"
          : "min-h-svh"
      }`}
    >
      <ColorStripe className="fixed inset-x-0 top-0 z-50" />
      <div
        className={`relative z-30 min-w-0 ${
          fullBleed
            ? "flex h-[calc(var(--crm-vvh,100dvh)-6px)] flex-col"
            : ""
        }`}
      >
        <Suspense
          fallback={
            <div className="h-12 border-b border-line bg-ash" aria-hidden />
          }
        >
          <Topbar
            menuOpen={navOpen}
            onMenu={() => setNavOpen((v) => !v)}
          />
        </Suspense>
        <main
          className={
            fullBleed
              ? "min-h-0 flex-1 overflow-hidden"
              : wideMain
                ? "mx-auto w-full max-w-none px-[max(0.75rem,env(safe-area-inset-left))] py-4 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5 lg:px-8"
                : "mx-auto w-full max-w-7xl px-[max(0.75rem,env(safe-area-inset-left))] py-4 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8"
          }
        >
          {children}
        </main>
      </div>
      <ToastStack />
      <AppSwitcher open={navOpen} onClose={() => setNavOpen(false)} />
      <FirstRunTour
        onNeedNav={() => setNavOpen(true)}
        onCloseNav={() => setNavOpen(false)}
      />
    </div>
  );
}
