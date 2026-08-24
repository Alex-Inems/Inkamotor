import type { Lead, LeadStatus } from "@/lib/demo-data";

/** Odoo CRM priority: 0 none → 3 very high (three stars). */
export type LeadPriority = 0 | 1 | 2 | 3;

export type ContactDetails = {
  isCompany: boolean;
  active: boolean;
  updated: string;
  city: string;
  country: string;
  tags: string;
  stats: string;
  activities: string;
  activityStatus: string;
  nextActivity: string;
  upcomingActivity: string;
  properties: string;
  priority: LeadPriority;
  extras: { label: string; value: string }[];
};

const SKIP = new Set([
  "avatar 128",
  "icône",
  "icone",
  "icône de type d'activité",
  "icone de type d'activite",
  "activité exception décoration",
  "activite exception decoration",
]);

type MappedField = Exclude<keyof ContactDetails, "extras">;

const FIELD_MAP: Record<string, MappedField> = {
  "est une société": "isCompany",
  "est une societe": "isCompany",
  actif: "active",
  "mis à jour le": "updated",
  "mis a jour le": "updated",
  ville: "city",
  pays: "country",
  étiquettes: "tags",
  etiquettes: "tags",
  stats: "stats",
  activités: "activities",
  activites: "activities",
  "statut de l'activité": "activityStatus",
  "statut de l'activite": "activityStatus",
  "résumé de l'activité suivante": "nextActivity",
  "resume de l'activite suivante": "nextActivity",
  "type d'activités à venir": "upcomingActivity",
  "type d'activites a venir": "upcomingActivity",
  "définition de base des propriétés": "properties",
  "definition de base des proprietes": "properties",
  priorité: "priority",
  priorite: "priority",
  priority: "priority",
};

export function clampPriority(value: unknown): LeadPriority {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return 0;
}

function emptyDetails(): ContactDetails {
  return {
    isCompany: false,
    active: true,
    updated: "",
    city: "",
    country: "",
    tags: "",
    stats: "",
    activities: "",
    activityStatus: "",
    nextActivity: "",
    upcomingActivity: "",
    properties: "",
    priority: 0,
    extras: [],
  };
}

