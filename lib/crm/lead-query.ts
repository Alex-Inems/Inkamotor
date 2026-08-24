import {
  clampPriority,
  completenessScore,
  contactWriteFromLead,
  leadSearchText,
  parseLeadDetails,
  serializeContactNotes,
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
const CATALOG_VERSION = 3;

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
  page: number;
  limit: number;
  stageCounts?: Record<string, number>;
}> {
  const kanban = Boolean(input.kanban);
  const limit = kanban
    ? Math.min(Math.max(input.limit ?? 400, 1), 800)
    : Math.min(Math.max(input.limit ?? 75, 1), 100);
  const page = Math.max(input.page ?? 0, 0);
  const sort = input.sort ?? "completeness";
  const dir = input.dir === "desc" ? "desc" : "asc";
  const q = input.q ? safeFilter(input.q).toLowerCase() : "";
  const country =
    input.country && input.country !== "all" ? input.country.trim() : "";

  const all = await loadCatalog();
  const filtered = all.filter((row) => {
    if (input.stage && input.stage !== "all" && row.lead.status !== input.stage) {
      return false;
    }
    if (country && row.details.country !== country) return false;
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
    const perStage = Math.max(20, Math.floor(limit / 5));
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

  return {
    rows: slice.map(({ lead, details, score }) => ({ lead, details, score })),
    total: filtered.length,
    countries,
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
  const preamble = prev.notes.includes("Imported from Odoo contacts.")
    ? "Imported from Odoo contacts."
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

  const preamble = prev?.notes.includes("Imported from Odoo contacts.")
    ? "Imported from Odoo contacts."
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
    value: prev?.value ?? 0,
    currency: "USD",
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
  };
}
