"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { btnPrimary } from "@/components/modal";
import { useLocale } from "@/lib/i18n";

export type OdooFacet = {
  id: string;
  label: string;
  onRemove: () => void;
};

export type OdooMenuItem = {
  id: string;
  label: string;
  active?: boolean;
  onSelect: () => void;
};

export function OdooControlPanel({
  query,
  onQueryChange,
  facets,
  filterItems,
  groupByItems,
  favoriteItems,
  viewMode,
  onViewModeChange,
  onNew,
  newHref,
  newLabel,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  facets: OdooFacet[];
  filterItems: OdooMenuItem[];
  groupByItems: OdooMenuItem[];
  favoriteItems?: OdooMenuItem[];
  viewMode?: "kanban" | "list";
  onViewModeChange?: (mode: "kanban" | "list") => void;
  onNew?: () => void;
  newHref?: string;
  newLabel: string;
}) {
  const { t } = useLocale();
  const searchId = useId();
  const [openMenu, setOpenMenu] = useState<"filters" | "groupBy" | "favorites" | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className="space-y-0">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-3">
        {newHref ? (
          <Link href={newHref} className={`${btnPrimary} shrink-0`}>
            {newLabel}
          </Link>
        ) : onNew ? (
          <button type="button" className={`${btnPrimary} shrink-0`} onClick={onNew}>
            {newLabel}
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="odoo-searchview flex min-h-9 flex-wrap items-center gap-1.5 border border-line bg-panel px-2 py-1.5">
            <SearchIcon className="shrink-0 text-mute" />
            {facets.map((facet) => (
              <button
                key={facet.id}
                type="button"
                className="odoo-search-facet inline-flex max-w-full items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium text-cream"
                onClick={facet.onRemove}
                title={t("pages.sales.removeFilter")}
              >
                <span className="truncate">{facet.label}</span>
                <span aria-hidden className="text-[10px] leading-none opacity-80">
                  ×
                </span>
              </button>
            ))}
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t("pages.sales.odooSearchPlaceholder")}
              className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-ink outline-none placeholder:text-mute"
              aria-label={t("pages.sales.odooSearchPlaceholder")}
            />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1">
            <OdooMenuButton
              label={t("pages.sales.odooFilters")}
              open={openMenu === "filters"}
              onToggle={() =>
                setOpenMenu((prev) => (prev === "filters" ? null : "filters"))
              }
              items={filterItems}
              onClose={() => setOpenMenu(null)}
            />
            <OdooMenuButton
              label={t("pages.sales.odooGroupBy")}
              open={openMenu === "groupBy"}
              onToggle={() =>
                setOpenMenu((prev) => (prev === "groupBy" ? null : "groupBy"))
              }
              items={groupByItems}
              onClose={() => setOpenMenu(null)}
            />
            <OdooMenuButton
              label={t("pages.sales.odooFavorites")}
              open={openMenu === "favorites"}
              onToggle={() =>
                setOpenMenu((prev) => (prev === "favorites" ? null : "favorites"))
              }
              items={
                favoriteItems?.length
                  ? favoriteItems
                  : [
                      {
                        id: "none",
                        label: t("pages.sales.odooNoFavorites"),
                        onSelect: () => setOpenMenu(null),
                      },
                    ]
              }
              onClose={() => setOpenMenu(null)}
            />
          </div>
        </div>

        {viewMode && onViewModeChange ? (
          <div
            role="group"
            aria-label={t("pages.sales.viewMode")}
            className="flex shrink-0 border border-line"
          >
            <button
              type="button"
              aria-pressed={viewMode === "kanban"}
              title={t("pages.sales.kanban")}
              className={`flex h-9 w-9 items-center justify-center ${
                viewMode === "kanban"
                  ? "bg-accent text-white"
                  : "bg-panel text-mute hover:bg-ash hover:text-ink"
              }`}
              onClick={() => onViewModeChange("kanban")}
            >
              <KanbanIcon />
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              title={t("pages.sales.list")}
              className={`flex h-9 w-9 items-center justify-center border-l border-line ${
                viewMode === "list"
                  ? "bg-accent text-white"
                  : "bg-panel text-mute hover:bg-ash hover:text-ink"
              }`}
              onClick={() => onViewModeChange("list")}
            >
              <ListIcon />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OdooMenuButton({
  label,
  open,
  onToggle,
  items,
  onClose,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  items: OdooMenuItem[];
  onClose: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-mute transition-colors hover:text-ink"
        onClick={onToggle}
      >
        {label}
        <ChevronDown className={open ? "rotate-180" : ""} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[12rem] border border-line bg-panel py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ash ${
                item.active ? "text-ink" : "text-mute"
              }`}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
            >
              <span
                aria-hidden
                className={`inline-flex h-4 w-4 items-center justify-center text-xs ${
                  item.active ? "text-accent" : "text-transparent"
                }`}
              >
                ✓
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 ${className ?? ""}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${className ?? ""}`}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KanbanIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1.5" y="2" width="4" height="12" rx="0.5" />
      <rect x="6" y="2" width="4" height="12" rx="0.5" />
      <rect x="10.5" y="2" width="4" height="12" rx="0.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1.5" y="3" width="13" height="1.5" rx="0.5" />
      <rect x="1.5" y="7.25" width="13" height="1.5" rx="0.5" />
      <rect x="1.5" y="11.5" width="13" height="1.5" rx="0.5" />
    </svg>
  );
}
