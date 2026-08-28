"use client";

import { useMemo, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  Modal,
} from "@/components/modal";
import { QuoteDocument } from "@/components/quote-document";
import { EmptyHint, StatusBadge } from "@/components/ui";
import { OdooControlPanel } from "@/components/sales/odoo-control-panel";
import { useCrm } from "@/lib/crm-store";
import { type Sale, type SaleStatus } from "@/lib/demo-data";
import { enrichSale } from "@/lib/sale-quote";
import { formatDate, formatNumber, formatSalesMoney } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { saleTone } from "@/lib/status";

type ViewMode = "kanban" | "list";
type SaleFilter =
  | "all"
  | "my_quotations"
  | "quotations"
  | "sales_orders"
  | "cancelled";
type GroupByKey = "salesperson" | "customer" | "month" | "status";

const AVATAR_TONES = [
  "bg-[#3d8b7a]",
  "bg-[#c47a3a]",
  "bg-[#5a7aa8]",
  "bg-[#8a5a7a]",
  "bg-[#6b8f3a]",
  "bg-[#a85a5a]",
  "bg-[#5a8a8a]",
  "bg-[#8a7a3a]",
];

function avatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function customerInitials(name: string, email: string) {
  const base = (name || email.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : base.slice(0, 2);
  return (letters || "?").toUpperCase();
}

function matchesFilter(sale: Sale, filter: SaleFilter) {
  if (filter === "all") return true;
  if (filter === "my_quotations") {
    return /jorge/i.test(sale.notes) || sale.status === "pending" || sale.status === "sent";
  }
  if (filter === "quotations") return sale.status === "pending" || sale.status === "sent";
  if (filter === "sales_orders") return sale.status === "confirmed" || sale.status === "fulfilled";
  return sale.status === "cancelled";
}

function filterLabel(filter: SaleFilter, t: (key: string) => string) {
  switch (filter) {
    case "my_quotations":
      return t("pages.sales.filterMyQuotations");
    case "quotations":
      return t("pages.sales.filterQuotations");
    case "sales_orders":
      return t("pages.sales.filterSalesOrders");
    case "cancelled":
      return t("pages.sales.filterCancelled");
    default:
      return "";
  }
}

function groupLabel(key: GroupByKey, t: (key: string) => string) {
  switch (key) {
    case "salesperson":
      return t("pages.sales.groupSalesperson");
    case "customer":
      return t("pages.sales.groupCustomer");
    case "month":
      return t("pages.sales.groupOrderDate");
    case "status":
      return t("pages.sales.groupStatus");
  }
}

function groupSales(
  items: Sale[],
  groupBy: GroupByKey | null,
  stageLabel: (id: SaleStatus) => string,
  locale: string,
) {
  if (!groupBy) return [{ key: "all", label: "", items }];

  const buckets = new Map<string, { label: string; items: Sale[] }>();
  for (const sale of items) {
    let key: string;
    let label: string;
    switch (groupBy) {
      case "salesperson":
        key = "jorge";
        label = "Jorge";
        break;
      case "customer":
        key = sale.customer.trim() || "—";
        label = key;
        break;
      case "month": {
        key = sale.createdAt.slice(0, 7);
        label = new Intl.DateTimeFormat(locale, {
          month: "long",
          year: "numeric",
        }).format(new Date(`${key}-01T12:00:00`));
        break;
      }
      case "status":
        key = sale.status;
        label = stageLabel(sale.status);
        break;
    }
    const bucket = buckets.get(key);
    if (bucket) bucket.items.push(sale);
    else buckets.set(key, { label, items: [sale] });
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (groupBy === "month") return b.localeCompare(a);
      return a.localeCompare(b, locale);
    })
    .map(([key, value]) => ({
      key,
      label: value.label,
      items: value.items,
    }));
}

