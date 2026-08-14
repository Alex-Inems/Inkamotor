"use client";

import { useMemo, useState } from "react";
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
import { type Sale, type SaleStatus, getDashboardStats } from "@/lib/demo-data";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { saleTone } from "@/lib/status";
import { useLocale } from "@/lib/i18n";

export default function SalesPage() {
  const { sales, addSale, updateSaleStatus, googleCampaigns, metaCampaigns } =
    useCrm();
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SaleStatus | "all">("all");
  const [openAdd, setOpenAdd] = useState(false);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [form, setForm] = useState({
    customer: "",
    email: "",
    product: "",
    amount: "",
    source: "website" as Sale["source"],
    notes: "",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (!q) return true;
      return `${s.number} ${s.customer} ${s.product} ${s.email}`
        .toLowerCase()
        .includes(q);
    });
  }, [sales, query, status]);

  const stats = getDashboardStats({
    sales,
    googleCampaigns,
    metaCampaigns,
  });
  const revenue = stats.salesRevenue;
  const pending = sales.filter((s) => s.status === "pending").length;
  const fromSite = sales.filter((s) => s.source === "website").length;
  const fulfilled = sales.filter((s) => s.status === "fulfilled").length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.customer.trim() || !form.email.trim() || !form.product.trim())
      return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    addSale({
      customer: form.customer.trim(),
      email: form.email.trim(),
      product: form.product.trim(),
      amount,
      source: form.source,
      inquiryId: null,
      leadId: null,
      notes: form.notes.trim() || "Created in CRM",
    });
    setForm({
      customer: "",
      email: "",
      product: "",
      amount: "",
      source: "website",
      notes: "",
    });
    setOpenAdd(false);
  }

  return (
    <div>
      <PageHeader
        title={t("pages.sales.title")}
        description={t("pages.sales.description")}
        action={
          <button type="button" className={btnPrimary} onClick={() => setOpenAdd(true)}>
            {t("pages.sales.newSale")}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={formatMoney(revenue, "USD", true)}
          hint="Confirmed + fulfilled"
        />
        <KpiCard
          label="Net profit"
          value={formatMoney(stats.netProfit, "USD", true)}
          hint={`${formatPercent(stats.profitMargin)} after COGS + ads`}
        />
        <KpiCard
          label="Gross profit"
          value={formatMoney(stats.grossProfit, "USD", true)}
          hint={`COGS ${formatMoney(stats.cogs, "USD", true)}`}
        />
        <KpiCard
          label="Ad profit"
          value={formatMoney(stats.adProfit, "USD", true)}
          hint={`${stats.avgRoas.toFixed(1)}x ROAS on ${formatMoney(stats.adSpend, "USD", true)}`}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Pending" value={formatNumber(pending)} />
        <KpiCard label="From website" value={formatNumber(fromSite)} />
        <KpiCard label="Fulfilled" value={formatNumber(fulfilled)} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Search sales…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={inputClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as SaleStatus | "all")}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="mt-4">
        <Panel title={`${filtered.length} sales`}>
          {filtered.length === 0 ? (
            <EmptyHint>No sales match these filters.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.number}</td>
                      <td>
                        <p>{s.customer}</p>
                        <p className="text-xs text-mute">{s.email}</p>
                      </td>
                      <td className="max-w-xs">
                        <p className="truncate">{s.product}</p>
                      </td>
                      <td className="capitalize text-mute">{s.source}</td>
                      <td>
                        <StatusBadge tone={saleTone(s.status)}>
                          {s.status}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-nowrap font-medium">
                        {formatMoney(s.amount, "USD")}
                      </td>
                      <td className="whitespace-nowrap text-mute">
                        {formatDate(s.createdAt)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setSelected(s)}
                        >
                          Open
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

      <Modal open={openAdd} title="New sale" onClose={() => setOpenAdd(false)}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <Field label="Customer">
            <input
              required
              className={inputClass}
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Product / package">
              <input
                required
                className={inputClass}
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Amount (USD)">
            <input
              required
              type="number"
              min="1"
              step="0.01"
              className={inputClass}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="Source">
            <select
              className={inputClass}
              value={form.source}
              onChange={(e) =>
                setForm({ ...form, source: e.target.value as Sale["source"] })
              }
            >
              <option value="website">Website</option>
              <option value="lead">Lead</option>
              <option value="ads">Ads</option>
              <option value="newsletter">Newsletter</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                className={`${inputClass} min-h-20`}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className={btnPrimary}>
              Create sale
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

      <Modal
        open={!!selected}
        title={selected?.number ?? "Sale"}
        onClose={() => setSelected(null)}
        wide
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{selected.customer}</p>
                <p className="text-sm text-mute">{selected.email}</p>
              </div>
              <StatusBadge tone={saleTone(selected.status)}>
                {selected.status}
              </StatusBadge>
            </div>
            <p className="text-sm">{selected.product}</p>
            <p className="font-display text-2xl font-bold">
              {formatMoney(selected.amount, "USD")}
            </p>
            <p className="text-xs text-mute">
              Source: {selected.source}
              {selected.inquiryId ? ` · Inquiry ${selected.inquiryId}` : ""}
              {selected.leadId ? ` · Lead ${selected.leadId}` : ""}
            </p>
            {selected.notes ? (
              <p className="text-sm text-mute">{selected.notes}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {selected.status === "pending" ? (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    updateSaleStatus(selected.id, "confirmed");
                    setSelected({ ...selected, status: "confirmed" });
                  }}
                >
                  Confirm sale
                </button>
              ) : null}
              {selected.status === "confirmed" ? (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    updateSaleStatus(selected.id, "fulfilled");
                    setSelected({ ...selected, status: "fulfilled" });
                  }}
                >
                  Mark fulfilled
                </button>
              ) : null}
              {selected.status !== "cancelled" &&
              selected.status !== "fulfilled" ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    updateSaleStatus(selected.id, "cancelled");
                    setSelected({ ...selected, status: "cancelled" });
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