function keyOf(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function truthy(value: string) {
  return /^(true|1|yes|oui|vrai)$/i.test(value.trim());
}

/** Linked company, or the contact name when the row itself is a company. */
export function resolveLeadCompany(lead: Lead, details?: ContactDetails) {
  const existing = lead.company.trim();
  if (existing) return existing;
  const parsed = details ?? parseLeadDetails(lead);
  if (!parsed.isCompany) return "";
  const name = lead.name.trim();
  if (!name || name.includes("@")) return "";
  if (lead.email && name.toLowerCase() === lead.email.toLowerCase()) return "";
  return name;
}

export function withResolvedCompany(lead: Lead, details?: ContactDetails): Lead {
  const company = resolveLeadCompany(lead, details);
  return company === lead.company ? lead : { ...lead, company };
}

export function parseLeadDetails(lead: Lead): ContactDetails {
  const details = emptyDetails();
  details.updated = lead.lastContact;
  const notes = lead.notes ?? "";
  if (!notes.includes(":")) return details;

  for (const line of notes.split("\n")) {
    const cut = line.indexOf(":");
    if (cut < 1) continue;
    const label = line.slice(0, cut).trim();
    const value = line.slice(cut + 1).trim();
    if (!label || !value || label === "Imported from Odoo contacts.") continue;
    const key = keyOf(label);
    if (SKIP.has(key)) continue;
    const field = FIELD_MAP[key];
    if (field === "isCompany" || field === "active") {
      details[field] = truthy(value);
      continue;
    }
    if (field === "priority") {
      details.priority = clampPriority(value);
      continue;
    }
    if (field) {
      details[field] = value;
      continue;
    }
    details.extras.push({ label, value });
  }
  return details;
}

export function leadSearchText(lead: Lead, details: ContactDetails) {
  return [
    lead.name,
    lead.email,
    lead.phone,
    resolveLeadCompany(lead, details),
    lead.notes,
    details.city,
    details.country,
    details.tags,
    details.stats,
    details.activities,
    details.activityStatus,
    details.nextActivity,
    details.upcomingActivity,
    details.properties,
    ...details.extras.map((row) => `${row.label} ${row.value}`),
  ]
    .join(" ")
    .toLowerCase();
}

export const COMPLETENESS_MAX = 8;

function hasName(lead: Lead) {
  const name = lead.name.trim();
  if (!name) return false;
  if (lead.email && name.toLowerCase() === lead.email.toLowerCase()) return false;
  if (name.includes("@")) return false;
  return true;
}

/** How many core client fields are filled. Full rows score 8. */
export function completenessScore(lead: Lead, details: ContactDetails) {
  return [
    hasName(lead),
    Boolean(lead.email.trim()),
    Boolean(lead.phone.trim()),
    Boolean(resolveLeadCompany(lead, details)),
    Boolean(details.city),
    Boolean(details.country),
    Boolean(details.tags),
    Boolean(
      details.nextActivity ||
        details.activityStatus ||
        details.activities ||
        details.upcomingActivity,
    ),
  ].filter(Boolean).length;
}

export function tagList(tags: string) {
  return tags
    .split(/[,;|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export type ContactWrite = {
  name: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  country: string;
  tags: string;
  isCompany: boolean;
  active: boolean;
  stats: string;
  activities: string;
  activityStatus: string;
  nextActivity: string;
  upcomingActivity: string;
  properties: string;
  priority: LeadPriority;
  extras: { label: string; value: string }[];
  notes: string;
  status: LeadStatus;
};

const NOTE_LABELS: Record<
  Exclude<
    keyof ContactDetails,
    "isCompany" | "active" | "updated" | "extras" | "priority"
  >,
  string
> = {
  city: "Ville",
  country: "Pays",
  tags: "Étiquettes",
  stats: "Stats",
  activities: "Activités",
  activityStatus: "Statut de l'activité",
  nextActivity: "Résumé de l'activité suivante",
  upcomingActivity: "Type d'activités à venir",
  properties: "Définition de base des propriétés",
};

/** Lines that are not structured Label: value fields. */
export function leftoverNotes(notes: string) {
  return (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        Boolean(line) &&
        line !== "Imported from Odoo contacts." &&
        line.indexOf(":") < 1,
    )
    .join("\n");
}

export function serializeContactNotes(
  input: Pick<
    ContactWrite,
    | "isCompany"
    | "active"
    | "city"
    | "country"
    | "tags"
    | "stats"
    | "activities"
    | "activityStatus"
    | "nextActivity"
    | "upcomingActivity"
    | "properties"
    | "priority"
    | "extras"
    | "notes"
  >,
  updated: string,
  preamble = "",
) {
  const lines: string[] = [];
  if (preamble.trim()) lines.push(preamble.trim());
  lines.push(`Est une société: ${input.isCompany ? "TRUE" : "FALSE"}`);
  lines.push(`Actif: ${input.active ? "TRUE" : "FALSE"}`);
  if (updated.trim()) lines.push(`Mis à jour le: ${updated.trim()}`);
  const priority = clampPriority(input.priority);
  if (priority > 0) lines.push(`Priorité: ${priority}`);

  const values: [keyof typeof NOTE_LABELS, string][] = [
    ["city", input.city],
    ["country", input.country],
    ["tags", input.tags],
    ["stats", input.stats],
    ["activities", input.activities],
    ["activityStatus", input.activityStatus],
    ["nextActivity", input.nextActivity],
    ["upcomingActivity", input.upcomingActivity],
    ["properties", input.properties],
  ];
  for (const [field, value] of values) {
    const text = value.trim();
    if (text) lines.push(`${NOTE_LABELS[field]}: ${text}`);
  }
  for (const row of input.extras) {
    const label = row.label.trim();
    const value = row.value.trim();
    if (label && value) lines.push(`${label}: ${value}`);
  }
  const free = input.notes.trim();
  if (free) lines.push(free);
  return lines.join("\n");
}

export function contactWriteFromLead(
  lead: Lead,
  details: ContactDetails,
): ContactWrite {
  return {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    city: details.city,
    country: details.country,
    tags: details.tags,
    isCompany: details.isCompany,
    active: details.active,
    stats: details.stats,
    activities: details.activities,
    activityStatus: details.activityStatus,
    nextActivity: details.nextActivity,
    upcomingActivity: details.upcomingActivity,
    properties: details.properties,
    priority: details.priority,
    extras: details.extras.map((row) => ({ ...row })),
    notes: leftoverNotes(lead.notes),
    status: lead.status,
  };
}

export function emptyContactWrite(): ContactWrite {
  return {
    name: "",
    email: "",
    phone: "",
    company: "",
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
  };
}
