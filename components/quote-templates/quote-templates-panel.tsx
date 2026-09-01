"use client";

import { useMemo, useState } from "react";
import {
  Field,
  Modal,
  btnGhost,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/modal";
import { QuotationLinesEditor } from "@/components/sales/quotation-lines-editor";
import { EmptyHint } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import {
  defaultTemplateBoilerplate,
  nextQuoteTemplateId,
  type OdooQuoteTemplate,
} from "@/lib/quote-templates";
import {
  useNewQuoteTemplateDraft,
  useQuoteTemplates,
} from "@/lib/quote-templates-store";
import { useLocale } from "@/lib/i18n";

function templateToForm(template: OdooQuoteTemplate) {
  return {
    id: template.id,
    name: template.name,
    numberOfDays: String(template.numberOfDays),
    requireSignature: template.requireSignature,
    requirePayment: template.requirePayment,
    noteHtml: template.noteHtml,
    lines: template.lines,
  };
}

export function QuoteTemplatesPanel({
  openAdd,
  onOpenAddChange,
}: {
  openAdd: boolean;
  onOpenAddChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const { products, pushToast } = useCrm();
  const { templates, upsertTemplate, deleteTemplate, resetToSeed } = useQuoteTemplates();
  const newDraft = useNewQuoteTemplateDraft();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OdooQuoteTemplate | null>(null);
  const [addForm, setAddForm] = useState(() => templateToForm(newDraft));
  const [editForm, setEditForm] = useState(() => templateToForm(newDraft));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((row) => row.name.toLowerCase().includes(q));
  }, [templates, query]);

  function openCreate() {
    const draft = templateToForm({
      ...newDraft,
      id: nextQuoteTemplateId(templates),
      lines: defaultTemplateBoilerplate(t),
    });
    setAddForm(draft);
    onOpenAddChange(true);
  }

  function saveForm(form: ReturnType<typeof templateToForm>, close: () => void) {
    const name = form.name.trim();
    const numberOfDays = Number(form.numberOfDays);
    if (!name) {
      pushToast(t("pages.quoteTemplates.nameRequired"));
      return;
    }
    if (!Number.isFinite(numberOfDays) || numberOfDays < 1) {
      pushToast(t("pages.quoteTemplates.validityRequired"));
      return;
    }
    upsertTemplate({
      id: form.id,
      name,
      numberOfDays: Math.round(numberOfDays),
      requireSignature: form.requireSignature,
      requirePayment: form.requirePayment,
      noteHtml: form.noteHtml,
      lines: form.lines,
    });
    pushToast(t("pages.quoteTemplates.saved"));
    close();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          className={`${inputClass} max-w-sm`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pages.quoteTemplates.search")}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => resetToSeed()}>
            {t("pages.quoteTemplates.resetSeed")}
          </button>
          <button type="button" className={btnPrimary} onClick={openCreate}>
            {t("pages.quoteTemplates.new")}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyHint>{t("pages.quoteTemplates.empty")}</EmptyHint>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("pages.quoteTemplates.name")}</th>
                <th>{t("pages.quoteTemplates.validity")}</th>
                <th>{t("pages.quoteTemplates.lines")}</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.name}</td>
                  <td className="text-mute">
                    {t("pages.sales.templateValidityDays", { n: row.numberOfDays })}
                  </td>
                  <td className="text-mute">{row.lines.length}</td>
                  <td>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        setSelected(row);
                        setEditForm(templateToForm(row));
                      }}
                    >
                      {t("common.edit")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={openAdd}
        title={t("pages.quoteTemplates.new")}
        wide
        onClose={() => onOpenAddChange(false)}
      >
        <TemplateForm
          form={addForm}
          onChange={setAddForm}
          products={products}
          onCancel={() => onOpenAddChange(false)}
          onSave={() => saveForm(addForm, () => onOpenAddChange(false))}
        />
      </Modal>

      <Modal
        open={!!selected}
        title={t("pages.quoteTemplates.edit")}
        wide
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <TemplateForm
            form={editForm}
            onChange={setEditForm}
            products={products}
            onCancel={() => setSelected(null)}
            onSave={() => saveForm(editForm, () => setSelected(null))}
            onDelete={() => {
              if (!window.confirm(t("pages.quoteTemplates.deleteConfirm"))) return;
              deleteTemplate(selected.id);
              pushToast(t("pages.quoteTemplates.deleted"));
              setSelected(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function TemplateForm({
  form,
  onChange,
  products,
  onCancel,
  onSave,
  onDelete,
}: {
  form: ReturnType<typeof templateToForm>;
  onChange: (form: ReturnType<typeof templateToForm>) => void;
  products: ReturnType<typeof useCrm>["products"];
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="space-y-4">
      <Field label={t("pages.quoteTemplates.name")}>
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("pages.quoteTemplates.validity")}>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.numberOfDays}
            onChange={(e) => onChange({ ...form, numberOfDays: e.target.value })}
          />
        </Field>
        <div className="space-y-2 pt-6 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.requireSignature}
              onChange={(e) =>
                onChange({ ...form, requireSignature: e.target.checked })
              }
            />
            {t("pages.sales.templateSignature")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.requirePayment}
              onChange={(e) => onChange({ ...form, requirePayment: e.target.checked })}
            />
            {t("pages.sales.templatePayment")}
          </label>
        </div>
      </div>

      <Field label={t("pages.quoteTemplates.termsHtml")}>
        <textarea
          className={`${inputClass} min-h-28 font-mono text-xs`}
          value={form.noteHtml}
          onChange={(e) => onChange({ ...form, noteHtml: e.target.value })}
          placeholder={t("pages.quoteTemplates.termsHint")}
        />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">
          {t("pages.quoteTemplates.boilerplateLines")}
        </p>
        <p className="mb-3 text-xs text-mute">{t("pages.quoteTemplates.boilerplateHint")}</p>
        <QuotationLinesEditor
          lines={form.lines}
          products={products}
          showCatalogue={false}
          onChange={(lines) => onChange({ ...form, lines })}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        <div>
          {onDelete ? (
            <button type="button" className={btnGhost} onClick={onDelete}>
              {t("common.delete")}
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnSecondary} onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="button" className={btnPrimary} onClick={onSave}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
