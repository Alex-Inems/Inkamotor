"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { btnToolbar, btnToolbarPrimary, inputClass } from "@/components/modal";
import { useCrm } from "@/lib/crm-store";
import { useLocale } from "@/lib/i18n";
import { SETTINGS_TABS } from "@/lib/settings/catalog";
import { SETTINGS_DEFAULTS } from "@/lib/settings/defaults";
import { settingsMsg } from "@/lib/settings/messages";
import {
  loadSettings,
  saveSettings,
  settingsEqual,
} from "@/lib/settings/storage";
import type {
  SettingField,
  SettingIconId,
  SettingItem,
  SettingSection,
  SettingTab,
  SettingValue,
  SettingValues,
} from "@/lib/settings/types";

export function SettingsView() {
  const { locale } = useLocale();
  const { pushToast } = useCrm();
  const m = useCallback((key: string) => settingsMsg(locale, key), [locale]);

  const [tabId, setTabId] = useState(SETTINGS_TABS[0]!.id);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<SettingValues>(SETTINGS_DEFAULTS);
  const [draft, setDraft] = useState<SettingValues>(SETTINGS_DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    setSaved(loaded);
    setDraft(loaded);
    setHydrated(true);
  }, []);

  const dirty = hydrated && !settingsEqual(draft, saved);

  const setValue = useCallback((key: string, value: SettingValue) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onSave = useCallback(() => {
    saveSettings(draft);
    setSaved(draft);
    pushToast({ message: m("ui.saved"), tone: "success" });
  }, [draft, m, pushToast]);

  const onDiscard = useCallback(() => {
    setDraft(saved);
    pushToast({ message: m("ui.discarded"), tone: "info" });
  }, [saved, m, pushToast]);

  const filteredTabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTINGS_TABS;
    return SETTINGS_TABS.map((tab) => {
      const sections = tab.sections
        .map((section) => {
          const items = section.items.filter((item) =>
            itemMatchesQuery(item, q, m),
          );
          if (!items.length) return null;
          return { ...section, items };
        })
        .filter(Boolean) as SettingSection[];
      if (
        !sections.length &&
        !m(tab.titleKey).toLowerCase().includes(q)
      ) {
        return null;
      }
      return {
        ...tab,
        sections:
          sections.length > 0
            ? sections
            : tab.sections.map((s) => ({
                ...s,
                items: s.items.filter((item) => itemMatchesQuery(item, q, m)),
              })),
      };
    }).filter(Boolean) as SettingTab[];
  }, [query, m]);

  const activeTab =
    filteredTabs.find((t) => t.id === tabId) ?? filteredTabs[0] ?? null;

  useEffect(() => {
    if (activeTab && activeTab.id !== tabId) setTabId(activeTab.id);
  }, [activeTab, tabId]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
        <button
          type="button"
          className={btnToolbarPrimary}
          disabled={!dirty}
          onClick={onSave}
        >
          {m("ui.save")}
        </button>
        <button
          type="button"
          className={btnToolbar}
          disabled={!dirty}
          onClick={onDiscard}
        >
          {m("ui.discard")}
        </button>
        <div className="relative min-w-[12rem] flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={m("ui.search")}
            className={`${inputClass} !py-1.5 pl-8`}
            aria-label={m("ui.search")}
          />
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
        </div>
        {dirty ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gold">
            {m("ui.dirty")}
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav
          className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line bg-ash px-1 py-1 lg:w-52 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r"
          aria-label={m("ui.title")}
        >
          {(query.trim() ? filteredTabs : SETTINGS_TABS).map((tab) => {
            const active = activeTab?.id === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTabId(tab.id)}
                className={`flex min-h-9 shrink-0 items-center gap-2 px-2.5 py-2 text-left text-[12px] font-medium transition-colors ${
                  active
                    ? "border-l-2 border-accent bg-panel text-ink lg:border-l-[3px]"
                    : "border-l-2 border-transparent text-mute hover:bg-panel/60 hover:text-ink"
                }`}
              >
                <TabIcon id={tab.icon} active={active} />
                <span className="truncate">{m(tab.titleKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto">
          {!activeTab || activeTab.sections.every((s) => !s.items.length) ? (
            <p className="px-6 py-12 text-center text-sm text-mute">
              {m("ui.noResults")}
            </p>
          ) : (
            <div className="pb-10">
              {activeTab.id === "general" && !query.trim() ? (
                <div className="border-b border-line bg-gold/10 px-5 py-2.5 text-sm text-ink sm:px-6">
                  {m("ui.seatsBanner")}
                </div>
              ) : null}
              {activeTab.sections.map((section) =>
                section.items.length ? (
                  <SectionBlock
                    key={section.id}
                    section={section}
                    values={draft}
                    setValue={setValue}
                    m={m}
                    pushToast={pushToast}
                  />
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionBlock({
  section,
  values,
  setValue,
  m,
  pushToast,
}: {
  section: SettingSection;
  values: SettingValues;
  setValue: (key: string, value: SettingValue) => void;
  m: (key: string) => string;
  pushToast: (msg: string) => void;
}) {
  return (
    <section>
      <div className="sticky top-0 z-[1] border-b border-line bg-ash/95 px-5 py-2 backdrop-blur-sm sm:px-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
          {m(section.titleKey)}
        </h2>
      </div>
      <div className="divide-y divide-line">
        {section.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            values={values}
            setValue={setValue}
            m={m}
            pushToast={pushToast}
          />
        ))}
      </div>
    </section>
  );
}

function ItemRow({
  item,
  values,
  setValue,
  m,
  pushToast,
}: {
  item: SettingItem;
  values: SettingValues;
  setValue: (key: string, value: SettingValue) => void;
  m: (key: string) => string;
  pushToast: (msg: string) => void;
}) {
  if (item.whenKey && !values[item.whenKey]) return null;

  const booleanField = item.fields.find((f) => f.kind === "boolean");
  const rest = item.fields.filter((f) => f.kind !== "boolean");
  const enabled = booleanField
    ? Boolean(values[booleanField.key])
    : true;

  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-6 sm:px-6">
      <div className="min-w-0">
        <div className="flex items-start gap-2.5">
          {booleanField ? (
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
              checked={Boolean(values[booleanField.key])}
              onChange={(e) => setValue(booleanField.key, e.target.checked)}
              aria-label={m(item.titleKey)}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{m(item.titleKey)}</p>
            {item.descKey ? (
              <p className="mt-0.5 text-[13px] leading-relaxed text-mute">
                {m(item.descKey)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className={`min-w-0 space-y-2.5 ${booleanField && !enabled ? "opacity-45" : ""}`}
      >
        {item.id === "email_templates_style" ? (
          <div className="flex flex-wrap gap-4 text-xs text-mute">
            <span>{m("ui.buttonText")}</span>
            <span>{m("ui.buttonColor")}</span>
          </div>
        ) : null}
        {item.id === "twilio_ice" ? (
          <div className="grid gap-1 text-xs text-mute sm:grid-cols-2">
            <span>{m("ui.accountSid")}</span>
            <span>{m("ui.authToken")}</span>
          </div>
        ) : null}
        {item.id === "invite_users" ? (
          <p className="text-[12px] text-mute">
            {m("ui.pendingInvites")}{" "}
            <span className="inline-flex rounded-sm bg-accent-soft px-2 py-0.5 text-sand">
              sophiejavaux@hotmail.com
            </span>
          </p>
        ) : null}
        {rest.map((field, idx) => (
          <FieldControl
            key={`${item.id}-${field.kind}-${idx}`}
            field={field}
            values={values}
            setValue={setValue}
            m={m}
            disabled={Boolean(booleanField) && !enabled}
            pushToast={pushToast}
          />
        ))}
      </div>
    </div>
  );
}

function FieldControl({
  field,
  values,
  setValue,
  m,
  disabled,
  pushToast,
}: {
  field: SettingField;
  values: SettingValues;
  setValue: (key: string, value: SettingValue) => void;
  m: (key: string) => string;
  disabled?: boolean;
  pushToast: (msg: string) => void;
}) {
  switch (field.kind) {
    case "boolean":
      return (
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={Boolean(values[field.key])}
            disabled={disabled}
            onChange={(e) => setValue(field.key, e.target.checked)}
          />
        </label>
      );
    case "radio":
      return (
        <div className="flex flex-col gap-1.5">
          {field.options.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex items-center gap-2 text-sm text-ink"
            >
              <input
                type="radio"
                name={field.key}
                className="accent-[var(--accent)]"
                checked={String(values[field.key] ?? "") === opt.value}
                disabled={disabled}
                onChange={() => setValue(field.key, opt.value)}
              />
              {m(opt.labelKey)}
            </label>
          ))}
        </div>
      );
    case "select":
      return (
        <select
          className={`${inputClass} !py-1.5`}
          value={String(values[field.key] ?? "")}
          disabled={disabled}
          onChange={(e) => setValue(field.key, e.target.value)}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {m(opt.labelKey)}
            </option>
          ))}
        </select>
      );
    case "text":
      return (
        <div className="flex items-center gap-1.5">
          {field.prefix ? (
            <span className="text-sm text-mute">{field.prefix}</span>
          ) : null}
          <input
            type={field.secret ? "password" : "text"}
            className={`${inputClass} !py-1.5`}
            value={String(values[field.key] ?? "")}
            placeholder={
              field.placeholderKey ? m(field.placeholderKey) : undefined
            }
            disabled={disabled}
            onChange={(e) => setValue(field.key, e.target.value)}
            autoComplete="off"
          />
        </div>
      );
    case "number":
      return (
        <div className="flex max-w-xs items-center gap-2">
          <input
            type="number"
            className={`${inputClass} !py-1.5`}
            value={Number(values[field.key] ?? 0)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            disabled={disabled}
            onChange={(e) =>
              setValue(field.key, e.target.value === "" ? 0 : Number(e.target.value))
            }
          />
          {field.suffixKey ? (
            <span className="shrink-0 text-sm text-mute">{m(field.suffixKey)}</span>
          ) : null}
        </div>
      );
    case "color":
      return (
        <div className="inline-flex items-center gap-2">
          <input
            type="color"
            className="h-8 w-10 cursor-pointer border border-line bg-canvas p-0.5"
            value={String(values[field.key] ?? "#000000")}
            disabled={disabled}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
          <span className="font-mono text-xs text-mute">
            {String(values[field.key] ?? "")}
          </span>
        </div>
      );
    case "info":
      return (
        <p className="text-sm font-medium text-ink whitespace-pre-wrap">
          {m(field.labelKey)}
        </p>
      );
    case "action":
      if (field.href) {
        return (
          <Link
            href={field.href}
            className="inline-flex items-center gap-1 text-sm font-medium text-sand hover:text-cream"
          >
            <span aria-hidden>→</span> {m(field.labelKey)}
          </Link>
        );
      }
      return (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-sand hover:text-cream"
          disabled={disabled}
          onClick={() => pushToast(m(field.labelKey))}
        >
          <span aria-hidden>→</span> {m(field.labelKey)}
        </button>
      );
    default:
      return null;
  }
}

function itemMatchesQuery(
  item: SettingItem,
  q: string,
  m: (key: string) => string,
) {
  const hay = [
    m(item.titleKey),
    item.descKey ? m(item.descKey) : "",
    ...item.fields.flatMap((f) => {
      if (f.kind === "action" || f.kind === "info") return [m(f.labelKey)];
      if (f.kind === "radio" || f.kind === "select")
        return f.options.map((o) => m(o.labelKey));
      return [];
    }),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function TabIcon({ id, active }: { id: SettingIconId; active: boolean }) {
  const stroke = active ? "currentColor" : "currentColor";
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none" as const,
    "aria-hidden": true as const,
    className: "shrink-0 opacity-90",
  };
  switch (id) {
    case "general":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.4" />
          <path d="M8 5.2v2.6l1.8 1.8" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "crm":
      return (
        <svg {...common}>
          <path d="M3 12.5 8 3.5l5 9H3Z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case "sales":
      return (
        <svg {...common}>
          <path d="M2.5 12.5V9M6 12.5V6M9.5 12.5V8M13 12.5V4" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="2.5" y="3.5" width="11" height="10" rx="1" stroke={stroke} strokeWidth="1.3" />
          <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "website":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.3" />
          <path d="M2.5 8h11M8 2.5c1.8 1.8 2.7 3.6 2.7 5.5S9.8 11.7 8 13.5c-1.8-1.8-2.7-3.6-2.7-5.5S6.2 4.3 8 2.5Z" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    case "purchase":
      return (
        <svg {...common}>
          <path d="M3 4.5h10l-1 7H4L3 4.5Z" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M5.5 4.5V3.8a2.5 2.5 0 0 1 5 0v.7" stroke={stroke} strokeWidth="1.3" />
        </svg>
      );
    case "inventory":
      return (
        <svg {...common}>
          <path d="M2.5 5.5 8 2.5l5.5 3v6L8 14.5 2.5 11.5v-6Z" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v6" stroke={stroke} strokeWidth="1.3" />
        </svg>
      );
    case "accounting":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.3" />
          <path d="M8 3.5v9M8 8h5.2" stroke={stroke} strokeWidth="1.3" />
        </svg>
      );
    case "project":
      return (
        <svg {...common}>
          <path d="M3 8.5 6.5 12l6.5-8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "sign":
      return (
        <svg {...common}>
          <path d="M3 12.5c2-3 3.5-4.5 5-4.5s2.2 1 4.5 4.5" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M9.5 4.5 12 7 7.5 11.5H5V9l4.5-4.5Z" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case "planning":
      return (
        <svg {...common}>
          <path d="M4 3.5v9l8-4.5-8-4.5Z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case "email":
      return (
        <svg {...common}>
          <path d="M2.5 8.5 13.5 3.5 9 13l-1.8-4.2L2.5 8.5Z" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case "employees":
      return (
        <svg {...common}>
          <circle cx="6" cy="5.5" r="2" stroke={stroke} strokeWidth="1.3" />
          <circle cx="11" cy="6.5" r="1.6" stroke={stroke} strokeWidth="1.2" />
          <path d="M2.5 13c.4-2.2 1.8-3.3 3.5-3.3S9.1 10.8 9.5 13M9.2 12.2c.5-1.4 1.5-2.1 2.6-2.1 1.3 0 2.2.8 2.7 2.1" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "fleet":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="4.5" stroke={stroke} strokeWidth="1.3" />
          <circle cx="8" cy="8" r="1.5" stroke={stroke} strokeWidth="1.3" />
          <path d="M8 3.5V2M8 14v-1.5M3.5 8H2M14 8h-1.5" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className} aria-hidden>
      <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="m9.2 9.2 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
