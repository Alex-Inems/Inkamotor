"use client";

import { SearchCombobox } from "@/components/sales/search-combobox";
import type { Lead } from "@/lib/demo-data";
import { useLocale } from "@/lib/i18n";

const AVATAR_TONES = [
  "bg-[#31595d]",
  "bg-[#624e8a]",
  "bg-[#9f2627]",
  "bg-[#65814f]",
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

function leadInitials(name: string, email: string, company: string) {
  const base = (name || company || email.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : base.slice(0, 2);
  return (letters || "?").toUpperCase();
}

function filterLeads(leads: Lead[], query: string, limit: number) {
  const q = query.trim().toLowerCase();
  const ranked = leads
    .map((lead) => {
      const name = lead.name.trim();
      const email = lead.email.trim();
      const company = lead.company.trim();
      const haystack = `${name} ${email} ${company}`.toLowerCase();
      if (!q) return { lead, score: 0 };
      if (name.toLowerCase().startsWith(q)) return { lead, score: 0 };
      if (email.toLowerCase().startsWith(q)) return { lead, score: 1 };
      if (company.toLowerCase().startsWith(q)) return { lead, score: 2 };
      if (haystack.includes(q)) return { lead, score: 3 };
      return null;
    })
    .filter((row): row is { lead: Lead; score: number } => row !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.lead.name.localeCompare(b.lead.name);
    });

  return ranked.slice(0, limit).map((row) => row.lead);
}

function leadLabel(lead: Lead) {
  return lead.name.trim() || lead.company.trim() || lead.email.trim();
}

export function ClientSearchInput({
  value,
  onValueChange,
  onLeadSelect,
  leads,
  placeholder,
  className,
  required,
}: {
  value: string;
  onValueChange: (name: string) => void;
  onLeadSelect?: (lead: Lead) => void;
  leads: Lead[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const { t } = useLocale();

  return (
    <SearchCombobox
      value={value}
      onValueChange={onValueChange}
      onSelect={onLeadSelect}
      items={leads}
      filterItems={filterLeads}
      getItemKey={(lead) => lead.id}
      getItemLabel={leadLabel}
      placeholder={placeholder}
      className={className}
      required={required}
      emptyLabel={t("pages.sales.clientNoResults")}
      menuMinWidth={320}
      renderOption={(lead) => {
        const initials = leadInitials(lead.name, lead.email, lead.company);
        const tone = avatarTone(lead.email || lead.id || lead.name);
        const subtitle = [lead.email, lead.company].filter(Boolean).join(" · ");

        return (
          <>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${tone}`}
              aria-hidden
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {leadLabel(lead)}
              </span>
              {subtitle ? (
                <span className="block truncate text-xs text-mute">{subtitle}</span>
              ) : null}
            </span>
          </>
        );
      }}
    />
  );
}
