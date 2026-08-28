import { resolveLeadCompany } from "@/lib/crm/contact-details";
import { SALES_CURRENCY } from "@/lib/format";
import { seedOdooProducts } from "@/lib/seed/odoo-products";
import { enrichSale, saleBillableLines } from "@/lib/sale-quote";
import { getSupabase } from "@/lib/supabase/server";
import type { CrmMutation, CrmSnapshot } from "@/lib/crm/types";
import {
  nextInvoiceNumber,
  nextSaleNumber,
  todayIso,
  type FollowUp,
  type FollowUpStatus,
  type InquiryStatus,
  type Invoice,
  type InvoiceStatus,
  type Lead,
  type LeadSource,
  type LeadStatus,
  type Sale,
  type SaleLine,
  type SaleStatus,
  type SiteInquiry,
  type Product,
  type ProductType,
} from "@/lib/demo-data";

export type { CrmMutation, CrmSnapshot } from "@/lib/crm/types";

const PAGE = 1000;

async function selectLeadsSlim(sb: ReturnType<typeof getSupabase>) {
  const page = 1000;
  const rows: Record<string, unknown>[] = [];
  const cols =
    "id, name, email, phone, company, source, status, value, currency, owner, created_at, last_contact";
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from("leads")
      .select(cols)
      .order("created_at", { ascending: false })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows.map((row) => ({ ...row, notes: "" }));
}

async function selectAll(
  sb: ReturnType<typeof getSupabase>,
  table: string,
  column: string,
  ascending: boolean,
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .order(column, { ascending })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

function emptySnapshot(): CrmSnapshot {
  return {
    leads: [],
    invoices: [],
    siteInquiries: [],
    followUps: [],
    sales: [],
    products: [],
    googleCampaigns: [],
    metaCampaigns: [],
    newsletters: [],
  };
}

function mapInquiry(row: Record<string, unknown>): SiteInquiry {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    channel: row.channel as SiteInquiry["channel"],
    subject: String(row.subject ?? ""),
    message: String(row.message ?? ""),
    page: String(row.page ?? "/"),
    status: row.status as InquiryStatus,
    createdAt: String(row.created_at).slice(0, 10),
    leadId: row.lead_id ? String(row.lead_id) : null,
    owner: String(row.owner ?? "Team"),
  };
}

export function mapLead(row: Record<string, unknown>): Lead {
  const lead: Lead = {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone ?? ""),
    company: String(row.company ?? ""),
    source: row.source as LeadSource,
    status: row.status as LeadStatus,
    value: Number(row.value ?? 0),
    currency: "USD",
    owner: String(row.owner ?? "Team"),
    createdAt: String(row.created_at).slice(0, 10),
    lastContact: String(row.last_contact).slice(0, 10),
    notes: String(row.notes ?? ""),
  };
  return { ...lead, company: resolveLeadCompany(lead) };
}

function mapFollowUp(row: Record<string, unknown>): FollowUp {
  return {
    id: String(row.id),
    title: String(row.title),
    relatedTo: String(row.related_to ?? ""),
    relatedType: row.related_type as FollowUp["relatedType"],
    relatedId: String(row.related_id),
    dueAt: String(row.due_at).slice(0, 10),
    status: row.status as FollowUpStatus,
    owner: String(row.owner ?? "Team"),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at).slice(0, 10),
  };
}

function parseSaleLines(raw: unknown): SaleLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((line) => {
      if (!line || typeof line !== "object") return null;
      const row = line as Record<string, unknown>;
      const displayType = row.displayType ?? row.display_type ?? "product";
      return {
        description: String(row.description ?? ""),
        displayType:
          displayType === "section" || displayType === "note"
            ? displayType
            : ("product" as const),
        qty: Number(row.qty ?? row.product_uom_qty ?? 0),
        unitPrice: Number(row.unitPrice ?? row.price_unit ?? 0),
      };
    })
    .filter(Boolean) as SaleLine[];
}

