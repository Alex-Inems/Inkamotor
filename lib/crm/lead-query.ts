import {
  clampPriority,
  completenessScore,
  contactWriteFromLead,
  leadSearchText,
  parseLeadDetails,
  serializeContactNotes,
  tagList,
  withResolvedCompany,
  type ContactDetails,
  type ContactWrite,
  type LeadPriority,
} from "@/lib/crm/contact-details";
import { isValidStageId } from "@/lib/crm/pipeline";
import { mapLead } from "@/lib/crm/repository";
import type { Lead, LeadStatus } from "@/lib/demo-data";
import { getSupabase } from "@/lib/supabase/server";

export type LeadTableRow = {
  lead: Lead;
  details: ContactDetails;
  score: number;
};

export type LeadListQuery = {
  q?: string;
  stage?: LeadStatus | "all";
  country?: string;
  /** Exact tag match (Étiquettes), case-insensitive */
  tag?: string;
  kind?: "all" | "person" | "company";
  sort?: "completeness" | "name" | "email" | "updated";
  dir?: "asc" | "desc";
  page?: number;
  limit?: number;
  /** Balanced sample per stage for the pipeline board */
  kanban?: boolean;
};

type CachedLead = LeadTableRow & { haystack: string };

const LIST_COLS =
  "id, name, email, phone, company, source, status, value, currency, owner, created_at, last_contact, notes";

const PAGE = 1000;
const TTL_MS = 5 * 60 * 1000;
const CATALOG_VERSION = 4;

let catalog: { rows: CachedLead[]; at: number; v: number } | null = null;
let inflight: Promise<CachedLead[]> | null = null;

