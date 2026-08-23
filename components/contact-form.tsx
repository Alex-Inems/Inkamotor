"use client";

import type { ReactNode } from "react";
import { btnPrimary, btnSecondary, Field, inputClass } from "@/components/modal";
import type { ContactWrite } from "@/lib/crm/contact-details";
import type { LeadStatus } from "@/lib/demo-data";
import { useT } from "@/lib/i18n";

const STAGES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

export function ContactForm({
  value,
  onChange,
  onSubmit,
  formId = "contact-form",
}: {
  value: ContactWrite;
  onChange: (next: ContactWrite) => void;
  onSubmit: () => void;
  formId?: string;
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
            {STAGES.map((id) => (
              <option key={id} value={id}>
                {t(`stages.${id}`)}
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
