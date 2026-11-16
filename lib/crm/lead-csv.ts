import {
  clampPriority,
  leftoverNotes,
  type ContactDetails,
  type ContactWrite,
} from "@/lib/crm/contact-details";
import { isValidStageId } from "@/lib/crm/pipeline";
import type { Lead, LeadSource } from "@/lib/demo-data";

export const LEAD_CSV_HEADERS = [
  "id",
  "name",
  "email",
  "phone",
  "company",
  "city",
  "country",
  "tags",
  "is_company",
  "active",
  "status",
  "value",
  "priority",
  "source",
  "next_activity",
  "notes",
] as const;

export type LeadCsvColumn = (typeof LEAD_CSV_HEADERS)[number];

export type LeadCsvRow = Partial<Record<LeadCsvColumn, string>>;

const HEADER_ALIASES: Record<string, LeadCsvColumn> = {
  id: "id",
  name: "name",
  nom: "name",
  "nom complet": "name",
  "full name": "name",
  email: "email",
  "e-mail": "email",
  mail: "email",
  phone: "phone",
  telephone: "phone",
  tel: "phone",
  company: "company",
  societe: "company",
  "societe associee": "company",
  "associated company": "company",
  city: "city",
  ville: "city",
  country: "country",
  pays: "country",
  tags: "tags",
  etiquettes: "tags",
  labels: "tags",
  is_company: "is_company",
  "is company": "is_company",
  "est une societe": "is_company",
  company_type: "is_company",
  active: "active",
  actif: "active",
  status: "status",
  stage: "status",
  etape: "status",
  pipeline: "status",
  value: "value",
  revenue: "value",
  "expected revenue": "value",
  montant: "value",
  priority: "priority",
  priorite: "priority",
  source: "source",
  origin: "source",
  next_activity: "next_activity",
  "next activity": "next_activity",
  "resume de l'activite suivante": "next_activity",
  notes: "notes",
  note: "notes",
  commentaire: "notes",
};

const LEAD_SOURCES = new Set<LeadSource>([
  "google",
  "meta",
  "organic",
  "referral",
  "manual",
  "website",
]);

export function normalizeCsvHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapCsvHeader(value: string): LeadCsvColumn | null {
  const key = normalizeCsvHeader(value);
  if (!key) return null;
  if (HEADER_ALIASES[key]) return HEADER_ALIASES[key];
  const compact = key.replace(/\s+/g, "_");
  return HEADER_ALIASES[compact] ?? null;
}

export function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function leadCsvTemplate(): string {
  return `\uFEFF${LEAD_CSV_HEADERS.join(",")}\r\n`;
}

export function rowsToLeadCsv(
  rows: { lead: Lead; details: ContactDetails }[],
): string {
  const lines = [LEAD_CSV_HEADERS.map(escapeCsvCell).join(",")];
  for (const { lead, details } of rows) {
    const cells: Record<LeadCsvColumn, string | number | boolean> = {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      city: details.city,
      country: details.country,
      tags: details.tags,
      is_company: details.isCompany ? "TRUE" : "FALSE",
      active: details.active === false ? "FALSE" : "TRUE",
      status: lead.status,
      value: lead.value || 0,
      priority: details.priority || 0,
      source: lead.source,
      next_activity: details.nextActivity,
      notes: leftoverNotes(lead.notes),
    };
    lines.push(LEAD_CSV_HEADERS.map((key) => escapeCsvCell(cells[key])).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function csvToLeadRows(text: string): LeadCsvRow[] {
  const table = parseCsv(text);
  const header = table[0];
  if (!header?.length) return [];
  const cols = header.map(mapCsvHeader);
  if (!cols.some(Boolean)) {
    throw new Error("CSV is missing a header row (name, email, …)");
  }
  return table.slice(1).map((cells) => {
    const row: LeadCsvRow = {};
    cols.forEach((key, index) => {
      if (!key) return;
      const value = (cells[index] ?? "").trim();
      if (value) row[key] = value;
    });
    return row;
  });
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value == null || value === "") return undefined;
  if (/^(true|1|yes|oui|vrai)$/i.test(value)) return true;
  if (/^(false|0|no|non)$/i.test(value)) return false;
  return undefined;
}

export function csvRowHasIdentity(row: LeadCsvRow) {
  return Boolean(row.id?.trim() || row.email?.trim() || row.name?.trim());
}

export function applyCsvRowToWrite(
  row: LeadCsvRow,
  base: ContactWrite,
): ContactWrite {
  const next = { ...base };
  if (row.name) next.name = row.name;
  if (row.email) next.email = row.email.trim().toLowerCase();
  if (row.phone) next.phone = row.phone;
  if (row.company) next.company = row.company;
  if (row.city) next.city = row.city;
  if (row.country) next.country = row.country;
  if (row.tags) next.tags = row.tags;
  const isCompany = parseBool(row.is_company);
  if (isCompany != null) next.isCompany = isCompany;
  const active = parseBool(row.active);
  if (active != null) next.active = active;
  if (row.status && isValidStageId(row.status.trim().toLowerCase())) {
    next.status = row.status.trim().toLowerCase();
  }
  if (row.value != null && row.value !== "") {
    const value = Number(String(row.value).replace(",", "."));
    if (Number.isFinite(value)) next.value = Math.max(0, value);
  }
  if (row.priority != null && row.priority !== "") {
    next.priority = clampPriority(row.priority);
  }
  if (row.next_activity) next.nextActivity = row.next_activity;
  if (row.notes) next.notes = row.notes;
  if (!next.name.trim()) {
    next.name = next.email.split("@")[0] || next.company || next.phone;
  }
  return next;
}

export function parseLeadSource(value: string | undefined, fallback: LeadSource): LeadSource {
  const key = (value ?? "").trim().toLowerCase();
  if (LEAD_SOURCES.has(key as LeadSource)) return key as LeadSource;
  return fallback;
}