function mapSale(row: Record<string, unknown>): Sale {
  const currencyRaw = String(row.currency ?? "EUR");
  const currency = currencyRaw === "USD" ? "USD" : "EUR";
  return enrichSale({
    id: String(row.id),
    number: String(row.number),
    customer: String(row.customer),
    email: String(row.email),
    product: String(row.product),
    amount: Number(row.amount ?? 0),
    currency,
    status: row.status as SaleStatus,
    source: row.source as Sale["source"],
    inquiryId: row.inquiry_id ? String(row.inquiry_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    createdAt: String(row.created_at).slice(0, 10),
    closedAt: row.closed_at ? String(row.closed_at).slice(0, 10) : null,
    notes: String(row.notes ?? ""),
    lines: parseSaleLines(row.lines),
    quoteTemplateName: String(row.quote_template_name ?? ""),
    paymentTerms: String(row.payment_terms ?? ""),
    validityDate: row.validity_date ? String(row.validity_date).slice(0, 10) : null,
    termsHtml: String(row.terms_html ?? ""),
    salesperson: String(row.salesperson ?? ""),
    invoiceId: row.invoice_id ? String(row.invoice_id) : null,
  });
}

function nextCrmOdooId(products: Product[]): number {
  const crmIds = products.filter((p) => p.odooId <= 0).map((p) => p.odooId);
  if (crmIds.length === 0) return -1;
  return Math.min(...crmIds) - 1;
}

function productInputToRow(
  id: string,
  odooId: number,
  input: {
    name: string;
    reference: string;
    category: string;
    type: ProductType;
    listPrice: number;
    currency: Product["currency"];
    qtyOnHand: number;
    variantCount: number;
    description: string;
  },
) {
  return {
    id,
    odoo_id: odooId,
    name: input.name.trim(),
    reference: input.reference.trim(),
    category: input.category.trim(),
    type: input.type,
    sale_ok: true,
    active: true,
    list_price: input.listPrice,
    currency: input.currency,
    qty_on_hand: input.qtyOnHand,
    variant_count: Math.max(1, input.variantCount),
    description: input.description.trim(),
  };
}

function mergeProducts(dbRows: Record<string, unknown>[]): Product[] {
  const dbProducts = dbRows.map((row) => mapProduct(row));
  if (dbProducts.length === 0) return seedOdooProducts();

  const dbOdooIds = new Set(dbProducts.map((p) => p.odooId));
  const dbIds = new Set(dbProducts.map((p) => p.id));
  const fromSeed = seedOdooProducts().filter(
    (p) => !dbOdooIds.has(p.odooId) && !dbIds.has(p.id),
  );

  return [...dbProducts, ...fromSeed].sort((a, b) => a.name.localeCompare(b.name));
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    odooId: Number(row.odoo_id ?? 0),
    name: String(row.name),
    reference: String(row.reference ?? ""),
    category: String(row.category ?? ""),
    type: row.type as ProductType,
    saleOk: Boolean(row.sale_ok ?? true),
    active: Boolean(row.active ?? true),
    listPrice: Number(row.list_price ?? 0),
    currency: (row.currency as Product["currency"]) ?? "EUR",
    qtyOnHand: Number(row.qty_on_hand ?? 0),
    variantCount: Number(row.variant_count ?? 1),
    description: String(row.description ?? ""),
  };
}

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    number: String(row.number),
    client: String(row.client),
    email: String(row.email),
    clientAddress: row.client_address ? String(row.client_address) : undefined,
    status: row.status as InvoiceStatus,
    issueDate: String(row.issue_date).slice(0, 10),
    dueDate: String(row.due_date).slice(0, 10),
    paidDate: row.paid_date ? String(row.paid_date).slice(0, 10) : null,
    currency: row.currency as Invoice["currency"],
    lines: (row.lines as Invoice["lines"]) ?? [],
    notes: String(row.notes ?? ""),
    saleId: row.sale_id ? String(row.sale_id) : null,
  };
}

