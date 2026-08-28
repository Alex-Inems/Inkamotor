"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Field,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/modal";
import { OdooControlPanel } from "@/components/sales/odoo-control-panel";
import { EmptyHint } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import { type Product, type ProductType } from "@/lib/demo-data";
import { formatMoney, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

type ViewMode = "kanban" | "list";
type ProductFilter = "all" | "service" | "consu";

type ProductFormState = {
  name: string;
  reference: string;
  category: string;
  type: ProductType;
  listPrice: string;
  currency: Product["currency"];
  qtyOnHand: string;
  variantCount: string;
  description: string;
};

const emptyForm = (): ProductFormState => ({
  name: "",
  reference: "",
  category: "",
  type: "service",
  listPrice: "",
  currency: "EUR",
  qtyOnHand: "0",
  variantCount: "1",
  description: "",
});

function productToForm(product: Product): ProductFormState {
  return {
    name: product.name,
    reference: product.reference,
    category: product.category,
    type: product.type,
    listPrice: String(product.listPrice),
    currency: product.currency,
    qtyOnHand: String(product.qtyOnHand),
    variantCount: String(product.variantCount),
    description: product.description,
  };
}

function parseProductForm(form: ProductFormState) {
  const listPrice = Number(form.listPrice);
  const qtyOnHand = Number(form.qtyOnHand);
  const variantCount = Number(form.variantCount);
  if (!form.name.trim()) return null;
  if (!Number.isFinite(listPrice) || listPrice < 0) return null;
  if (!Number.isFinite(qtyOnHand) || qtyOnHand < 0) return null;
  if (!Number.isFinite(variantCount) || variantCount < 1) return null;
  return {
    name: form.name.trim(),
    reference: form.reference.trim(),
    category: form.category.trim(),
    type: form.type,
    listPrice,
    currency: form.currency,
    qtyOnHand,
    variantCount: Math.max(1, Math.round(variantCount)),
    description: form.description.trim(),
  };
}

export function ProductsPanel({
  openAdd,
  onOpenAddChange,
}: {
  openAdd: boolean;
  onOpenAddChange: (open: boolean) => void;
}) {
  const { products, addProduct, updateProduct } = useCrm();
  const { t, locale } = useLocale();
  const [view, setView] = useState<ViewMode>("kanban");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [selected, setSelected] = useState<Product | null>(null);
  const [addForm, setAddForm] = useState<ProductFormState>(emptyForm);
  const [editForm, setEditForm] = useState<ProductFormState>(emptyForm);

  const typeLabel = (type: ProductType) => t(`pages.products.types.${type}`);

  useEffect(() => {
    if (selected) setEditForm(productToForm(selected));
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => {
        if (filter === "all") return true;
        return p.type === filter;
      })
      .filter((p) => {
        if (!q) return true;
        return `${p.name} ${p.reference} ${p.category} ${p.description}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [products, query, filter, locale]);

  const facets = useMemo(() => {
    if (filter === "all") return [];
    return [
      {
        id: `filter-${filter}`,
        label:
          filter === "service"
            ? t("pages.products.filterServices")
            : t("pages.products.filterGoods"),
        onRemove: () => setFilter("all"),
      },
    ];
  }, [filter, t]);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const input = parseProductForm(addForm);
    if (!input) return;
    await addProduct(input);
    setAddForm(emptyForm());
    onOpenAddChange(false);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const input = parseProductForm(editForm);
    if (!input) return;
    await updateProduct(selected.id, input);
    setSelected(null);
  }

  return (
    <>
      <OdooControlPanel
        query={query}
        onQueryChange={setQuery}
        facets={facets}
        onNew={() => onOpenAddChange(true)}
        newLabel={t("pages.products.newProduct")}
        viewMode={view}
        onViewModeChange={setView}
        filterItems={[
          {
            id: "service",
            label: t("pages.products.filterServices"),
            active: filter === "service",
            onSelect: () =>
              setFilter((prev) => (prev === "service" ? "all" : "service")),
          },
          {
            id: "consu",
            label: t("pages.products.filterGoods"),
            active: filter === "consu",
            onSelect: () =>
              setFilter((prev) => (prev === "consu" ? "all" : "consu")),
          },
        ]}
        groupByItems={[
          {
            id: "category",
            label: t("pages.products.groupCategory"),
            active: false,
            onSelect: () => undefined,
          },
          {
            id: "type",
            label: t("pages.products.groupType"),
            active: false,
            onSelect: () => undefined,
          },
        ]}
      />

      {view === "kanban" ? (
        <div className="mt-4">
          {filtered.length === 0 ? (
            <EmptyHint>{t("pages.products.empty")}</EmptyHint>
          ) : (
            <>
              <p className="mb-3 text-xs text-mute">
                {t("pages.products.count", {
                  n: formatNumber(filtered.length, false, locale),
                })}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((product) => (
                  <ProductKanbanCard
                    key={product.id}
                    product={product}
                    onOpen={() => setSelected(product)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {filtered.length === 0 ? (
            <EmptyHint>{t("pages.products.empty")}</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("pages.products.name")}</th>
                    <th>{t("pages.products.reference")}</th>
                    <th>{t("pages.products.category")}</th>
                    <th>{t("pages.products.type")}</th>
                    <th>{t("pages.products.salesPrice")}</th>
                    <th>{t("pages.products.onHand")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr key={product.id}>
                      <td className="font-medium">{product.name}</td>
                      <td className="text-mute">{product.reference || "—"}</td>
                      <td className="max-w-xs truncate text-mute">
                        {product.category || "—"}
                      </td>
                      <td className="text-mute">{typeLabel(product.type)}</td>
                      <td className="whitespace-nowrap font-medium">
                        {formatMoney(product.listPrice, product.currency, false, locale)}
                      </td>
                      <td className="text-mute">
                        {product.qtyOnHand > 0
                          ? formatNumber(product.qtyOnHand, false, locale)
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-xs font-semibold uppercase tracking-wide text-accent hover:underline"
                          onClick={() => setSelected(product)}
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
        </div>
      )}

      <Modal
        open={openAdd}
        title={t("pages.products.newProduct")}
        onClose={() => onOpenAddChange(false)}
        wide
      >
        <ProductForm
          form={addForm}
          onChange={setAddForm}
          onSubmit={submitAdd}
          onCancel={() => onOpenAddChange(false)}
          submitLabel={t("pages.products.createProduct")}
          typeLabel={typeLabel}
        />
      </Modal>

      <Modal
        open={!!selected}
        title={selected?.name ?? t("pages.products.product")}
        onClose={() => setSelected(null)}
        wide
      >
        {selected ? (
          <ProductForm
            form={editForm}
            onChange={setEditForm}
            onSubmit={submitEdit}
            onCancel={() => setSelected(null)}
            submitLabel={t("pages.products.saveProduct")}
            typeLabel={typeLabel}
            odooId={selected.odooId}
          />
        ) : null}
      </Modal>
    </>
  );
}

function ProductForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  typeLabel,
  odooId,
}: {
  form: ProductFormState;
  onChange: (form: ProductFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  typeLabel: (type: ProductType) => string;
  odooId?: number;
}) {
  const { t } = useLocale();

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
      {odooId != null ? (
        <p className="text-sm text-mute sm:col-span-2">
          {t("pages.products.odooId", { id: odooId })}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Field label={t("pages.products.name")}>
          <input
            required
            className={inputClass}
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t("pages.products.reference")}>
        <input
          className={inputClass}
          value={form.reference}
          onChange={(e) => onChange({ ...form, reference: e.target.value })}
        />
      </Field>
      <Field label={t("pages.products.category")}>
        <input
          className={inputClass}
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
        />
      </Field>
      <Field label={t("pages.products.type")}>
        <select
          className={inputClass}
          value={form.type}
          onChange={(e) =>
            onChange({ ...form, type: e.target.value as ProductType })
          }
        >
          <option value="service">{typeLabel("service")}</option>
          <option value="consu">{typeLabel("consu")}</option>
          <option value="product">{typeLabel("product")}</option>
        </select>
      </Field>
      <Field label={t("pages.products.salesPrice")}>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          className={inputClass}
          value={form.listPrice}
          onChange={(e) => onChange({ ...form, listPrice: e.target.value })}
        />
      </Field>
      <Field label={t("pages.products.currency")}>
        <select
          className={inputClass}
          value={form.currency}
          onChange={(e) =>
            onChange({
              ...form,
              currency: e.target.value as Product["currency"],
            })
          }
        >
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </Field>
      <Field label={t("pages.products.onHand")}>
        <input
          type="number"
          min="0"
          step="1"
          className={inputClass}
          value={form.qtyOnHand}
          onChange={(e) => onChange({ ...form, qtyOnHand: e.target.value })}
        />
      </Field>
      <Field label={t("pages.products.variants")}>
        <input
          type="number"
          min="1"
          step="1"
          className={inputClass}
          value={form.variantCount}
          onChange={(e) => onChange({ ...form, variantCount: e.target.value })}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("pages.products.description")}>
          <textarea
            className={`${inputClass} min-h-20`}
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={btnPrimary}>
          {submitLabel}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

function ProductKanbanCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: () => void;
}) {
  const { t, locale } = useLocale();

  return (
    <article className="border border-line bg-panel">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col px-3 py-3 text-left hover:bg-ash/40"
      >
        <p className="line-clamp-3 text-sm font-semibold text-ink">{product.name}</p>
        {product.variantCount > 1 ? (
          <p className="mt-2 text-[11px] font-medium text-mute">
            {t("pages.products.variantCount", { n: product.variantCount })}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-mute">
          {t("pages.products.priceLine", {
            price: formatMoney(product.listPrice, product.currency, false, locale),
          })}
        </p>
        {product.qtyOnHand > 0 ? (
          <p className="mt-1 text-[11px] text-mute">
            {t("pages.products.stockLine", {
              qty: formatNumber(product.qtyOnHand, false, locale),
            })}
          </p>
        ) : null}
      </button>
    </article>
  );
}
