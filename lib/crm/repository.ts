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
  type SaleStatus,
  type SiteInquiry,
} from "@/lib/demo-data";

export type { CrmMutation, CrmSnapshot } from "@/lib/crm/types";

function emptySnapshot(): CrmSnapshot {
  return {
    leads: [],
    invoices: [],
    siteInquiries: [],
    followUps: [],
    sales: [],
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

function mapLead(row: Record<string, unknown>): Lead {
  return {
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

function mapSale(row: Record<string, unknown>): Sale {
  return {
    id: String(row.id),
    number: String(row.number),
    customer: String(row.customer),
    email: String(row.email),
    product: String(row.product),
    amount: Number(row.amount ?? 0),
    currency: "USD",
    status: row.status as SaleStatus,
    source: row.source as Sale["source"],
    inquiryId: row.inquiry_id ? String(row.inquiry_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    createdAt: String(row.created_at).slice(0, 10),
    closedAt: row.closed_at ? String(row.closed_at).slice(0, 10) : null,
    notes: String(row.notes ?? ""),
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
  };
}

export async function loadCrmSnapshot(): Promise<CrmSnapshot> {
  try {
    const { syncLeadsFromInbox } = await import("@/lib/crm/inbox-leads");
    await syncLeadsFromInbox();
  } catch {
    /* Inbox may be empty or mail tables missing — still load the rest. */
  }

  const sb = getSupabase();
  const [inquiries, leads, followUps, sales, invoices] = await Promise.all([
    sb.from("site_inquiries").select("*").order("created_at", { ascending: false }),
    sb.from("leads").select("*").order("created_at", { ascending: false }),
    sb.from("follow_ups").select("*").order("due_at", { ascending: true }),
    sb.from("sales").select("*").order("created_at", { ascending: false }),
    sb.from("invoices").select("*").order("issue_date", { ascending: false }),
  ]);

  const err =
    inquiries.error ||
    leads.error ||
    followUps.error ||
    sales.error ||
    invoices.error;
  if (err) throw new Error(err.message);

  const today = todayIso();
  const overdueIds = (invoices.data ?? [])
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
    siteInquiries: (inquiries.data ?? [])
      .map((r) => mapInquiry(r as Record<string, unknown>))
      .filter((i) => !/^inq_\d+$/.test(i.id)),
    leads: (leads.data ?? [])
      .map((r) => mapLead(r as Record<string, unknown>))
      .filter((l) => !/^ld_10\d{2}$/.test(l.id)),
    followUps: (followUps.data ?? [])
      .map((r) => mapFollowUp(r as Record<string, unknown>))
      .filter((f) => !/^fu_\d+$/.test(f.id)),
    sales: (sales.data ?? []).map((r) => mapSale(r as Record<string, unknown>)),
    invoices: (invoices.data ?? []).map((r) => {
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
        currency: mutation.input.currency,
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
      const { error } = await sb.from("sales").insert({
        id,
        number,
        customer: mutation.input.customer,
        email: mutation.input.email,
        product: mutation.input.product,
        amount: mutation.input.amount,
        currency: "USD",
        status: "pending",
        source: mutation.input.source,
        inquiry_id: mutation.input.inquiryId,
        lead_id: mutation.input.leadId,
        created_at: day,
        closed_at: null,
        notes: mutation.input.notes,
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