export function OrdersPanel() {
  const { sales, updateSaleStatus, sendSaleQuote, addInvoiceFromSale, invoices, pushToast } =
    useCrm();
  const { t, locale } = useLocale();
  const [view, setView] = useState<ViewMode>("kanban");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SaleFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupByKey | null>(null);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [quotePreview, setQuotePreview] = useState<Sale | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);

  const stageLabel = (id: SaleStatus) => t(`saleStages.${id}`);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales
      .filter((s) => matchesFilter(s, filter))
      .filter((s) => {
        if (!q) return true;
        return `${s.number} ${s.customer} ${s.product} ${s.email} Jorge`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [sales, query, filter]);

  const groups = useMemo(
    () => groupSales(filtered, groupBy, stageLabel, locale),
    [filtered, groupBy, locale, stageLabel],
  );

  const facets = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    if (filter !== "all") {
      chips.push({
        id: `filter-${filter}`,
        label: filterLabel(filter, t),
        onRemove: () => setFilter("all"),
      });
    }
    if (groupBy) {
      chips.push({
        id: `group-${groupBy}`,
        label: groupLabel(groupBy, t),
        onRemove: () => setGroupBy(null),
      });
    }
    return chips;
  }, [filter, groupBy, t]);

  async function sendQuotation(sale: Sale) {
    setSendingQuoteId(sale.id);
    try {
      await sendSaleQuote(sale.id);
      const refreshed = sales.find((row) => row.id === sale.id);
      const next = { ...sale, status: "sent" as const };
      if (selected?.id === sale.id) setSelected(enrichSale(refreshed ?? next));
    } catch {
      /* toast in store */
    } finally {
      setSendingQuoteId(null);
    }
  }

  async function moveSale(id: string, status: SaleStatus) {
    const sale = sales.find((s) => s.id === id);
    if (!sale || sale.status === status) return;
    setMovingId(id);
    await updateSaleStatus(id, status);
    setMovingId(null);
    if (selected?.id === id) setSelected({ ...sale, status });
  }

  return (
    <>
      <OdooControlPanel
        query={query}
        onQueryChange={setQuery}
        facets={facets}
        newHref="/sales/new"
        newLabel={t("pages.sales.newQuotation")}
        viewMode={view}
        onViewModeChange={setView}
        filterItems={[
          {
            id: "my_quotations",
            label: t("pages.sales.filterMyQuotations"),
            active: filter === "my_quotations",
            onSelect: () =>
              setFilter((prev) =>
                prev === "my_quotations" ? "all" : "my_quotations",
              ),
          },
          {
            id: "quotations",
            label: t("pages.sales.filterQuotations"),
            active: filter === "quotations",
            onSelect: () =>
              setFilter((prev) => (prev === "quotations" ? "all" : "quotations")),
          },
          {
            id: "sales_orders",
            label: t("pages.sales.filterSalesOrders"),
            active: filter === "sales_orders",
            onSelect: () =>
              setFilter((prev) =>
                prev === "sales_orders" ? "all" : "sales_orders",
              ),
          },
          {
            id: "cancelled",
            label: t("pages.sales.filterCancelled"),
            active: filter === "cancelled",
            onSelect: () =>
              setFilter((prev) => (prev === "cancelled" ? "all" : "cancelled")),
          },
        ]}
        groupByItems={(
          ["salesperson", "customer", "month", "status"] as GroupByKey[]
        ).map((key) => ({
          id: key,
          label: groupLabel(key, t),
          active: groupBy === key,
          onSelect: () => setGroupBy((prev) => (prev === key ? null : key)),
        }))}
      />

      {view === "kanban" ? (
        <div className="mt-4">
          {filtered.length === 0 ? (
            <EmptyHint>
              {sales.length === 0 && !query
                ? t("pages.sales.emptyPipeline")
                : t("pages.sales.empty")}
            </EmptyHint>
          ) : (
            <>
              <p className="mb-3 text-xs text-mute">
                {t("pages.sales.kanbanHint", {
                  shown: formatNumber(filtered.length, false, locale),
                  total: formatNumber(sales.length, false, locale),
                })}
              </p>
              <div className="space-y-5">
                {groups.map((group) => (
                  <section key={group.key}>
                    {group.label ? (
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-mute">
                        {group.label}
                        <span className="ml-2 font-normal normal-case tracking-normal">
                          ({formatNumber(group.items.length, false, locale)})
                        </span>
                      </h3>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {group.items.map((sale) => (
                        <SaleKanbanCard
                          key={sale.id}
                          sale={sale}
                          busy={movingId === sale.id}
                          stageLabel={stageLabel(sale.status)}
                          onOpen={() => setSelected(enrichSale(sale))}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {filtered.length === 0 ? (
            <EmptyHint>{t("pages.sales.empty")}</EmptyHint>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.key}>
                  {group.label ? (
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-mute">
                      {group.label}
                      <span className="ml-2 font-normal normal-case tracking-normal">
                        ({formatNumber(group.items.length, false, locale)})
                      </span>
                    </h3>
                  ) : null}
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t("common.number")}</th>
                          <th>{t("pages.sales.customer")}</th>
                          <th>{t("pages.sales.orderDate")}</th>
                          <th>{t("pages.sales.salesperson")}</th>
                          <th>{t("pages.sales.total")}</th>
                          <th>{t("common.status")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((s) => (
                          <tr key={s.id}>
                            <td className="font-medium">{s.number}</td>
                            <td>
                              <p>{s.customer}</p>
                              <p className="text-xs text-mute">{s.email}</p>
                            </td>
                            <td className="whitespace-nowrap text-mute">
                              {formatDate(s.createdAt, locale)}
                            </td>
                            <td className="text-mute">
                              {t("pages.sales.defaultSalesperson")}
                            </td>
                            <td className="whitespace-nowrap font-medium">
                              {formatSalesMoney(s.amount, locale)}
                            </td>
                            <td>
                              <StatusBadge tone={saleTone(s.status)}>
                                {stageLabel(s.status)}
                              </StatusBadge>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={btnGhost}
                                onClick={() => setSelected(enrichSale(s))}
                              >
                                {t("common.open")}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

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
                {selected.quoteTemplateName ? (
                  <p className="mt-1 text-sm text-mute">{selected.quoteTemplateName}</p>
                ) : null}
              </div>
              <StatusBadge tone={saleTone(selected.status)}>
                {stageLabel(selected.status)}
              </StatusBadge>
            </div>
            {selected.lines.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {selected.lines.map((line, i) => (
                  <li key={`${line.description}-${i}`} className="text-mute">
                    {line.displayType === "section" ? (
                      <span className="font-semibold text-ink">{line.description}</span>
                    ) : line.displayType === "note" ? (
                      <span className="whitespace-pre-line text-xs">{line.description}</span>
                    ) : (
                      <>
                        {line.description}
                        {" · "}
                        {formatSalesMoney(line.qty * line.unitPrice, locale)}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">{selected.product}</p>
            )}
            <p className="font-display text-2xl font-bold">
              {formatSalesMoney(selected.amount, locale)}
            </p>
            <p className="text-xs text-mute">
              {t("pages.sales.orderDateLine", {
                date: formatDate(selected.createdAt, locale),
              })}
              {" · "}
              {t("pages.sales.sourceLine", {
                source: t(`sources.${selected.source}`),
              })}
              {selected.paymentTerms
                ? ` · ${t("pages.sales.paymentTerms")}: ${selected.paymentTerms}`
                : ""}
              {selected.inquiryId
                ? ` · ${t("pages.sales.inquiryRef", { id: selected.inquiryId })}`
                : ""}
              {selected.leadId
                ? ` · ${t("pages.sales.leadRef", { id: selected.leadId })}`
                : ""}
            </p>
            {selected.notes ? (
              <p className="text-sm text-mute whitespace-pre-line">{selected.notes}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setQuotePreview(enrichSale(selected))}
              >
                {t("pages.sales.previewQuote")}
              </button>
              {selected.invoiceId ? (
                <span className="inline-flex min-h-11 items-center px-3 text-sm text-mute">
                  {t("pages.sales.invoiceLinked", {
                    number:
                      invoices.find((inv) => inv.id === selected.invoiceId)?.number ??
                      selected.invoiceId,
                  })}
                </span>
              ) : (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    void addInvoiceFromSale(selected.id).then((invoiceId) => {
                      if (invoiceId) {
                        setSelected({ ...selected, invoiceId });
                      }
                    });
                  }}
                >
                  {t("pages.sales.createInvoice")}
                </button>
              )}
              {selected.status === "pending" ? (
                <>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={sendingQuoteId === selected.id}
                    onClick={() => {
                      void sendQuotation(selected);
                    }}
                  >
                    {sendingQuoteId === selected.id
                      ? t("common.sending")
                      : t("pages.sales.sendQuotation")}
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      void moveSale(selected.id, "confirmed");
                    }}
                  >
                    {t("pages.sales.confirmOrder")}
                  </button>
                </>
              ) : null}
              {selected.status === "sent" ? (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    void moveSale(selected.id, "confirmed");
                  }}
                >
                  {t("pages.sales.confirmOrder")}
                </button>
              ) : null}
              {selected.status === "confirmed" ? (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    void moveSale(selected.id, "fulfilled");
                  }}
                >
                  {t("pages.sales.lockOrder")}
                </button>
              ) : null}
              {selected.status !== "cancelled" &&
              selected.status !== "fulfilled" ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    void moveSale(selected.id, "cancelled");
                  }}
                >
                  {t("pages.sales.cancelOrder")}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!quotePreview}
        title={t("pages.sales.previewQuote")}
        onClose={() => setQuotePreview(null)}
        wide
        footer={
          quotePreview ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  void import("@/lib/quote-pdf").then(({ downloadQuotePdf }) =>
                    downloadQuotePdf(quotePreview, locale).catch((err) =>
                      pushToast(
                        err instanceof Error ? err.message : t("pages.sales.quotePdfFailed"),
                      ),
                    ),
                  );
                }}
              >
                {t("pages.sales.downloadQuote")}
              </button>
              <button type="button" className={btnSecondary} onClick={() => window.print()}>
                {t("pages.invoices.print")}
              </button>
            </div>
          ) : null
        }
      >
        {quotePreview ? (
          <div className="printing-invoice">
            <QuoteDocument sale={quotePreview} locale={locale} />
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function SaleKanbanCard({
  sale,
  busy,
  stageLabel,
  onOpen,
}: {
  sale: Sale;
  busy: boolean;
  stageLabel: string;
  onOpen: () => void;
}) {
  const { locale } = useLocale();
  const initials = customerInitials(sale.customer, sale.email);
  const tone = avatarTone(sale.email || sale.id || sale.customer);

  return (
    <article
      className={`border border-line bg-canvas transition-colors ${
        busy ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        disabled={busy}
        onClick={onOpen}
        className="w-full px-3 py-2.5 text-left hover:bg-ash/60 disabled:opacity-50"
      >
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${tone}`}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {sale.customer}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-mute">
                  {sale.number}
                </p>
              </div>
              <p className="shrink-0 text-xs font-semibold text-gold">
                {formatSalesMoney(sale.amount, locale)}
              </p>
            </div>
            <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-mute">
              {sale.product}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={saleTone(sale.status)}>{stageLabel}</StatusBadge>
              <span className="text-[10px] text-mute">
                {formatDate(sale.createdAt, locale)}
              </span>
            </div>
          </div>
        </div>
      </button>
    </article>
  );
}
