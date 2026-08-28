import templates from "@/lib/seed/odoo-quote-templates.json";
import paymentTerms from "@/lib/seed/payment-terms.json";
import type { SaleLine } from "@/lib/demo-data";

export type OdooQuoteTemplate = {
  id: number;
  name: string;
  numberOfDays: number;
  requireSignature: boolean;
  requirePayment: boolean;
  noteHtml: string;
};

export type PaymentTerm = {
  id: number;
  name: string;
  nameEn: string;
  nameEs: string;
};

export const QUOTE_TEMPLATES = templates as OdooQuoteTemplate[];
export const PAYMENT_TERMS = paymentTerms as PaymentTerm[];

export function getPaymentTermLabel(term: PaymentTerm, locale: string) {
  if (locale === "en") return term.nameEn;
  if (locale === "es") return term.nameEs;
  return term.name;
}

export function defaultValidityDate(days = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function emptyQuotationLine(): SaleLine {
  return {
    description: "",
    displayType: "product",
    qty: 1,
    unitPrice: 0,
  };
}

export function lineTotal(line: SaleLine) {
  if (line.displayType !== "product") return 0;
  return line.qty * line.unitPrice;
}

export function linesTotal(lines: SaleLine[]) {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function primaryProductLabel(lines: SaleLine[]) {
  const product = lines.find((line) => line.displayType === "product");
  return product?.description.trim() || "Circuit moto Inkamoto";
}

export function quickSaleInput(input: {
  customer: string;
  email: string;
  product: string;
  amount: number;
  source: import("@/lib/demo-data").Sale["source"];
  inquiryId: string | null;
  leadId: string | null;
  notes: string;
}) {
  const template = QUOTE_TEMPLATES[0]!;
  return {
    ...input,
    currency: "EUR" as const,
    lines: [
      {
        description: input.product,
        displayType: "product" as const,
        qty: 1,
        unitPrice: input.amount,
      },
    ],
    quoteTemplateName: template.name,
    paymentTerms: PAYMENT_TERMS[1]?.name ?? "",
    validityDate: defaultValidityDate(template.numberOfDays),
    termsHtml: template.noteHtml,
    salesperson: "Jorge",
  };
}
