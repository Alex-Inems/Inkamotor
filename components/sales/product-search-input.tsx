"use client";

import { SearchCombobox } from "@/components/sales/search-combobox";
import type { Product } from "@/lib/demo-data";
import { SalesAmount } from "@/components/sales/sales-amount";
import { useLocale } from "@/lib/i18n";

const PRODUCT_TONES = [
  "bg-[#31595d]",
  "bg-[#624e8a]",
  "bg-[#65814f]",
  "bg-[#8a7a3a]",
  "bg-[#5a8a8a]",
  "bg-[#9f2627]",
];

function productTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return PRODUCT_TONES[hash % PRODUCT_TONES.length]!;
}

function productInitials(name: string) {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : name.trim().slice(0, 2);
  return (letters || "?").toUpperCase();
}

function filterProducts(products: Product[], query: string, limit: number) {
  const q = query.trim().toLowerCase();
  const ranked = products
    .map((product) => {
      const name = product.name.trim();
      const reference = product.reference.trim();
      const category = product.category.trim();
      const description = product.description.trim();
      const haystack = `${name} ${reference} ${category} ${description}`.toLowerCase();
      if (!q) return { product, score: 0 };
      if (name.toLowerCase().startsWith(q)) return { product, score: 0 };
      if (reference.toLowerCase().startsWith(q)) return { product, score: 1 };
      if (category.toLowerCase().startsWith(q)) return { product, score: 2 };
      if (haystack.includes(q)) return { product, score: 3 };
      return null;
    })
    .filter((row): row is { product: Product; score: number } => row !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.product.name.localeCompare(b.product.name);
    });

  return ranked.slice(0, limit).map((row) => row.product);
}

export function ProductSearchInput({
  value,
  onValueChange,
  onProductSelect,
  products,
  placeholder,
  className,
}: {
  value: string;
  onValueChange: (name: string) => void;
  onProductSelect?: (product: Product) => void;
  products: Product[];
  placeholder?: string;
  className?: string;
}) {
  const { t, locale } = useLocale();

  return (
    <SearchCombobox
      value={value}
      onValueChange={onValueChange}
      onSelect={onProductSelect}
      items={products}
      filterItems={filterProducts}
      getItemKey={(product) => product.id}
      getItemLabel={(product) => product.name}
      placeholder={placeholder}
      className={className}
      emptyLabel={t("pages.sales.productNoResults")}
      menuMinWidth={360}
      renderOption={(product) => {
        const initials = productInitials(product.name);
        const tone = productTone(product.id || product.name);
        const subtitle = [product.reference, product.category]
          .filter(Boolean)
          .join(" · ");

        return (
          <>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white ${tone}`}
              aria-hidden
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{product.name}</span>
              {subtitle ? (
                <span className="block truncate text-xs text-mute">{subtitle}</span>
              ) : null}
            </span>
            <SalesAmount amount={product.listPrice} locale={locale} className="shrink-0 pl-2" />
          </>
        );
      }}
    />
  );
}
