"use client";

import { useMemo, useState } from "react";
import { InvoiceDocument } from "@/components/invoice-document";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  Field,
  inputClass,
  Modal,
} from "@/components/modal";
import { EmptyHint, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import {
  invoiceTotal,
  todayIso,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/demo-data";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { invoiceCompany } from "@/lib/invoice-company";
import { invoiceTone } from "@/lib/status";
import { useLocale } from "@/lib/i18n";

const statuses: Array<InvoiceStatus | "all"> = [
  "all",
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
];

type LineDraft = { description: string; qty: string; unitPrice: string };

const emptyLine = (): LineDraft => ({
  description: "",
  qty: "1",
  unitPrice: "",
});

export default function InvoicesPage() {
  const { invoices, addInvoice, updateInvoiceStatus, pushToast } = useCrm();
  const { t, locale } = useLocale();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [openAdd, setOpenAdd] = useState(false);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [form, setForm] = useState({
    client: "",
    email: "",
    clientAddress: "",
    currency: "EUR" as "EUR" | "USD",
    dueDate: todayIso(),
    notes: invoiceCompany.paymentNote,
    lines: [{ ...emptyLine(), description: "Motorcycle tour — 1 rider" }] as LineDraft[],
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (status !== "all" && inv.status !== status) return false;
      if (!q) return true;
      return `${inv.number} ${inv.client} ${inv.email}`
        .toLowerCase()
        .includes(q);
    });
  }, [invoices, query, status]);

  const paid = invoices.filter((i) => i.status === "paid");
  const outstanding = invoices.filter(
    (i) => i.status === "sent" || i.status === "overdue",
  );
  const overdue = invoices.filter((i) => i.status === "overdue");
  const drafts = invoices.filter((i) => i.status === "draft");

  const paidTotal = paid.reduce((s, i) => s + invoiceTotal(i), 0);
  const outstandingTotal = outstanding.reduce((s, i) => s + invoiceTotal(i), 0);

  function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    const lines = form.lines
      .map((line) => ({
        description: line.description.trim(),
        qty: Number(line.qty),
        unitPrice: Number(line.unitPrice),
      }))
      .filter(
        (line) =>
          line.description &&
          Number.isFinite(line.qty) &&
          line.qty > 0 &&
          Number.isFinite(line.unitPrice) &&
          line.unitPrice >= 0,
      );
    if (!form.client.trim() || !form.email.trim() || lines.length === 0) return;

    // Always create as draft. Status becomes "sent" only after Brevo accepts email
    // (or manual "Mark sent"). Never pretends email was delivered.
    void addInvoice({
      client: form.client.trim(),
      email: form.email.trim(),
      clientAddress: form.clientAddress.trim(),
      currency: form.currency,
      dueDate: form.dueDate,
      lines,
      notes: form.notes.trim(),
      sendNow: false,
    });
    setForm({
      client: "",
      email: "",
      clientAddress: "",
      currency: "EUR",
      dueDate: todayIso(),
      notes: invoiceCompany.paymentNote,
      lines: [{ ...emptyLine(), description: "Motorcycle tour — 1 rider" }],
    });
    setOpenAdd(false);
  }

  function printPdf() {
    document.body.classList.add("printing-invoice");
    const done = () => document.body.classList.remove("printing-invoice");
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    window.setTimeout(done, 1000);
  }

  async function downloadPdf() {
    if (!preview) return;
    setDownloading(true);
    try {
      const { downloadInvoicePdf } = await import("@/lib/invoice-pdf");
      await downloadInvoicePdf(preview, locale);
      pushToast(`Downloaded ${preview.number}.pdf`);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "PDF download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function emailInvoice() {
    if (!preview) return;
    setEmailing(true);
    try {
      const res = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: preview.email,
          toName: preview.client,
          number: preview.number,
          totalLabel: formatMoney(
            invoiceTotal(preview),
            preview.currency,
            false,
            locale,
          ),
        }),
      });
      const json = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) {
        pushToast(
          `${t("pages.invoices.emailFailed")}: ${json.error || "unknown error"}`,
        );
        return;
      }
      // Brevo accepted the API call — not the same as inbox delivery.
      if (preview.status === "draft") {
        await updateInvoiceStatus(preview.id, "sent");
        setPreview({ ...preview, status: "sent" });
      }
      pushToast(t("pages.invoices.emailQueued", { email: preview.email }));
    } catch (err) {
      pushToast(
        `${t("pages.invoices.emailFailed")}: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    } finally {
      setEmailing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("pages.invoices.title")}
        description={t("pages.invoices.description")}
        action={
          <button type="button" className={btnPrimary} onClick={() => setOpenAdd(true)}>
            {t("pages.invoices.newInvoice")}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Paid"
          value={formatMoney(paidTotal, "USD", true, locale)}
          hint={`${paid.length} invoices`}
        />
        <KpiCard
          label="Outstanding"
          value={formatMoney(outstandingTotal, "USD", true, locale)}
          hint={`${outstanding.length} open`}
        />
        <KpiCard label="Overdue" value={formatNumber(overdue.length, false, locale)} />
        <KpiCard label="Drafts" value={formatNumber(drafts.length, false, locale)} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Search invoice # or client…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={inputClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as InvoiceStatus | "all")}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-4">
        <Panel title={`${filtered.length} of ${invoices.length} invoices`}>
          {filtered.length === 0 ? (
            <EmptyHint>No invoices match these filters.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-medium">{inv.number}</td>
                      <td>
                        <p>{inv.client}</p>
                        <p className="text-xs text-mute">{inv.email}</p>
                      </td>
                      <td>
                        <StatusBadge tone={invoiceTone(inv.status)}>
                          {inv.status}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-nowrap text-mute">
                        {formatDate(inv.issueDate, locale)}
                      </td>
                      <td className="whitespace-nowrap text-mute">
                        {formatDate(inv.dueDate, locale)}
                      </td>
                      <td className="whitespace-nowrap font-medium">
                        {formatMoney(invoiceTotal(inv), inv.currency, false, locale)}
                      </td>
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setPreview(inv)}
                        >
                          {t("pages.invoices.preview")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Modal open={openAdd} title="Generate invoice" onClose={() => setOpenAdd(false)} wide>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitInvoice}>
          <Field label="Client">
            <input
              required
              className={inputClass}
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
            />
          </Field>
          <Field label="Billing email">
            <input
              required
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Client address (optional)">
              <textarea
                className={`${inputClass} min-h-16`}
                value={form.clientAddress}
                onChange={(e) =>
                  setForm({ ...form, clientAddress: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Currency">
            <select
              className={inputClass}
              value={form.currency}
              onChange={(e) =>
                setForm({ ...form, currency: e.target.value as "EUR" | "USD" })
              }
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label="Due date">
            <input
              required
              type="date"
              className={inputClass}
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>

          <div className="sm:col-span-2 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
              Line items
            </p>
            {form.lines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_auto]">
                <input
                  required
                  className={inputClass}
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => {
                    const lines = [...form.lines];
                    lines[index] = { ...line, description: e.target.value };
                    setForm({ ...form, lines });
                  }}
                />
                <input
                  required
                  type="number"
                  min="1"
                  className={inputClass}
                  placeholder="Qty"
                  value={line.qty}
                  onChange={(e) => {
                    const lines = [...form.lines];
                    lines[index] = { ...line, qty: e.target.value };
                    setForm({ ...form, lines });
                  }}
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  placeholder="Price"
                  value={line.unitPrice}
                  onChange={(e) => {
                    const lines = [...form.lines];
                    lines[index] = { ...line, unitPrice: e.target.value };
                    setForm({ ...form, lines });
                  }}
                />
                <button
                  type="button"
                  className={btnGhost}
                  disabled={form.lines.length === 1}
                  onClick={() =>
                    setForm({
                      ...form,
                      lines: form.lines.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}
            >
              Add line
            </button>
          </div>

          <div className="sm:col-span-2">
            <Field label="Notes / payment terms">
              <textarea
                className={`${inputClass} min-h-20`}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-xs text-mute sm:col-span-2">
            Saved as <strong>draft</strong>. Use Email to client when ready —
            status becomes sent after the email goes out successfully.
          </p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className={btnPrimary}>
              Generate invoice
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setOpenAdd(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {preview ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ash/90">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-4 py-3 no-print">
            <div>
              <p className="font-display text-lg tracking-wide">{preview.number}</p>
              <p className="text-xs text-mute">{preview.client}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={downloading}
                onClick={() => void downloadPdf()}
              >
                {downloading
                  ? "Downloading…"
                  : t("pages.invoices.downloadPdf")}
              </button>
              <button type="button" className={btnSecondary} onClick={printPdf}>
                {t("pages.invoices.printPdf")}
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={emailing}
                onClick={() => void emailInvoice()}
              >
                {emailing ? "Emailing…" : "Email to client"}
              </button>
              {preview.status === "draft" ? (
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => {
                    void updateInvoiceStatus(preview.id, "sent");
                    setPreview({ ...preview, status: "sent" });
                    pushToast(t("pages.invoices.markSentNoEmail"));
                  }}
                >
                  {t("pages.invoices.markSentNoEmail")}
                </button>
              ) : null}
              {preview.status === "sent" || preview.status === "overdue" ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    updateInvoiceStatus(preview.id, "paid");
                    setPreview({
                      ...preview,
                      status: "paid",
                      paidDate: todayIso(),
                    });
                  }}
                >
                  Mark paid
                </button>
              ) : null}
              {preview.status !== "void" && preview.status !== "paid" ? (
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => {
                    updateInvoiceStatus(preview.id, "void");
                    setPreview({ ...preview, status: "void" });
                  }}
                >
                  Void
                </button>
              ) : null}
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex justify-center px-3 py-6 sm:px-6">
            <div className="w-full max-w-[210mm] shadow-2xl">
              <InvoiceDocument invoice={preview} locale={locale} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