function safeFilter(value: string) {
  return value.replace(/[%_(),.*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function compareRows(
  a: CachedLead,
  b: CachedLead,
  sort: LeadListQuery["sort"],
  dir: "asc" | "desc",
) {
  const completeness = b.score - a.score;
  if (!sort || sort === "completeness") {
    return completeness || compareText(a.lead.name, b.lead.name);
  }
  const flip = dir === "desc" ? -1 : 1;
  const primary =
    sort === "email"
      ? compareText(a.lead.email, b.lead.email)
      : sort === "updated"
        ? compareText(
            a.details.updated || a.lead.lastContact,
            b.details.updated || b.lead.lastContact,
          )
        : compareText(a.lead.name, b.lead.name);
  return primary * flip || completeness || compareText(a.lead.name, b.lead.name);
}

async function loadCatalog() {
  if (catalog && catalog.v === CATALOG_VERSION && Date.now() - catalog.at < TTL_MS) {
    return catalog.rows;
  }
  if (inflight) return inflight;
  inflight = buildCatalog()
    .then((rows) => {
      catalog = { rows, at: Date.now(), v: CATALOG_VERSION };
      return rows;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function buildCatalog() {
  const sb = getSupabase();
  const { count, error: countError } = await sb
    .from("leads")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const batches = await Promise.all(
    Array.from({ length: pages }, async (_, i) => {
      const { data, error } = await sb
        .from("leads")
        .select(LIST_COLS)
        .range(i * PAGE, i * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      return (data ?? []) as Record<string, unknown>[];
    }),
  );

  return batches.flat().map((row) => {
    const raw = mapLead(row);
    const details = parseLeadDetails(raw);
    const lead = withResolvedCompany(raw, details);
    return {
      lead,
      details,
      score: completenessScore(lead, details),
      haystack: leadSearchText(lead, details),
    };
  });
}

export async function listLeadPage(input: LeadListQuery): Promise<{
  rows: LeadTableRow[];
  total: number;
  countries: string[];
  tags: string[];
  page: number;
  limit: number;
  stageCounts?: Record<string, number>;
}> {
  const kanban = Boolean(input.kanban);
  const limit = kanban
    ? Math.min(Math.max(input.limit ?? 500, 1), 1200)
    : Math.min(Math.max(input.limit ?? 75, 1), 100);
  const page = Math.max(input.page ?? 0, 0);
  const sort = input.sort ?? "completeness";
  const dir = input.dir === "desc" ? "desc" : "asc";
  const q = input.q ? safeFilter(input.q).toLowerCase() : "";
  const country =
    input.country && input.country !== "all" ? input.country.trim() : "";
  const tag =
    input.tag && input.tag !== "all" ? input.tag.trim().toLowerCase() : "";

  const all = await loadCatalog();
  const filtered = all.filter((row) => {
    if (input.stage && input.stage !== "all" && row.lead.status !== input.stage) {
      return false;
    }
    if (country && row.details.country !== country) return false;
    if (tag) {
      const tags = tagList(row.details.tags).map((name) => name.toLowerCase());
      if (!tags.includes(tag)) return false;
    }
    if (input.kind === "company" && !row.details.isCompany) return false;
    if (input.kind === "person" && row.details.isCompany) return false;
    if (q && !row.haystack.includes(q)) return false;
    return true;
  });

  filtered.sort((a, b) => compareRows(a, b, sort, dir));

  const stageCounts: Record<string, number> = {};
  for (const row of filtered) {
    const key = row.lead.status || "new";
    stageCounts[key] = (stageCounts[key] ?? 0) + 1;
  }

  let slice: CachedLead[];
  if (kanban) {
    // Cap each stage so busy columns (e.g. New) don't hide the rest.
    const stageKeys = new Set(
      filtered.map((row) => row.lead.status || "new"),
    );
    const stageN = Math.max(stageKeys.size, 1);
    const perStage = Math.max(40, Math.ceil(limit / stageN));
    const buckets = new Map<string, CachedLead[]>();
    for (const row of filtered) {
      const key = row.lead.status || "new";
      const list = buckets.get(key) ?? [];
      if (list.length < perStage) {
        list.push(row);
        buckets.set(key, list);
      }
    }
    slice = [...buckets.values()].flat();
  } else {
    const start = page * limit;
    slice = filtered.slice(start, start + limit);
  }

  const countries = [
    ...new Set(
      all.map((row) => row.details.country).filter((name) => name.length > 0),
    ),
  ].sort((a, b) => compareText(a, b));

  const tags = [
    ...new Set(
      all.flatMap((row) => tagList(row.details.tags)).filter((name) => name.length > 0),
    ),
  ].sort((a, b) => compareText(a, b));

  return {
    rows: slice.map(({ lead, details, score }) => ({ lead, details, score })),
    total: filtered.length,
    countries,
    tags,
    page,
    limit,
    stageCounts,
  };
}

export async function updateLeadStatusFast(id: string, status: LeadStatus) {
  const sb = getSupabase();
  const { error } = await sb
    .from("leads")
    .update({
      status,
      last_contact: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (catalog) {
    catalog.rows = catalog.rows.map((row) =>
      row.lead.id === id ? { ...row, lead: { ...row.lead, status } } : row,
    );
  }
}

export async function updateLeadPriorityFast(id: string, priority: LeadPriority) {
  const prev = await existingLead(id);
  if (!prev) throw new Error("Lead not found");
  const details = parseLeadDetails(prev);
  const input = { ...contactWriteFromLead(prev, details), priority };
  const updated = new Date().toISOString().slice(0, 10);
  const preamble = /Imported from (Odoo )?contacts\./.test(prev.notes)
    ? "Imported from contacts."
    : "";
  const notes = serializeContactNotes(input, updated, preamble);
  const sb = getSupabase();
  const { error } = await sb
    .from("leads")
    .update({ notes, last_contact: updated })
    .eq("id", id);
  if (error) throw new Error(error.message);
  putCatalog({ ...prev, notes, lastContact: updated });
}

function cachedFromLead(lead: Lead): CachedLead {
  const details = parseLeadDetails(lead);
  const resolved = withResolvedCompany(lead, details);
  return {
    lead: resolved,
    details,
    score: completenessScore(resolved, details),
    haystack: leadSearchText(resolved, details),
  };
}

function putCatalog(lead: Lead) {
  const item = cachedFromLead(lead);
  if (!catalog) return item;
  const index = catalog.rows.findIndex((row) => row.lead.id === lead.id);
  if (index >= 0) catalog.rows[index] = item;
  else catalog.rows.unshift(item);
  return item;
}

function nextLeadId(email: string, ids: Set<string>) {
  if (email) {
    const base = `ld_${email}`;
    if (!ids.has(base)) return base;
    let n = 2;
    while (ids.has(`${base}_${n}`)) n += 1;
    return `${base}_${n}`;
  }
  const stamp = Date.now().toString(36);
  let id = `ld_manual_${stamp}`;
  let n = 2;
  while (ids.has(id)) {
    id = `ld_manual_${stamp}_${n}`;
    n += 1;
  }
  return id;
}

function companyForWrite(input: ContactWrite) {
  const company = input.company.trim();
  if (company) return company;
  if (input.isCompany) {
    const name = input.name.trim();
    if (name && !name.includes("@")) return name;
  }
  return "";
}

async function existingLead(id: string): Promise<Lead | null> {
  const rows = await loadCatalog();
  const hit = rows.find((row) => row.lead.id === id);
  if (hit) return hit.lead;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("leads")
    .select(LIST_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapLead(data as Record<string, unknown>) : null;
}

export async function getLeadRow(id: string): Promise<LeadTableRow | null> {
  const rows = await loadCatalog();
  const cached = rows.find((row) => row.lead.id === id);
  if (cached) {
    return {
      lead: cached.lead,
      details: cached.details,
      score: cached.score,
    };
  }
  const lead = await existingLead(id);
  if (!lead) return null;
  const details = parseLeadDetails(lead);
  const resolved = withResolvedCompany(lead, details);
  return {
    lead: resolved,
    details,
    score: completenessScore(resolved, details),
  };
}

export async function writeLead(
  input: ContactWrite,
  id?: string,
): Promise<LeadTableRow> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const email = input.email.trim().toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  const status = input.status;
  const company = companyForWrite(input);

  let prev: Lead | null = null;
  if (id) {
    prev = await existingLead(id);
    if (!prev) throw new Error("Contact not found");
  }

  const preamble = /Imported from (Odoo )?contacts\./.test(prev?.notes ?? "")
    ? "Imported from contacts."
    : "";
  const notes = serializeContactNotes(input, day, preamble);
  const leadId =
    prev?.id ??
    nextLeadId(
      email,
      new Set((await loadCatalog()).map((row) => row.lead.id)),
    );

  const record = {
    id: leadId,
    name,
    email,
    phone: input.phone.trim(),
    company,
    source: prev?.source ?? "manual",
    status,
    value:
      typeof input.value === "number" && Number.isFinite(input.value)
        ? Math.max(0, input.value)
        : (prev?.value ?? 0),
    currency: "USD" as const,
    owner: prev?.owner ?? "Team",
    created_at: prev?.createdAt ?? day,
    last_contact: day,
    notes,
  };

  const sb = getSupabase();
  const { id: savedId, ...fields } = record;
  const { error } = id
    ? await sb.from("leads").update(fields).eq("id", savedId)
    : await sb.from("leads").insert(record);
  if (error) throw new Error(error.message);

  const cached = putCatalog({
    id: savedId,
    name,
    email,
    phone: record.phone,
    company,
    source: record.source as Lead["source"],
    status,
    value: record.value,
    currency: "USD",
    owner: record.owner,
    createdAt: record.created_at,
    lastContact: day,
    notes,
  });
  return { lead: cached.lead, details: cached.details, score: cached.score };
}

export type QuickCreatePayload = {
  status: LeadStatus;
  company: string;
  contactName: string;
  opportunityName: string;
  email: string;
  phone: string;
  value: number;
  priority: LeadPriority;
};

/**
 * Odoo-style quick create: upsert Company + Contact into the shared address book
 * (same /api/leads catalog Contacts/Sales use), then create the pipeline opportunity.
 */
export async function writeQuickCreate(
  input: QuickCreatePayload,
): Promise<LeadTableRow> {
  const company = input.company.trim();
  const contactName = input.contactName.trim();
  const opportunity = input.opportunityName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const value =
    typeof input.value === "number" && Number.isFinite(input.value)
      ? Math.max(0, input.value)
      : 0;
  const priority = clampPriority(input.priority);
  const status = input.status;

  if (!opportunity && !contactName && !company && !email) {
    throw new Error("Name is required");
  }

  if (company) {
    await upsertCompanyContact(company);
  }

  let personId: string | null = null;
  if (contactName || email) {
    const person = await upsertPersonContact({
      name: contactName || opportunity || email,
      email,
      phone,
      company,
    });
    personId = person.lead.id;
  }

  const distinctOpportunity =
    Boolean(opportunity) &&
    opportunity.toLowerCase() !== contactName.toLowerCase() &&
    opportunity.toLowerCase() !== company.toLowerCase();

  // Contact (or company-only) is the pipeline card when there is no separate opportunity title.
  if (personId && !distinctOpportunity) {
    const existing = await getLeadRow(personId);
    if (!existing) throw new Error("Contact not found");
    return writeLead(
      {
        ...contactWriteFromLead(existing.lead, existing.details),
        name: contactName || existing.lead.name,
        email: email || existing.lead.email,
        phone: phone || existing.lead.phone,
        company: company || existing.lead.company,
        value: value || existing.lead.value,
        priority,
        status,
        isCompany: false,
        active: true,
      },
      personId,
    );
  }

  if (!personId && company && !distinctOpportunity && !email) {
    const firm = await findCompanyContact(company);
    if (firm) {
      return writeLead(
        {
          ...contactWriteFromLead(firm.lead, firm.details),
          name: company,
          company,
          value: value || firm.lead.value,
          priority,
          status,
          isCompany: true,
          active: true,
        },
        firm.lead.id,
      );
    }
  }

  const notesParts: string[] = [];
  if (contactName && distinctOpportunity) {
    notesParts.push(`Contact: ${contactName}`);
  }

  return writeLead({
    name: opportunity || contactName || company || email,
    email,
    phone,
    company,
    city: "",
    country: "",
    tags: "",
    isCompany: !contactName && !email && Boolean(company),
    active: true,
    stats: "",
    activities: "",
    activityStatus: "",
    nextActivity: "",
    upcomingActivity: "",
    properties: "",
    priority,
    extras: [],
    notes: notesParts.join("\n"),
    status,
    value,
  });
}

async function findCompanyContact(companyName: string): Promise<LeadTableRow | null> {
  const key = companyName.trim().toLowerCase();
  if (!key) return null;
  const rows = await loadCatalog();
  const hit = rows.find((row) => {
    if (!row.details.isCompany) return false;
    const name = row.lead.name.trim().toLowerCase();
    const company = row.lead.company.trim().toLowerCase();
    return name === key || company === key;
  });
  return hit
    ? { lead: hit.lead, details: hit.details, score: hit.score }
    : null;
}

async function upsertCompanyContact(companyName: string): Promise<LeadTableRow> {
  const existing = await findCompanyContact(companyName);
  if (existing) {
    if (!existing.details.active) {
      return writeLead(
        {
          ...contactWriteFromLead(existing.lead, existing.details),
          name: companyName,
          company: companyName,
          isCompany: true,
          active: true,
        },
        existing.lead.id,
      );
    }
    return existing;
  }
  return writeLead({
    name: companyName,
    email: "",
    phone: "",
    company: companyName,
    city: "",
    country: "",
    tags: "",
    isCompany: true,
    active: true,
    stats: "",
    activities: "",
    activityStatus: "",
    nextActivity: "",
    upcomingActivity: "",
    properties: "",
    priority: 0,
    extras: [],
    notes: "",
    status: "new",
    value: 0,
  });
}

async function findPersonContact(input: {
  name: string;
  email: string;
  company: string;
}): Promise<LeadTableRow | null> {
  const rows = await loadCatalog();
  const email = input.email.trim().toLowerCase();
  if (email) {
    const byEmail = rows.find(
      (row) =>
        !row.details.isCompany &&
        row.lead.email.trim().toLowerCase() === email,
    );
    if (byEmail) {
      return {
        lead: byEmail.lead,
        details: byEmail.details,
        score: byEmail.score,
      };
    }
  }
  const name = input.name.trim().toLowerCase();
  const company = input.company.trim().toLowerCase();
  if (!name) return null;
  const byName = rows.find((row) => {
    if (row.details.isCompany) return false;
    if (row.lead.name.trim().toLowerCase() !== name) return false;
    if (!company) return true;
    return row.lead.company.trim().toLowerCase() === company;
  });
  return byName
    ? { lead: byName.lead, details: byName.details, score: byName.score }
    : null;
}

async function upsertPersonContact(input: {
  name: string;
  email: string;
  phone: string;
  company: string;
}): Promise<LeadTableRow> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const company = input.company.trim();
  const existing = await findPersonContact({ name, email, company });
  if (existing) {
    return writeLead(
      {
        ...contactWriteFromLead(existing.lead, existing.details),
        name: name || existing.lead.name,
        email: email || existing.lead.email,
        phone: phone || existing.lead.phone,
        company: company || existing.lead.company,
        isCompany: false,
        active: true,
      },
      existing.lead.id,
    );
  }
  return writeLead({
    name: name || email,
    email,
    phone,
    company,
    city: "",
    country: "",
    tags: "",
    isCompany: false,
    active: true,
    stats: "",
    activities: "",
    activityStatus: "",
    nextActivity: "",
    upcomingActivity: "",
    properties: "",
    priority: 0,
    extras: [],
    notes: "",
    status: "new",
    value: 0,
  });
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function parseContactWrite(body: unknown): ContactWrite | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const status = asText(input.status).trim();
  if (!isValidStageId(status)) {
    return null;
  }
  const extras = Array.isArray(input.extras)
    ? input.extras.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as { label?: unknown; value?: unknown };
        return [
          { label: asText(item.label), value: asText(item.value) },
        ];
      })
    : [];
  return {
    name: asText(input.name),
    email: asText(input.email),
    phone: asText(input.phone),
    company: asText(input.company),
    city: asText(input.city),
    country: asText(input.country),
    tags: asText(input.tags),
    isCompany: Boolean(input.isCompany),
    active: input.active !== false,
    stats: asText(input.stats),
    activities: asText(input.activities),
    activityStatus: asText(input.activityStatus),
    nextActivity: asText(input.nextActivity),
    upcomingActivity: asText(input.upcomingActivity),
    properties: asText(input.properties),
    priority: clampPriority(input.priority),
    extras,
    notes: asText(input.notes),
    status: status as LeadStatus,
    value: Number.isFinite(Number(input.value))
      ? Math.max(0, Number(input.value))
      : undefined,
  };
}
