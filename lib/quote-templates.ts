import seedTemplates from "@/lib/seed/odoo-quote-templates.json";
import type { SaleLine } from "@/lib/demo-data";

export type OdooQuoteTemplate = {
  id: number;
  name: string;
  numberOfDays: number;
  requireSignature: boolean;
  requirePayment: boolean;
  noteHtml: string;
  lines: SaleLine[];
};

export const SEED_QUOTE_TEMPLATES = seedTemplates as OdooQuoteTemplate[];

export const QUOTE_TEMPLATES_STORAGE_KEY = "inkamoto-quote-templates-v1";

export function cloneSaleLines(lines: SaleLine[]): SaleLine[] {
  return lines.map((line) => ({ ...line }));
}

export function isBoilerplateLine(line: SaleLine) {
  return line.displayType === "section" || line.displayType === "note";
}

export function isTripSectionLine(line: SaleLine) {
  return line.displayType === "section";
}

/** Product lines first (directly under “Voyage du…”), then sections/notes. */
export function orderQuotationBodyLines(
  lines: SaleLine[],
  options?: { ensureProduct?: boolean },
): SaleLine[] {
  const products = lines.filter((line) => line.displayType === "product");
  const rest = lines.filter((line) => line.displayType !== "product");
  if (products.length === 0 && options?.ensureProduct) {
    return [emptyProductLine(), ...rest];
  }
  return [...products, ...rest];
}

/**
 * Document/PDF order: keep the leading trip section (“Voyage du…”),
 * then products, then the rest — even for older quotes saved with products last.
 */
export function orderQuotationDocumentLines(lines: SaleLine[]): SaleLine[] {
  const products = lines.filter((line) => line.displayType === "product");
  if (products.length === 0) return lines;
  const rest = lines.filter((line) => line.displayType !== "product");
  if (rest[0]?.displayType === "section") {
    return [rest[0]!, ...products, ...rest.slice(1)];
  }
  return [...products, ...rest];
}

/** Trip section on the quote — label + dates (e.g. "Voyage du 12 juin…"). */
export function formatTripForSection(trip: string, voyageLabel: string) {
  const trimmed = trip.trim();
  if (!trimmed) return "";
  const label = voyageLabel.trim();
  if (label && new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(trimmed)) {
    return trimmed;
  }
  return label ? `${label} ${trimmed}` : trimmed;
}

export function tripSectionLine(tripName: string): SaleLine {
  return {
    description: tripName.trim(),
    displayType: "section",
    qty: 0,
    unitPrice: 0,
  };
}

/** @deprecated Use tripSectionLine */
export const voyageSectionLine = tripSectionLine;

export function parseStoredQuotationLines(lines: SaleLine[]): {
  trip: string;
  bodyLines: SaleLine[];
} {
  if (lines.length > 0 && lines[0]?.displayType === "section") {
    const raw = lines[0]!.description.trim();
    const trip =
      raw
        .replace(/^voyage\s+/i, "")
        .replace(/^trip\s+/i, "")
        .replace(/^viaje\s+/i, "")
        .trim() || raw;
    return {
      trip,
      bodyLines: orderQuotationBodyLines(lines.slice(1), { ensureProduct: true }),
    };
  }
  return {
    trip: "",
    bodyLines: orderQuotationBodyLines(lines, { ensureProduct: true }),
  };
}

export function buildQuotationLines(
  trip: string,
  bodyLines: SaleLine[],
  voyageLabel = "Voyage",
): SaleLine[] {
  const ordered = orderQuotationBodyLines(bodyLines, { ensureProduct: true });
  const formatted = formatTripForSection(trip, voyageLabel);
  if (!formatted) return ordered;
  return [tripSectionLine(formatted), ...ordered];
}

/** @deprecated Use parseStoredQuotationLines().trip */
export function parseStoredQuotationLinesLegacy(lines: SaleLine[]) {
  const parsed = parseStoredQuotationLines(lines);
  return { voyage: parsed.trip, bodyLines: parsed.bodyLines };
}

/** Replace template boilerplate; keep product lines under the trip heading. */
export function applyTemplateToQuotationLines(
  current: SaleLine[],
  template: OdooQuoteTemplate,
): SaleLine[] {
  const boilerplate = cloneSaleLines(template.lines);
  const products = current.filter((line) => line.displayType === "product");
  const hasProduct = products.some((line) => line.description.trim());
  const productLines = hasProduct ? products : [emptyProductLine()];
  return [...productLines, ...boilerplate];
}

export function emptyProductLine(): SaleLine {
  return {
    description: "",
    displayType: "product",
    qty: 1,
    unitPrice: 0,
  };
}

export function defaultTemplateBoilerplate(t: (key: string) => string): SaleLine[] {
  return [
    {
      description: t("pages.sales.includedSection"),
      displayType: "section",
      qty: 0,
      unitPrice: 0,
    },
    {
      description: "",
      displayType: "note",
      qty: 0,
      unitPrice: 0,
    },
    {
      description: t("pages.sales.excludedSection"),
      displayType: "section",
      qty: 0,
      unitPrice: 0,
    },
    {
      description: "",
      displayType: "note",
      qty: 0,
      unitPrice: 0,
    },
    {
      description: t("pages.sales.noteSection"),
      displayType: "section",
      qty: 0,
      unitPrice: 0,
    },
    {
      description: "",
      displayType: "note",
      qty: 0,
      unitPrice: 0,
    },
  ];
}

export function nextQuoteTemplateId(templates: OdooQuoteTemplate[]) {
  const max = templates.reduce((n, row) => Math.max(n, row.id), 0);
  return max + 1;
}

export function loadQuoteTemplates(): OdooQuoteTemplate[] {
  if (typeof window === "undefined") return cloneTemplates(SEED_QUOTE_TEMPLATES);
  try {
    const raw = window.localStorage.getItem(QUOTE_TEMPLATES_STORAGE_KEY);
    if (!raw) return cloneTemplates(SEED_QUOTE_TEMPLATES);
    const parsed = JSON.parse(raw) as OdooQuoteTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return cloneTemplates(SEED_QUOTE_TEMPLATES);
    }
    return parsed.map((row) => {
      const seed = SEED_QUOTE_TEMPLATES.find((s) => s.id === row.id);
      const lines =
        Array.isArray(row.lines) && row.lines.length > 0
          ? row.lines
          : (seed?.lines ?? []);
      return {
        ...row,
        lines: cloneSaleLines(lines),
      };
    });
  } catch {
    return cloneTemplates(SEED_QUOTE_TEMPLATES);
  }
}

export function persistQuoteTemplates(templates: OdooQuoteTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUOTE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

export function resetQuoteTemplatesToSeed() {
  persistQuoteTemplates(cloneTemplates(SEED_QUOTE_TEMPLATES));
  return cloneTemplates(SEED_QUOTE_TEMPLATES);
}

function cloneTemplates(rows: OdooQuoteTemplate[]) {
  return rows.map((row) => ({
    ...row,
    lines: cloneSaleLines(row.lines ?? []),
  }));
}

export function getQuoteTemplateByName(
  templates: OdooQuoteTemplate[],
  name: string,
) {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  return templates.find((row) => row.name.trim().toLowerCase() === key) ?? null;
}

export function getQuoteTemplateById(templates: OdooQuoteTemplate[], id: number) {
  return templates.find((row) => row.id === id) ?? null;
}
