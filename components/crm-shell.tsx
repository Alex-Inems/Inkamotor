"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ColorStripe } from "./brand";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ToastStack } from "./toast-stack";
import { FirstRunTour } from "./first-run-tour";
import { CrmProvider } from "@/lib/crm-store";
import { LocaleProvider, useT } from "@/lib/i18n";

const pageKeys: Record<string, string> = {
  "/": "nav.overview",
  "/inbox": "nav.inbox",
  "/follow-ups": "nav.followUps",
  "/analytics": "nav.searchConsole",
  "/leads": "pages.leads.title",
  "/sales": "nav.sales",
  "/bookings": "nav.sales",
  "/search-console": "nav.searchConsole",
  "/invoices": "nav.invoices",
  "/newsletter": "nav.newsletter",
  "/setup": "nav.setup",
};

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <LocaleProvider>{children}</LocaleProvider>;
  }

  return (
    <LocaleProvider>
      <CrmProvider>
        <CrmShellInner>{children}</CrmShellInner>
      </CrmProvider>
    </LocaleProvider>
  );
}

function CrmShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const title = t(pageKeys[pathname] ?? "brand.crm");
  const fullBleed = pathname === "/inbox";
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!fullBleed) return;
    const vv = window.visualViewport;
    const set = () => {
      const h = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--crm-vvh", `${Math.round(h)}px`);
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
      {navOpen ? (
        <button
          type="button"
          aria-label={t("nav.closeMenu")}
          className="fixed inset-0 z-40 bg-ash/70 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <Sidebar
        pathname={pathname}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <div
        className={`min-w-0 lg:pl-60 ${
          fullBleed
            ? "flex h-[calc(var(--crm-vvh,100dvh)-6px)] flex-col"
            : ""
        }`}
      >
        <Topbar
          title={title}
          menuOpen={navOpen}
          onMenu={() => setNavOpen((v) => !v)}
        />
        <main
          className={
            fullBleed
              ? "min-h-0 flex-1 overflow-hidden"
              : "mx-auto w-full max-w-7xl px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8"
          }
        >
          {children}
        </main>
      </div>
      <ToastStack />
      <FirstRunTour
        onNeedNav={() => setNavOpen(true)}
        onCloseNav={() => setNavOpen(false)}
      />
    </div>
  );
}
