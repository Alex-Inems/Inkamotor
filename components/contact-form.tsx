"use client";

import type { ReactNode } from "react";
import { PriorityStars } from "@/components/priority-stars";
import {
  btnPrimary,
  btnSecondary,
  Field,
  inputClass,
  inputUnderlineClass,
} from "@/components/modal";
import type { ContactWrite } from "@/lib/crm/contact-details";
import type { LeadStatus } from "@/lib/demo-data";
import { useT } from "@/lib/i18n";

function SheetSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line/80 last:border-b-0">
      <h2 className="px-5 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold/90">
        {title}
      </h2>
      <div className="px-5 pb-4 pt-1">{children}</div>
    </section>
  );
}

function SheetRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 py-2 ${className}`}>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-mute">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SheetGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{children}</div>
  );
}

export function ContactForm({
  value,
  onChange,
  onSubmit,
  formId = "contact-form",
  stages,
  stageLabel,
  layout = "default",
}: {
  value: ContactWrite;
  onChange: (next: ContactWrite) => void;
  onSubmit: () => void;
  formId?: string;
  stages: { id: string; label: string }[];
  stageLabel: (id: string) => string;
  layout?: "default" | "sheet";
}) {
  const t = useT();

  function set<K extends keyof ContactWrite>(key: K, next: ContactWrite[K]) {
    onChange({ ...value, [key]: next });
  }

  function setExtra(index: number, next: { label: string; value: string }) {
    onChange({
      ...value,
      extras: value.extras.map((row, i) => (i === index ? next : row)),
    });
  }

  const stageOptions = stages.some((s) => s.id === value.status)
    ? stages
    : [{ id: value.status, label: stageLabel(value.status) }, ...stages];

  if (layout === "sheet") {
    const field = `${inputUnderlineClass} w-full`;
    return (
      <form
        id={formId}
        className="overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <SheetSection title={t("pages.contacts.sectionContact")}>
          <SheetGrid>
            <SheetRow label={t("common.email")}>
              <input
                className={field}
                type="text"
                value={value.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </SheetRow>
            <SheetRow label={t("common.phone")}>
              <input
                className={field}
                value={value.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </SheetRow>
            <SheetRow label={t("common.company")}>
              <input
                className={field}
                value={value.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </SheetRow>
            <SheetRow label={t("pages.leads.kind")}>
              <select
                className={field}
                value={value.isCompany ? "company" : "person"}
                onChange={(e) => {
                  const isCompany = e.target.value === "company";
                  onChange({
                    ...value,
                    isCompany,
                    company:
                      isCompany && !value.company.trim()
                        ? value.name.trim()
                        : value.company,
                  });
                }}
              >
                <option value="person">{t("pages.leads.person")}</option>
                <option value="company">{t("pages.leads.company")}</option>
              </select>
            </SheetRow>
            <SheetRow label={t("pages.leads.tags")} className="sm:col-span-2">
              <input
                className={field}
                value={value.tags}
                onChange={(e) => set("tags", e.target.value)}
              />
            </SheetRow>
          </SheetGrid>
        </SheetSection>

        <SheetSection title={t("pages.contacts.sectionAddress")}>
          <SheetGrid>
            <SheetRow label={t("pages.leads.city")}>
              <input
                className={field}
                value={value.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </SheetRow>
            <SheetRow label={t("pages.leads.country")}>
              <input
                className={field}
                value={value.country}
                onChange={(e) => set("country", e.target.value)}
              />
            </SheetRow>
          </SheetGrid>
        </SheetSection>

        <SheetSection title={t("pages.contacts.sectionSales")}>
          <SheetGrid>
            <SheetRow label={t("pages.leads.stage")}>
              <select
                className={field}
                value={value.status}
                onChange={(e) => set("status", e.target.value as LeadStatus)}
              >
                {stageOptions.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stageLabel(stage.id)}
                  </option>
                ))}
              </select>
            </SheetRow>
            <SheetRow label={t("pages.leads.active")}>
              <select
                className={field}
                value={value.active ? "yes" : "no"}
                onChange={(e) => set("active", e.target.value === "yes")}
              >
                <option value="yes">{t("common.yes")}</option>
                <option value="no">{t("common.no")}</option>
              </select>
            </SheetRow>
            <SheetRow label={t("pages.leads.priority")}>
              <PriorityStars
                size="md"
                value={value.priority}
                onChange={(priority) => set("priority", priority)}
              />
            </SheetRow>
          </SheetGrid>
        </SheetSection>

        <SheetSection title={t("pages.contacts.sectionMore")}>
          <SheetGrid>
            <SheetRow label={t("pages.leads.nextActivity")}>
              <input
                className={field}
                value={value.nextActivity}
                onChange={(e) => set("nextActivity", e.target.value)}
              />
            </SheetRow>
            <SheetRow label={t("pages.leads.activityStatus")}>
              <input
                className={field}
                value={value.activityStatus}
                onChange={(e) => set("activityStatus", e.target.value)}
              />
            </SheetRow>
            <SheetRow label={t("pages.leads.activities")}>
              <input
                className={field}
                value={value.activities}
                onChange={(e) => set("activities", e.target.value)}
              />
            </SheetRow>
            <SheetRow label={t("pages.leads.upcomingActivity")}>
              <input
                className={field}
                value={value.upcomingActivity}
                onChange={(e) => set("upcomingActivity", e.target.value)}
              />
            </SheetRow>
            <SheetRow label={t("pages.leads.stats")}>
              <input
                className={field}
                value={value.stats}
                onChange={(e) => set("stats", e.target.value)}
              />
            </SheetRow>
            <SheetRow label={t("pages.leads.properties")}>
              <input
                className={field}
                value={value.properties}
                onChange={(e) => set("properties", e.target.value)}
              />
            </SheetRow>
            {value.extras.map((row, index) => (
              <SheetRow
                key={`${row.label}-${index}`}
                label={row.label}
                className="sm:col-span-2"
              >
                <input
                  className={field}
                  value={row.value}
                  onChange={(e) =>
                    setExtra(index, { ...row, value: e.target.value })
                  }
                />
              </SheetRow>
            ))}
          </SheetGrid>
        </SheetSection>

        <SheetSection title={t("common.notes")}>
          <textarea
            className="min-h-28 w-full resize-y rounded-md border border-line bg-ash/20 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-mute/70 focus:border-gold"
            value={value.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={t("pages.contacts.notesPlaceholder")}
          />
        </SheetSection>
      </form>
    );
  }

  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("common.name")}>
          <input
            className={inputClass}
            value={value.name}
            required
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label={t("common.email")}>
          <input
            className={inputClass}
            type="text"
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label={t("common.phone")}>
          <input
            className={inputClass}
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label={t("common.company")}>
          <input
            className={inputClass}
            value={value.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </Field>
        <Field label={t("pages.leads.city")}>
          <input
            className={inputClass}
            value={value.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field label={t("pages.leads.country")}>
          <input
            className={inputClass}
            value={value.country}
            onChange={(e) => set("country", e.target.value)}
          />
        </Field>
        <Field label={t("pages.leads.tags")}>
          <input
            className={inputClass}
            value={value.tags}
            onChange={(e) => set("tags", e.target.value)}
          />
        </Field>
        <Field label={t("pages.leads.kind")}>
          <select
            className={inputClass}
            value={value.isCompany ? "company" : "person"}
            onChange={(e) => {
              const isCompany = e.target.value === "company";
              onChange({
                ...value,
                isCompany,
                company:
                  isCompany && !value.company.trim()
                    ? value.name.trim()
                    : value.company,
              });
            }}
          >
            <option value="person">{t("pages.leads.person")}</option>
            <option value="company">{t("pages.leads.company")}</option>
          </select>
        </Field>
        <Field label={t("pages.leads.stage")}>
          <select
            className={inputClass}
            value={value.status}
            onChange={(e) => set("status", e.target.value as LeadStatus)}
          >
            {stageOptions.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stageLabel(stage.id)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("pages.leads.active")}>
          <select
            className={inputClass}
            value={value.active ? "yes" : "no"}
            onChange={(e) => set("active", e.target.value === "yes")}
          >
            <option value="yes">{t("common.yes")}</option>
            <option value="no">{t("common.no")}</option>
          </select>
        </Field>
        <Field label={t("pages.leads.priority")}>
          <div className="flex min-h-10 items-center px-1">
            <PriorityStars
              size="md"
              value={value.priority}
              onChange={(priority) => set("priority", priority)}
            />
          </div>
        </Field>
        <Field label={t("pages.leads.nextActivity")}>
          <input
            className={inputClass}
            value={value.nextActivity}
            onChange={(e) => set("nextActivity", e.target.value)}
          />
        </Field>
        <Field label={t("pages.leads.activityStatus")}>
          <input
            className={inputClass}
            value={value.activityStatus}
            onChange={(e) => set("activityStatus", e.target.value)}
          />
        </Field>
        <Field label={t("pages.leads.activities")}>
          <input
            className={inputClass}
            value={value.activities}
            onChange={(e) => set("activities", e.target.value)}
          />
        </Field>
        <Field label={t("pages.leads.upcomingActivity")}>
          <input
            className={inputClass}
            value={value.upcomingActivity}
            onChange={(e) => set("upcomingActivity", e.target.value)}
          />
        </Field>
        <Field label={t("pages.leads.stats")}>
          <input
            className={inputClass}
            value={value.stats}
            onChange={(e) => set("stats", e.target.value)}
          />
        </Field>
        <Field label={t("pages.leads.properties")}>
          <input
            className={inputClass}
            value={value.properties}
            onChange={(e) => set("properties", e.target.value)}
          />
        </Field>
      </div>

      {value.extras.map((row, index) => (
        <Field key={`${row.label}-${index}`} label={row.label}>
          <input
            className={inputClass}
            value={row.value}
            onChange={(e) => setExtra(index, { ...row, value: e.target.value })}
          />
        </Field>
      ))}

      <Field label={t("common.notes")}>
        <textarea
          className={`${inputClass} min-h-[5.5rem] resize-y`}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
    </form>
  );
}

export function ContactFormActions({
  saving,
  error,
  formId,
  onCancel,
  extraActions,
}: {
  saving: boolean;
  error: string;
  formId: string;
  onCancel: () => void;
  extraActions?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-pink">{error}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap [&>button]:w-full sm:[&>button]:w-auto">
        <button
          type="submit"
          form={formId}
          className={btnPrimary}
          disabled={saving}
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
        <button
          type="button"
          className={btnSecondary}
          disabled={saving}
          onClick={onCancel}
        >
          {t("common.cancel")}
        </button>
        {extraActions ? (
          <div className="grid grid-cols-2 gap-2 sm:contents [&>a]:w-full [&>button]:w-full sm:[&>a]:w-auto sm:[&>button]:w-auto [&>*:only-child]:col-span-2">
            {extraActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
