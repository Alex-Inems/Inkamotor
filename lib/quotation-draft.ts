import type { SaleLine } from "@/lib/demo-data";

export type QuotationDraft = {
  customer: string;
  email: string;
  quoteTemplateName: string;
  validityDate: string;
  paymentTerms: string;
  lines: SaleLine[];
};

const STORAGE_KEY = "inkamoto-quotation-draft";

export function saveQuotationDraft(draft: QuotationDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function loadQuotationDraft(): QuotationDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuotationDraft;
  } catch {
    return null;
  }
}

export function clearQuotationDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
