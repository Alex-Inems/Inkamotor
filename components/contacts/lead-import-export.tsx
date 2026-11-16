"use client";

import { useRef, useState } from "react";
import { Modal, btnPrimary, btnSecondary, btnToolbar } from "@/components/modal";
import {
  downloadLeadCsvTemplate,
  exportLeadRecords,
  importLeadCsvFile,
  type LeadExportFilters,
} from "@/lib/crm/lead-csv-client";
import { useCrm } from "@/lib/crm-store";
import { useLocale } from "@/lib/i18n";

type Scope = "contacts" | "leads";

function keys(scope: Scope) {
  return scope === "leads" ? "pages.leads" : "pages.contacts";
}

export function LeadImportExportButtons({
  scope,
  filters,
  disabled,
  onImported,
}: {
  scope: Scope;
  filters: LeadExportFilters;
  disabled?: boolean;
  onImported?: () => void;
}) {
  const { t } = useLocale();
  const { pushToast, refreshCrm } = useCrm();
  const prefix = keys(scope);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function onExport() {
    setExporting(true);
    try {
      await exportLeadRecords({
        ...filters,
        filename: scope === "leads" ? "leads.csv" : "contacts.csv",
      });
      pushToast({ message: t(`${prefix}.exported`), tone: "success" });
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : t(`${prefix}.exportFailed`),
        tone: "error",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={btnToolbar}
        disabled={disabled || exporting}
        onClick={() => void onExport()}
      >
        {exporting ? t("common.exporting") : t("common.export")}
      </button>
      <button
        type="button"
        className={btnToolbar}
        disabled={disabled}
        onClick={() => setImportOpen(true)}
      >
        {t("common.import")}
      </button>
      <LeadImportModal
        scope={scope}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void refreshCrm();
          onImported?.();
        }}
      />
    </>
  );
}

export function LeadImportModal({
  scope,
  open,
  onClose,
  onImported,
}: {
  scope: Scope;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useLocale();
  const { pushToast } = useCrm();
  const prefix = keys(scope);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");

  function reset() {
    setFile(null);
    setResult("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setResult("");
    try {
      const imported = await importLeadCsvFile(file);
      const summary = t(`${prefix}.imported`, {
        created: imported.created,
        updated: imported.updated,
      });
      const extra = imported.skipped
        ? ` ${t(`${prefix}.importSkipped`, { n: imported.skipped })}`
        : "";
      const errors = imported.errors
        .slice(0, 6)
        .map((row) => t(`${prefix}.importRowError`, { row: row.row, message: row.message }))
        .join("\n");
      setResult([summary + extra, errors].filter(Boolean).join("\n"));
      pushToast({ message: summary, tone: "success" });
      onImported();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t(`${prefix}.importFailed`);
      setResult(message);
      pushToast({ message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t(`${prefix}.importTitle`)}
      subtitle={t(`${prefix}.importHint`)}
      onClose={close}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnSecondary} disabled={busy} onClick={close}>
            {t("common.close")}
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !file}
            onClick={() => void runImport()}
          >
            {busy ? t("common.importing") : t("common.import")}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border file:border-line file:bg-panel file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult("");
          }}
        />
        <button
          type="button"
          className="text-sm font-semibold text-sand hover:text-gold"
          onClick={() =>
            downloadLeadCsvTemplate(
              scope === "leads" ? "leads-template.csv" : "contacts-template.csv",
            )
          }
        >
          {t(`${prefix}.downloadTemplate`)}
        </button>
        {result ? (
          <pre className="whitespace-pre-wrap rounded-lg border border-line bg-ash/30 px-3 py-2 text-xs text-ink">
            {result}
          </pre>
        ) : null}
      </div>
    </Modal>
  );
}
