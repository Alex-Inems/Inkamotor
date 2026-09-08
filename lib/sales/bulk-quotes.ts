import {
  parseLeadDetails,
  tagList,
} from "@/lib/crm/contact-details";
import { mapLead, loadCrmSnapshot } from "@/lib/crm/repository";
import type { Lead, Sale, SaleLine } from "@/lib/demo-data";
import { nextSaleNumber, todayIso } from "@/lib/demo-data";
import { SALES_CURRENCY } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import {
  PAYMENT_TERMS,
  defaultValidityDate,
  linesTotal,
  primaryProductLabel,
} from "@/lib/quotation-form-data";
import { applyLocalizedTemplateToQuotationLines } from "@/lib/quote-template-lines";
import { getTemplateNoteHtml } from "@/lib/quote-template-terms";
import {
  SEED_QUOTE_TEMPLATES,
  buildQuotationLines,
  type OdooQuoteTemplate,
} from "@/lib/quote-templates";
import { getSupabase } from "@/lib/supabase/server";

export { BULK_QUOTE_BATCH } from "@/lib/sales/bulk-quote-constants";

export type BulkQuoteRecipient = {
  leadId: string;
  name: string;
  email: string;
  hasExistingSale: boolean;
};

export function findQuoteTemplate(
  name?: string | null,
  templates: OdooQuoteTemplate[] = SEED_QUOTE_TEMPLATES,
): OdooQuoteTemplate {
  const want = name?.trim();
  if (want) {
    const hit = templates.find((row) => row.name === want);
    if (hit) return hit;
  }
  return templates[0] ?? SEED_QUOTE_TEMPLATES[0]!;
}

/** Same shape as a single /sales/new quotation: trip + template services + product + terms. */
export function buildBulkQuotationContent(input: {
  product: string;
  amount: number;
  template: OdooQuoteTemplate;
  locale: Locale;
  trip?: string;
  voyageLabel?: string;
  lines?: SaleLine[] | null;
  termsHtml?: string | null;
  paymentTerms?: string | null;
  validityDate?: string | null;
}) {
  const product =
    input.product.trim() || input.template.name;
  const amount = Number.isFinite(input.amount) ? Math.max(0, input.amount) : 0;

  const bodyLines =
    input.lines && input.lines.length > 0
      ? input.lines
      : applyLocalizedTemplateToQuotationLines(
          [
            {
              description: product,
              displayType: "product",
              qty: 1,
              unitPrice: amount,
            },
          ],
          input.template,
          input.locale,
        );

  const saleLines = buildQuotationLines(
    input.trip ?? "",
    bodyLines,
    input.voyageLabel ?? "Voyage",
  );

  const termsHtml =
    (input.termsHtml?.trim() ||
      getTemplateNoteHtml(input.template, input.locale) ||
      input.template.noteHtml ||
      "").trim();

  const paymentTerms =
    input.paymentTerms?.trim() || PAYMENT_TERMS[1]?.name || "";

  const validityDate =
    input.validityDate?.trim() ||
    defaultValidityDate(input.template.numberOfDays);

  return {
    lines: saleLines,
    product: primaryProductLabel(saleLines) || product,
    amount: linesTotal(saleLines) || amount,
    termsHtml,
    paymentTerms,
    validityDate,
    quoteTemplateName: input.template.name,
  };
}

export async function listLeadsByTag(tag: string): Promise<Lead[]> {
  const want = tag.trim().toLowerCase();
  if (!want) return [];

  const sb = getSupabase();
  const page = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from("leads")
      .select(
        "id, name, email, phone, company, source, status, value, currency, owner, created_at, last_contact, notes",
      )
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < page) break;
  }

  return rows
    .map((row) => mapLead(row))
    .filter((lead) => {
      const tags = tagList(parseLeadDetails(lead).tags).map((t) =>
        t.toLowerCase(),
      );
      return tags.includes(want);
    });
}

export async function previewBulkQuoteRecipients(
  tag: string,
): Promise<{
  tag: string;
  recipients: BulkQuoteRecipient[];
  sendable: number;
  skippedNoEmail: number;
  withExistingSale: number;
}> {
  const leads = await listLeadsByTag(tag);
  const snap = await loadCrmSnapshot();
  const saleByLead = new Set(
    snap.sales
      .filter((sale) => sale.leadId && sale.status !== "cancelled")
      .map((sale) => sale.leadId as string),
  );

  let skippedNoEmail = 0;
  let withExistingSale = 0;
  const recipients: BulkQuoteRecipient[] = [];

  for (const lead of leads) {
    const email = lead.email.trim().toLowerCase();
    if (!email.includes("@") || email.endsWith("@inkamototours.local")) {
      skippedNoEmail += 1;
      continue;
    }
    const hasExistingSale = saleByLead.has(lead.id);
    if (hasExistingSale) withExistingSale += 1;
    recipients.push({
      leadId: lead.id,
      name: lead.name,
      email,
      hasExistingSale,
    });
  }

  return {
    tag: tag.trim(),
    recipients,
    sendable: recipients.filter((r) => !r.hasExistingSale).length,
    skippedNoEmail,
    withExistingSale,
  };
}

