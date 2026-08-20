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

export default function BookingsPage() {
  const { sales, addSale, updateSaleStatus, googleCampaigns, metaCampaigns } =
    useCrm();
  const { t, locale } = useLocale();
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
      notes: form.notes.trim() || t("pages.sales.createdInCrm"),
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
          label={t("pages.sales.revenue")}
          value={formatMoney(revenue, "USD", true, locale)}
          hint={t("pages.sales.revenueHint")}
        />
        <KpiCard
          label={t("pages.sales.netProfit")}
          value={formatMoney(stats.netProfit, "USD", true, locale)}
          hint={t("pages.sales.netHint", {
            margin: formatPercent(stats.profitMargin),
          })}
        />
        <KpiCard
          label={t("pages.sales.grossProfit")}
          value={formatMoney(stats.grossProfit, "USD", true, locale)}
          hint={t("pages.sales.cogsHint", {
            amount: formatMoney(stats.cogs, "USD", true, locale),
          })}
        />
        <KpiCard
          label={t("pages.sales.adProfit")}
          value={formatMoney(stats.adProfit, "USD", true, locale)}
          hint={t("pages.sales.adHint", {
            roas: stats.avgRoas.toFixed(1),
            spend: formatMoney(stats.adSpend, "USD", true, locale),
          })}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label={t("pages.sales.pending")} value={formatNumber(pending, false, locale)} />
        <KpiCard label={t("pages.sales.fromWebsite")} value={formatNumber(fromSite, false, locale)} />
        <KpiCard label={t("pages.sales.fulfilled")} value={formatNumber(fulfilled, false, locale)} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder={t("pages.sales.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={inputClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as SaleStatus | "all")}
        >
          <option value="all">{t("common.allStatuses")}</option>
          <option value="pending">{t("status.pending")}</option>
          <option value="confirmed">{t("status.confirmed")}</option>
          <option value="fulfilled">{t("status.fulfilled")}</option>
          <option value="cancelled">{t("status.cancelled")}</option>
        </select>
      </div>

      <div className="mt-4">
        <Panel title={t("pages.sales.count", { n: filtered.length })}>
          {filtered.length === 0 ? (
            <EmptyHint>{t("pages.sales.empty")}</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("common.number")}</th>
                    <th>{t("pages.sales.customer")}</th>
                    <th>{t("pages.sales.product")}</th>
                    <th>{t("pages.sales.source")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("pages.sales.amount")}</th>
                    <th>{t("pages.sales.created")}</th>
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
                      <td className="capitalize text-mute">
                        {t(`sources.${s.source}`)}
                      </td>
                      <td>
                        <StatusBadge tone={saleTone(s.status)}>
                          {t(`status.${s.status}`)}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-nowrap font-medium">
                        {formatMoney(s.amount, "USD", false, locale)}
                      </td>
                      <td className="whitespace-nowrap text-mute">
                        {formatDate(s.createdAt, locale)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setSelected(s)}
                        >
                          {t("common.open")}
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

      <Modal open={openAdd} title={t("pages.sales.newSale")} onClose={() => setOpenAdd(false)}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <Field label={t("pages.sales.customer")}>
            <input
              required
              className={inputClass}
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
            />
          </Field>
          <Field label={t("common.email")}>
            <input
              required
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("pages.sales.productPackage")}>
              <input
                required
                className={inputClass}
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("pages.sales.amountUsd")}>
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
          <Field label={t("pages.sales.source")}>
            <select
              className={inputClass}
              value={form.source}
              onChange={(e) =>
                setForm({ ...form, source: e.target.value as Sale["source"] })
              }
            >
              <option value="website">{t("sources.website")}</option>
              <option value="lead">{t("sources.lead")}</option>
              <option value="ads">{t("sources.ads")}</option>
              <option value="newsletter">{t("sources.newsletter")}</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("pages.sales.notes")}>
              <textarea
                className={`${inputClass} min-h-20`}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className={btnPrimary}>
              {t("pages.sales.create")}
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setOpenAdd(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selected}
        title={selected?.number ?? t("pages.sales.sale")}
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
                {t(`status.${selected.status}`)}
              </StatusBadge>
            </div>
            <p className="text-sm">{selected.product}</p>
            <p className="font-display text-2xl font-bold">
              {formatMoney(selected.amount, "USD", false, locale)}
            </p>
            <p className="text-xs text-mute">
              {t("pages.sales.sourceLine", {
                source: t(`sources.${selected.source}`),
              })}
              {selected.inquiryId
                ? ` · ${t("pages.sales.inquiryRef", { id: selected.inquiryId })}`
                : ""}
              {selected.leadId
                ? ` · ${t("pages.sales.leadRef", { id: selected.leadId })}`
                : ""}
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
                  {t("pages.sales.confirm")}
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
                  {t("pages.sales.markFulfilled")}
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
                  {t("common.cancel")}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
