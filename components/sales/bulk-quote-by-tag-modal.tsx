"use client";

import { useEffect, useMemo, useState } from "react";
import {
  btnPrimary,
  btnSecondary,
  Field,
  inputClass,
  Modal,
} from "@/components/modal";
import { QuotationLinesEditor } from "@/components/sales/quotation-lines-editor";
import { useCrm } from "@/lib/crm-store";
import type { SaleLine } from "@/lib/demo-data";
import {
  PAYMENT_TERMS,
  defaultValidityDate,
  getPaymentTermLabel,
  linesTotal,
  primaryProductLabel,
} from "@/lib/quotation-form-data";
import { applyLocalizedTemplateToQuotationLines } from "@/lib/quote-template-lines";
import { getTemplateNoteHtml } from "@/lib/quote-template-terms";
import { useQuoteTemplates } from "@/lib/quote-templates-store";
import { BULK_QUOTE_BATCH } from "@/lib/sales/bulk-quote-constants";
import { useLocale } from "@/lib/i18n";

type Recipient = {
  leadId: string;
  name: string;
  email: string;
  hasExistingSale: boolean;
};

export function BulkQuoteByTagModal({
  open,
  initialTag = "all",
  tags,
  onClose,
  onDone,
}: {
  open: boolean;
  initialTag?: string;
  tags: string[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const { t, locale } = useLocale();
  const { products, pushToast, refreshCrm } = useCrm();
  const { templates } = useQuoteTemplates();
  const defaultTemplate = templates[0] ?? null;

  const [tag, setTag] = useState(initialTag === "all" ? "" : initialTag);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templateName, setTemplateName] = useState(defaultTemplate?.name ?? "");
  const [trip, setTrip] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(PAYMENT_TERMS[1]?.name ?? "");
  const [validityDate, setValidityDate] = useState(
    defaultValidityDate(defaultTemplate?.numberOfDays ?? 10),
  );
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [termsHtml, setTermsHtml] = useState("");
  const [message, setMessage] = useState("");
  const [skipExisting, setSkipExisting] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    sent: number;
    failed: number;
    skipped: number;
  } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const template = useMemo(
    () => templates.find((row) => row.name === templateName) ?? defaultTemplate,
    [templates, templateName, defaultTemplate],
  );

  function applyTemplate(name: string) {
    const tpl = templates.find((row) => row.name === name) ?? defaultTemplate;
    if (!tpl) return;
    setTemplateName(tpl.name);
    setValidityDate(defaultValidityDate(tpl.numberOfDays));
    setTermsHtml(getTemplateNoteHtml(tpl, locale));
    setLines(
      applyLocalizedTemplateToQuotationLines(
        [
          {
            description: tpl.name,
            displayType: "product",
            qty: 1,
            unitPrice: 0,
          },
        ],
        tpl,
        locale,
      ),
    );
  }

  useEffect(() => {
    if (!open) return;
    setTag(initialTag === "all" ? tags[0] ?? "" : initialTag);
    setProgress(null);
    setLog([]);
    setMessage("");
    setTrip("");
    if (defaultTemplate) applyTemplate(defaultTemplate.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTag, tags]);

  useEffect(() => {
    if (!open || !template) return;
    setTermsHtml(getTemplateNoteHtml(template, locale));
    setLines((prev) => {
      const productsOnly = prev.filter((line) => line.displayType === "product");
      return applyLocalizedTemplateToQuotationLines(
        productsOnly.length
          ? productsOnly
          : [
              {
                description: template.name,
                displayType: "product",
                qty: 1,
                unitPrice: 0,
              },
            ],
        template,
        locale,
      );
    });
  }, [locale, open, template]);

  useEffect(() => {
    if (!open || !tag) {
      setRecipients([]);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    void (async () => {
      try {
        const res = await fetch("/api/sales/bulk-quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "preview", tag }),
        });
        const json = (await res.json()) as {
          recipients?: Recipient[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error || t("pages.sales.bulkQuotePreviewFailed"));
        }
        if (cancelled) return;
        setRecipients(json.recipients ?? []);
      } catch (err) {
        if (!cancelled) {
          setRecipients([]);
          pushToast({
            message:
              err instanceof Error
                ? err.message
                : t("pages.sales.bulkQuotePreviewFailed"),
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tag, pushToast, t]);

  const queue = useMemo(
    () => recipients.filter((row) => (skipExisting ? !row.hasExistingSale : true)),
    [recipients, skipExisting],
  );

  const total = linesTotal(lines);

  async function runSend() {
    if (!tag) {
      pushToast({ message: t("pages.sales.bulkQuoteNeedTag"), tone: "error" });
      return;
    }
    const billable = lines.filter(
      (line) => line.displayType === "product" && line.description.trim(),
    );
    if (billable.length === 0) {
      pushToast({ message: t("pages.sales.lineRequired"), tone: "error" });
      return;
    }
    if (queue.length === 0) {
      pushToast({ message: t("pages.sales.bulkQuoteEmpty"), tone: "error" });
      return;
    }
    if (
      !window.confirm(
        t("pages.sales.bulkQuoteConfirm", { n: queue.length, tag }),
      )
    ) {
      return;
    }

    setSending(true);
    setLog([]);
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const totalCount = queue.length;
    setProgress({ done: 0, total: totalCount, sent, failed, skipped });

    const product = primaryProductLabel(lines);
    const voyageLabel = t("pages.sales.voyage");

    try {
      for (let i = 0; i < queue.length; i += BULK_QUOTE_BATCH) {
        const batch = queue.slice(i, i + BULK_QUOTE_BATCH);
        const res = await fetch(`/api/sales/bulk-quotes?locale=${locale}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send",
            tag,
            leadIds: batch.map((row) => row.leadId),
            product,
            amount: total,
            quoteTemplateName: templateName,
            trip,
            voyageLabel,
            lines,
            termsHtml,
            paymentTerms,
            validityDate,
            message: message.trim() || undefined,
            skipExisting,
          }),
        });
        const json = (await res.json()) as {
          error?: string;
          results?: {
            leadId: string;
            email: string;
            saleNumber?: string;
            ok: boolean;
            skipped?: boolean;
            error?: string;
          }[];
        };
        if (!res.ok) {
          throw new Error(json.error || t("pages.sales.bulkQuoteFailed"));
        }
        for (const row of json.results ?? []) {
          if (row.ok) {
            sent += 1;
            setLog((prev) => [
              ...prev,
              `✓ ${row.email} → ${row.saleNumber ?? ""}`,
            ]);
          } else if (row.skipped) {
            skipped += 1;
            setLog((prev) => [
              ...prev,
              `· ${row.email}: ${row.error || "skipped"}`,
            ]);
          } else {
            failed += 1;
            setLog((prev) => [
              ...prev,
              `✗ ${row.email}: ${row.error || "failed"}`,
            ]);
          }
        }
        setProgress({
          done: Math.min(i + batch.length, totalCount),
          total: totalCount,
          sent,
          failed,
          skipped,
        });
      }
      pushToast({
        message: t("pages.sales.bulkQuoteDone", { sent, failed, skipped }),
        tone: failed ? "error" : "success",
      });
      await refreshCrm();
      onDone?.();
    } catch (err) {
      pushToast({
        message:
          err instanceof Error ? err.message : t("pages.sales.bulkQuoteFailed"),
        tone: "error",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t("pages.sales.bulkQuoteTitle")}
      onClose={sending ? () => undefined : onClose}
      extraWide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-mute">
            {t("pages.sales.total")}:{" "}
            <span className="font-semibold text-ink">{total.toFixed(2)} €</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={sending}
              onClick={onClose}
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={sending || loadingPreview || queue.length === 0}
              onClick={() => void runSend()}
            >
              {sending
                ? t("pages.sales.bulkQuoteSending", {
                    done: progress?.done ?? 0,
                    total: progress?.total ?? queue.length,
                  })
                : t("pages.sales.bulkQuoteSend", { n: queue.length })}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-mute">{t("pages.sales.bulkQuoteHint")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("pages.leads.tags")}>
            <select
              className={inputClass}
              value={tag}
              disabled={sending}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">{t("pages.sales.bulkQuotePickTag")}</option>
              {tags.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("pages.sales.quoteTemplate")}>
            <select
              className={inputClass}
              value={templateName}
              disabled={sending}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              {templates.map((row) => (
                <option key={row.id} value={row.name}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("pages.sales.tripName")}>
            <input
              className={inputClass}
              value={trip}
              disabled={sending}
              placeholder={t("pages.sales.tripNamePlaceholder")}
              onChange={(e) => setTrip(e.target.value)}
            />
          </Field>
          <Field label={t("pages.sales.expiration")}>
            <input
              type="date"
              className={inputClass}
              value={validityDate}
              disabled={sending}
              onChange={(e) => setValidityDate(e.target.value)}
            />
          </Field>
          <Field label={t("pages.sales.paymentTerms")}>
            <select
              className={inputClass}
              value={paymentTerms}
              disabled={sending}
              onChange={(e) => setPaymentTerms(e.target.value)}
            >
              {PAYMENT_TERMS.map((term) => (
                <option key={term.id} value={term.name}>
                  {getPaymentTermLabel(term, locale)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
            {t("pages.sales.tabOrderLines")}
          </p>
          <QuotationLinesEditor
            lines={lines}
            products={products}
            onChange={setLines}
            showCatalogue={false}
            termsHtml={termsHtml}
          />
        </div>

        <Field label={t("pages.sales.quoteEmailMessage")}>
          <textarea
            className={`${inputClass} min-h-28 resize-y text-sm`}
            value={message}
            disabled={sending}
            placeholder={t("pages.sales.bulkQuoteMessagePlaceholder")}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={skipExisting}
            disabled={sending}
            onChange={(e) => setSkipExisting(e.target.checked)}
          />
          <span>{t("pages.sales.bulkQuoteSkipExisting")}</span>
        </label>

        <div className="border border-line bg-ash/30 px-3 py-2.5 text-sm">
          {loadingPreview
            ? t("common.loading")
            : t("pages.sales.bulkQuoteQueue", {
                n: queue.length,
                total: recipients.length,
              })}
        </div>

        <ul className="max-h-40 overflow-y-auto border border-line text-sm">
          {queue.slice(0, 40).map((row) => (
            <li
              key={row.leadId}
              className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 last:border-b-0"
            >
              <span className="min-w-0 truncate font-medium">{row.name}</span>
              <span className="shrink-0 text-xs text-mute">{row.email}</span>
            </li>
          ))}
          {queue.length > 40 ? (
            <li className="px-3 py-2 text-xs text-mute">
              {t("pages.sales.bulkQuoteMore", { n: queue.length - 40 })}
            </li>
          ) : null}
          {!loadingPreview && queue.length === 0 ? (
            <li className="px-3 py-6 text-center text-mute">
              {t("pages.sales.bulkQuoteEmpty")}
            </li>
          ) : null}
        </ul>

        {progress ? (
          <div className="space-y-2 border border-line bg-panel px-3 py-3 text-sm">
            <p>
              {t("pages.sales.bulkQuoteProgress", {
                done: progress.done,
                total: progress.total,
                sent: progress.sent,
                failed: progress.failed,
                skipped: progress.skipped,
              })}
            </p>
            {log.length ? (
              <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-mute">
                {log.join("\n")}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