export async function createAndSendBulkQuoteBatch(input: {
  leadIds: string[];
  product: string;
  amount: number;
  quoteTemplateName?: string;
  trip?: string;
  voyageLabel?: string;
  lines?: SaleLine[] | null;
  termsHtml?: string | null;
  paymentTerms?: string | null;
  validityDate?: string | null;
  message?: string | null;
  skipExisting?: boolean;
  locale: Locale;
}): Promise<{
  results: {
    leadId: string;
    email: string;
    saleId?: string;
    saleNumber?: string;
    ok: boolean;
    skipped?: boolean;
    error?: string;
  }[];
}> {
  const { sendSaleQuoteEmail } = await import("@/lib/mail/send-quote");
  const { enrichSale } = await import("@/lib/sale-quote");

  const template = findQuoteTemplate(input.quoteTemplateName);
  const content = buildBulkQuotationContent({
    product: input.product,
    amount: input.amount,
    template,
    locale: input.locale,
    trip: input.trip,
    voyageLabel: input.voyageLabel,
    lines: input.lines,
    termsHtml: input.termsHtml,
    paymentTerms: input.paymentTerms,
    validityDate: input.validityDate,
  });
  const skipExisting = input.skipExisting !== false;

  const leads = await listLeadsByIds(input.leadIds);
  const snap = await loadCrmSnapshot();
  const saleByLead = new Set(
    snap.sales
      .filter((sale) => sale.leadId && sale.status !== "cancelled")
      .map((sale) => sale.leadId as string),
  );

  const results: {
    leadId: string;
    email: string;
    saleId?: string;
    saleNumber?: string;
    ok: boolean;
    skipped?: boolean;
    error?: string;
  }[] = [];

  let numberSeed = [...snap.sales];

  for (const leadId of input.leadIds) {
    const lead = leads.get(leadId);
    if (!lead) {
      results.push({
        leadId,
        email: "",
        ok: false,
        error: "Lead not found",
      });
      continue;
    }
    const email = lead.email.trim().toLowerCase();
    if (!email.includes("@")) {
      results.push({
        leadId,
        email,
        ok: false,
        skipped: true,
        error: "Missing email",
      });
      continue;
    }
    if (skipExisting && saleByLead.has(lead.id)) {
      results.push({
        leadId,
        email,
        ok: false,
        skipped: true,
        error: "Already has a quotation",
      });
      continue;
    }

    const saleId = `sale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const number = nextSaleNumber(numberSeed);
    const day = todayIso();
    const saleRow = {
      id: saleId,
      number,
      customer: lead.name,
      email,
      product: content.product,
      amount: content.amount,
      currency: SALES_CURRENCY,
      status: "pending" as const,
      source: "lead" as const,
      inquiry_id: null,
      lead_id: lead.id,
      created_at: day,
      closed_at: null,
      notes: [
        lead.notes?.trim() || "",
        `Bulk quotation for tag (template: ${content.quoteTemplateName}).`,
      ]
        .filter(Boolean)
        .join("\n"),
      lines: content.lines,
      quote_template_name: content.quoteTemplateName,
      payment_terms: content.paymentTerms,
      validity_date: content.validityDate,
      terms_html: content.termsHtml,
      salesperson: "Jorge",
      invoice_id: null,
    };

    const sb = getSupabase();
    const { error: insertErr } = await sb.from("sales").insert(saleRow);
    if (insertErr) {
      results.push({
        leadId,
        email,
        ok: false,
        error: insertErr.message,
      });
      continue;
    }

    const sale: Sale = {
      id: saleId,
      number,
      customer: lead.name,
      email,
      product: content.product,
      amount: content.amount,
      currency: SALES_CURRENCY,
      status: "pending",
      source: "lead",
      inquiryId: null,
      leadId: lead.id,
      createdAt: day,
      closedAt: null,
      notes: saleRow.notes,
      lines: content.lines,
      quoteTemplateName: content.quoteTemplateName,
      paymentTerms: content.paymentTerms,
      validityDate: content.validityDate,
      termsHtml: content.termsHtml,
      salesperson: "Jorge",
      invoiceId: null,
    };

    numberSeed = [...numberSeed, sale];
    saleByLead.add(lead.id);

    try {
      await sendSaleQuoteEmail({
        sale: enrichSale(sale),
        locale: input.locale,
        message: input.message?.trim() || null,
      });
      await sb.from("sales").update({ status: "sent" }).eq("id", saleId);
      results.push({
        leadId,
        email,
        saleId,
        saleNumber: number,
        ok: true,
      });
    } catch (err) {
      results.push({
        leadId,
        email,
        saleId,
        saleNumber: number,
        ok: false,
        error: err instanceof Error ? err.message : "Send failed",
      });
    }
  }

  return { results };
}

async function listLeadsByIds(ids: string[]): Promise<Map<string, Lead>> {
  const map = new Map<string, Lead>();
  if (ids.length === 0) return map;
  const sb = getSupabase();
  const chunk = 80;
  for (let i = 0; i < ids.length; i += chunk) {
    const batch = ids.slice(i, i + chunk);
    const { data, error } = await sb
      .from("leads")
      .select(
        "id, name, email, phone, company, source, status, value, currency, owner, created_at, last_contact, notes",
      )
      .in("id", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const lead = mapLead(row as Record<string, unknown>);
      map.set(lead.id, lead);
    }
  }
  return map;
}