export async function loadCrmSnapshot(): Promise<CrmSnapshot> {
  const sb = getSupabase();
  const [inquiryRows, leadRows, followUpRows, saleRows, invoiceRows, productRows] =
    await Promise.all([
      selectAll(sb, "site_inquiries", "created_at", false),
      selectLeadsSlim(sb),
      selectAll(sb, "follow_ups", "due_at", true),
      selectAll(sb, "sales", "created_at", false),
      selectAll(sb, "invoices", "issue_date", false),
      selectAll(sb, "products", "name", true).catch(() => [] as Record<string, unknown>[]),
    ]);

  const today = todayIso();
  const overdueIds = invoiceRows
    .filter(
      (row) =>
        String((row as { status?: string }).status) === "sent" &&
        String((row as { due_date?: string }).due_date).slice(0, 10) < today,
    )
    .map((row) => String((row as { id: string }).id));
  if (overdueIds.length) {
    await sb
      .from("invoices")
      .update({ status: "overdue", updated_at: new Date().toISOString() })
      .in("id", overdueIds);
  }

  return {
    ...emptySnapshot(),
    siteInquiries: inquiryRows
      .map((r) => mapInquiry(r))
      .filter((i) => !/^inq_\d+$/.test(i.id)),
    leads: leadRows
      .map((r) => mapLead(r))
      .filter((l) => !/^ld_10\d{2}$/.test(l.id)),
    followUps: followUpRows
      .map((r) => mapFollowUp(r))
      .filter((f) => !/^fu_\d+$/.test(f.id)),
    sales: saleRows.map((r) => mapSale(r)),
    products: mergeProducts(productRows),
    invoices: invoiceRows.map((r) => {
      const mapped = mapInvoice(r as Record<string, unknown>);
      if (overdueIds.includes(mapped.id) && mapped.status === "sent") {
        return { ...mapped, status: "overdue" as const };
      }
      return mapped;
    }),
  };
}

