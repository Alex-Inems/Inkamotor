"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type SearchComboboxProps<T> = {
  value: string;
  onValueChange: (value: string) => void;
  onSelect?: (item: T) => void;
  items: T[];
  filterItems: (items: T[], query: string, limit: number) => T[];
  getItemKey: (item: T) => string;
  getItemLabel: (item: T) => string;
  renderOption: (item: T, active: boolean) => ReactNode;
  placeholder?: string;
  className?: string;
  required?: boolean;
  emptyLabel: string;
  limit?: number;
  menuMinWidth?: number;
};

export function SearchCombobox<T>({
  value,
  onValueChange,
  onSelect,
  items,
  filterItems,
  getItemKey,
  getItemLabel,
  renderOption,
  placeholder,
  className,
  required,
  emptyLabel,
  limit = 12,
  menuMinWidth = 280,
}: SearchComboboxProps<T>) {
  const listId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pickingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const results = filterItems(items, query, limit);

  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, menuMinWidth),
      });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, menuMinWidth, query, results.length]);

  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  useEffect(() => {
    if (!open) setActiveIndex(-1);
  }, [open, query, results.length]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(item: T) {
    const label = getItemLabel(item);
    pickingRef.current = true;
    setQuery(label);
    onValueChange(label);
    onSelect?.(item);
    setOpen(false);
    setActiveIndex(-1);
    window.requestAnimationFrame(() => {
      pickingRef.current = false;
      inputRef.current?.focus();
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "Escape") {
      setOpen(false);
      setQuery(value);
      setActiveIndex(-1);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const item =
        activeIndex >= 0 ? results[activeIndex] : results.length === 1 ? results[0] : null;
      if (item) pick(item);
      return;
    }

    if (e.key === "Tab") setOpen(false);
  }

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              minWidth: coords.width,
              zIndex: 10000,
            }}
            className="max-h-72 overflow-auto rounded-sm border border-line bg-panel py-1 shadow-xl ring-1 ring-black/20"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-mute">{emptyLabel}</li>
            ) : (
              results.map((item, index) => {
                const active = index === activeIndex;
                return (
                  <li key={getItemKey(item)} role="presentation">
                    <button
                      id={`${listId}-opt-${index}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "bg-accent/25 text-ink"
                          : "text-ink hover:bg-accent/15"
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(item)}
                    >
                      {renderOption(item, active)}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={anchorRef} className="relative min-w-0">
        <div className="relative">
          <input
            ref={inputRef}
            required={required}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
            }
            className={`${className ?? ""} w-full pr-8`}
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              onValueChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              window.requestAnimationFrame(() => inputRef.current?.select());
            }}
            onBlur={() => {
              window.setTimeout(() => {
                if (pickingRef.current) return;
                setOpen(false);
                setQuery(value);
              }, 100);
            }}
            onKeyDown={onKeyDown}
          />
          <span
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1 text-mute"
            aria-hidden
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-70">
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
      </div>
      {menu}
    </>
  );
}
