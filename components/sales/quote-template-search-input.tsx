"use client";

import { SearchCombobox } from "@/components/sales/search-combobox";
import {
  type OdooQuoteTemplate,
} from "@/lib/quotation-form-data";
import { useLocale } from "@/lib/i18n";

function filterTemplates(
  templates: OdooQuoteTemplate[],
  query: string,
  limit: number,
) {
  const q = query.trim().toLowerCase();
  const ranked = templates
    .map((template) => {
      const name = template.name.trim();
      if (!q) return { template, score: 0 };
      if (name.toLowerCase().startsWith(q)) return { template, score: 0 };
      if (name.toLowerCase().includes(q)) return { template, score: 1 };
      return null;
    })
    .filter(
      (row): row is { template: OdooQuoteTemplate; score: number } => row !== null,
    )
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.template.name.localeCompare(b.template.name);
    });

  return ranked.slice(0, limit).map((row) => row.template);
}

function templateInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : name.trim().slice(0, 2);
  return (letters || "?").toUpperCase();
}

export function QuoteTemplateSearchInput({
  value,
  templates,
  onTemplateSelect,
  placeholder,
  className,
}: {
  value: string;
  templates: OdooQuoteTemplate[];
  onTemplateSelect: (template: OdooQuoteTemplate) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useLocale();

  return (
    <SearchCombobox
      value={value}
      onValueChange={() => {}}
      onSelect={onTemplateSelect}
      items={templates}
      filterItems={filterTemplates}
      getItemKey={(template) => String(template.id)}
      getItemLabel={(template) => template.name}
      placeholder={placeholder}
      className={className}
      emptyLabel={t("pages.sales.templateNoResults")}
      menuMinWidth={400}
      limit={8}
      selectOnly
      renderOption={(template) => {
        const initials = templateInitials(template.name);
        const validityLabel = t("pages.sales.templateValidityDays", {
          n: template.numberOfDays,
        });
        const badges = [
          template.requireSignature ? t("pages.sales.templateSignature") : null,
          template.requirePayment ? t("pages.sales.templatePayment") : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white"
              aria-hidden
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {template.name}
              </span>
              <span className="block truncate text-xs text-mute">
                {[validityLabel, badges].filter(Boolean).join(" · ")}
              </span>
            </span>
          </>
        );
      }}
    />
  );
}