export async function applyCrmMutation(mutation: CrmMutation): Promise<CrmSnapshot> {
  const sb = getSupabase();
  const day = todayIso();

  switch (mutation.op) {
    case "addLead": {
      const email = mutation.input.email.trim().toLowerCase();
      const id = `ld_${email}`;
      const { error } = await sb.from("leads").upsert(
        {
          id,
          name: mutation.input.name,
          email,
          phone: mutation.input.phone,
          company: mutation.input.company,
          source: mutation.input.source,
          status: mutation.input.status,
          value: mutation.input.value,
          currency: "USD",
          owner: mutation.input.owner,
          created_at: day,
          last_contact: day,
          notes: mutation.input.notes,
        },
        { onConflict: "id" },
      );
      if (error) throw new Error(error.message);
      break;
    }
    case "updateLeadStatus": {
      const { error } = await sb
        .from("leads")
        .update({ status: mutation.status, last_contact: day })
        .eq("id", mutation.id);
      if (error) throw new Error(error.message);
      break;
    }
    case "addInvoice": {
      const snap = await loadCrmSnapshot();
      const id = `inv_${Date.now()}`;
      const number = nextInvoiceNumber(snap.invoices);
      const { error } = await sb.from("invoices").insert({
        id,
        number,
        client: mutation.input.client,
        email: mutation.input.email,
        client_address: mutation.input.clientAddress || null,
        status: mutation.input.sendNow ? "sent" : "draft",
        issue_date: day,
        due_date: mutation.input.dueDate,
        paid_date: null,
        currency: SALES_CURRENCY,
        lines: mutation.input.lines,
        notes: mutation.input.notes,
      });
      if (error) throw new Error(error.message);
      break;
    }
    case "updateInvoiceStatus": {
      const { error } = await sb
        .from("invoices")
        .update({
          status: mutation.status,
          paid_date: mutation.status === "paid" ? day : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mutation.id);
      if (error) throw new Error(error.message);
      break;
    }
    case "updateInquiryStatus": {
      const { error } = await sb
        .from("site_inquiries")
        .update({ status: mutation.status })
        .eq("id", mutation.id);
      if (error) throw new Error(error.message);
      break;
    }
    case "convertInquiryToLead": {
      const { data: inquiry, error: findErr } = await sb
        .from("site_inquiries")
        .select("*")
        .eq("id", mutation.id)
        .maybeSingle();
      if (findErr) throw new Error(findErr.message);
      if (!inquiry || inquiry.lead_id) break;
      const leadId = `ld_${Date.now()}`;
      const fuId = `fu_${Date.now()}`;
      const { error: leadErr } = await sb.from("leads").insert({
        id: leadId,
        name: inquiry.name,
        email: inquiry.email,
        phone: "—",
        company: inquiry.channel === "wholesale" ? inquiry.name : "Personal",
        source: "website",
        status: "new",
        value: inquiry.channel === "wholesale" ? 2500 : 150,
        currency: "USD",
        owner: inquiry.owner ?? "Team",
        created_at: day,
        last_contact: day,
        notes: `Converted from inkamototours.com (${inquiry.channel}): ${inquiry.subject}`,
      });
      if (leadErr) throw new Error(leadErr.message);
      const { error: fuErr } = await sb.from("follow_ups").insert({
        id: fuId,
        title: `Follow up with ${inquiry.name}`,
        related_to: `${inquiry.name} · ${inquiry.subject}`,
        related_type: "lead",
        related_id: leadId,
        due_at: day,
        status: "open",
        owner: inquiry.owner ?? "Team",
        notes: `Auto-created from site inquiry ${inquiry.id}`,
        created_at: day,
      });
      if (fuErr) throw new Error(fuErr.message);
      const { error: upErr } = await sb
        .from("site_inquiries")
        .update({ status: "converted", lead_id: leadId })
        .eq("id", mutation.id);
      if (upErr) throw new Error(upErr.message);
      break;
    }
    case "addFollowUp": {
      const id = `fu_${Date.now()}`;
      const { error } = await sb.from("follow_ups").insert({
        id,
        title: mutation.input.title,
        related_to: mutation.input.relatedTo,
        related_type: mutation.input.relatedType,
        related_id: mutation.input.relatedId,
        due_at: mutation.input.dueAt,
        status: "open",
        owner: mutation.input.owner,
        notes: mutation.input.notes,
        created_at: day,
      });
      if (error) throw new Error(error.message);
      break;
    }
    case "updateFollowUpStatus": {
      const { error } = await sb
        .from("follow_ups")
        .update({ status: mutation.status })
        .eq("id", mutation.id);
      if (error) throw new Error(error.message);
      break;
    }
    case "addSale": {
      const snap = await loadCrmSnapshot();
      const id = `sale_${Date.now()}`;
      const number = nextSaleNumber(snap.sales);
      const status = mutation.input.status ?? "pending";
      const { error } = await sb.from("sales").insert({
        id,
        number,
        customer: mutation.input.customer,
        email: mutation.input.email,
        product: mutation.input.product,
        amount: mutation.input.amount,
        currency: SALES_CURRENCY,
        status,
        source: mutation.input.source,
        inquiry_id: mutation.input.inquiryId,
        lead_id: mutation.input.leadId,
        created_at: day,
        closed_at: null,
        notes: mutation.input.notes,
        lines: mutation.input.lines,
        quote_template_name: mutation.input.quoteTemplateName,
        payment_terms: mutation.input.paymentTerms,
        validity_date: mutation.input.validityDate,
        terms_html: mutation.input.termsHtml,
        salesperson: mutation.input.salesperson,
        invoice_id: null,
      });
      if (error) throw new Error(error.message);
      break;
    }
    case "updateSaleStatus": {
      const closed =
        mutation.status === "fulfilled" || mutation.status === "cancelled"
          ? day
          : null;
      const { error } = await sb
        .from("sales")
        .update({ status: mutation.status, closed_at: closed })
        .eq("id", mutation.id);
      if (error) throw new Error(error.message);
      break;
    }
    case "deleteSale": {
      const { error: invErr } = await sb
        .from("invoices")
        .update({ sale_id: null })
        .eq("sale_id", mutation.id);
      if (invErr) throw new Error(invErr.message);
      const { error } = await sb.from("sales").delete().eq("id", mutation.id);
      if (error) throw new Error(error.message);
      break;
    }
    case "addProduct": {
      const snap = await loadCrmSnapshot();
      const id = `prod_${Date.now()}`;
      const odooId = nextCrmOdooId(snap.products);
      const { error } = await sb.from("products").insert(
        productInputToRow(id, odooId, mutation.input),
      );
      if (error) throw new Error(error.message);
      break;
    }
    case "updateProduct": {
      const { data: existing, error: findErr } = await sb
        .from("products")
        .select("odoo_id")
        .eq("id", mutation.id)
        .maybeSingle();
      if (findErr) throw new Error(findErr.message);
      let odooId = existing ? Number(existing.odoo_id) : null;
      if (odooId == null) {
        const snap = await loadCrmSnapshot();
        const product = snap.products.find((p) => p.id === mutation.id);
        if (!product) throw new Error("Product not found");
        odooId = product.odooId;
      }
      const { error } = await sb.from("products").upsert(
        productInputToRow(mutation.id, odooId, mutation.input),
        { onConflict: "id" },
      );
      if (error) throw new Error(error.message);
      break;
    }
    case "addInvoiceFromSale": {
      const snap = await loadCrmSnapshot();
      const sale = snap.sales.find((s) => s.id === mutation.saleId);
      if (!sale) throw new Error("Sale not found");
      if (sale.invoiceId) break;

      const billable = saleBillableLines(sale);
      const lines =
        billable.length > 0
          ? billable.map((line) => ({
              description: line.description,
              qty: line.qty,
              unitPrice: line.unitPrice,
            }))
          : [{ description: sale.product, qty: 1, unitPrice: sale.amount }];

      const id = `inv_${Date.now()}`;
      const number = nextInvoiceNumber(snap.invoices);
      const due = new Date(day);
      due.setDate(due.getDate() + 30);
      const dueDate = due.toISOString().slice(0, 10);

      const { error: invErr } = await sb.from("invoices").insert({
        id,
        number,
        client: sale.customer,
        email: sale.email,
        client_address: null,
        status: "draft",
        issue_date: day,
        due_date: dueDate,
        paid_date: null,
        currency: SALES_CURRENCY,
        lines,
        notes: `Generated from order ${sale.number}.`,
        sale_id: sale.id,
      });
      if (invErr) throw new Error(invErr.message);

      const { error: saleErr } = await sb
        .from("sales")
        .update({ invoice_id: id })
        .eq("id", sale.id);
      if (saleErr) throw new Error(saleErr.message);
      break;
    }
    default:
      throw new Error("Unknown mutation");
  }

  return loadCrmSnapshot();
}

export async function insertSiteInquiry(input: {
  name: string;
  email: string;
  subject?: string;
  message?: string;
  page?: string;
  channel?: SiteInquiry["channel"];
}) {
  const sb = getSupabase();
  const id = `inq_${Date.now()}`;
  const { error } = await sb.from("site_inquiries").insert({
    id,
    name: input.name,
    email: input.email,
    channel: input.channel ?? "contact_form",
    subject: input.subject ?? "Website inquiry",
    message: input.message ?? "",
    page: input.page ?? "/",
    status: "new",
    owner: process.env.CRM_DEFAULT_OWNER?.trim() || "Team",
  });
  if (error) throw new Error(error.message);
  return id;
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const snap = await loadCrmSnapshot();
  return snap.sales.find((sale) => sale.id === id) ?? null;
}
