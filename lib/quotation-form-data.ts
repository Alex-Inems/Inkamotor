import paymentTerms from "@/lib/seed/payment-terms.json";
import type { SaleLine } from "@/lib/demo-data";
import {
  SEED_QUOTE_TEMPLATES,
  type OdooQuoteTemplate,
} from "@/lib/quote-templates";

export type { OdooQuoteTemplate };
export { SEED_QUOTE_TEMPLATES as QUOTE_TEMPLATES };

export type PaymentTerm = {
  id: number;
  name: string;
  nameEn: string;
  nameEs: string;
};
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

export type QuotationOtherInfo = {
  seller: string;
  salesTeam: string;
  onlineSignature: boolean;
  onlinePayment: boolean;
  onlinePaymentPercent: number;
  customerReference: string;
  tags: string;
  taxPosition: string;
  paymentMethod: string;
  project: string;
  warehouse: string;
  incoterm: string;
  incotermLocation: string;
  shippingPolicy: string;
  deliveryDate: string;
  originalDocument: string;
  opportunity: string;
  campaign: string;
  medium: string;
  trackingSource: string;
};

export function defaultQuotationOtherInfo(
  template: OdooQuoteTemplate | null,
  t: (key: string) => string,
) {
  const delivery = new Date();
  delivery.setDate(delivery.getDate() + 14);
  delivery.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const deliveryLocal = `${delivery.getFullYear()}-${pad(delivery.getMonth() + 1)}-${pad(delivery.getDate())}T${pad(delivery.getHours())}:${pad(delivery.getMinutes())}`;

  return {
    seller: t("pages.sales.defaultSalesperson"),
    salesTeam: t("pages.sales.defaultSalesTeam"),
    onlineSignature: template?.requireSignature ?? true,
    onlinePayment: template?.requirePayment ?? false,
    onlinePaymentPercent: 100,
    customerReference: "",
    tags: "",
    taxPosition: "",
    paymentMethod: "",
    project: "",
    warehouse: t("pages.sales.defaultWarehouse"),
    incoterm: "",
    incotermLocation: "",
    shippingPolicy: t("pages.sales.shippingAsap"),
    deliveryDate: deliveryLocal,
    originalDocument: "",
    opportunity: "",
    campaign: "",
    medium: "",
    trackingSource: "",
  };
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
  const template = SEED_QUOTE_TEMPLATES[0]!;
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
