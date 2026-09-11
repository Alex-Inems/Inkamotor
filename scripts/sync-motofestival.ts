/**
 * Re-import Motofestival form — miss nothing.
 * Also ensures Email Marketing template + draft for Barcelonnette2026.
 *
 * Usage:
 *   npx tsx scripts/sync-motofestival.ts
 *   npx tsx scripts/sync-motofestival.ts "C:\path\to\file.xlsx"
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import {
  parseLeadDetails,
  serializeContactNotes,
  tagList,
  type ContactWrite,
} from "../lib/crm/contact-details";
import { mapLead } from "../lib/crm/repository";
import type { Lead } from "../lib/demo-data";
import { branded } from "../lib/newsletter/templates";
import { getSupabase } from "../lib/supabase/server";

type LeadExtra = { label: string; value: string };

const TAG = "Barcelonnette2026";
const TAG_EXTRA = "Motofestival";
const DEFAULT_DOWNLOAD = resolve(
  process.env.USERPROFILE || process.env.HOME || "",
  "Downloads",
  "Formulaire contact - Alpes Aventure Motofestival  (réponses).xlsx",
);
const DATA_COPY = resolve(process.cwd(), "data", "barcelonnette-2026-motofestival.xlsx");

/** Stable order of Google Form columns — capture every one. */
const FORM_COLUMNS = [
  "Horodateur",
  "NOM Prénom",
  "Adresse e-mail",
  "Numéro de téléphone",
  "Le ou les voyages qui vous tentent le plus ? ",
  "La formule qui vous intéresse ?",
  "Quand aimeriez-vous partir ? ",
  "On vous recontacte pour échanger sur votre projet ? ",
  "Commentaire",
] as const;

const EXTRA_LABELS: Record<(typeof FORM_COLUMNS)[number], string> = {
  Horodateur: "Horodateur",
  "NOM Prénom": "NOM Prénom",
  "Adresse e-mail": "Adresse e-mail",
  "Numéro de téléphone": "Numéro de téléphone",
  "Le ou les voyages qui vous tentent le plus ? ": "Voyages souhaités",
  "La formule qui vous intéresse ?": "Formule",
  "Quand aimeriez-vous partir ? ": "Départ souhaité",
  "On vous recontacte pour échanger sur votre projet ? ": "Recontact",
  Commentaire: "Commentaire",
};

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = value;
    }
  }
}

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim()) return String(direct).trim();
  }
  for (const [k, v] of Object.entries(row)) {
    const nk = k.trim();
    if (keys.some((want) => want.trim() === nk) && String(v ?? "").trim()) {
      return String(v).trim();
    }
  }
  return "";
}

function dayFromStamp(value: string) {
  const m = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  const a = Number(m[1]);
  const b = Number(m[2]);
  const y = m[3]!;
  const month = a <= 12 && b <= 31 ? a : b;
  const day = a <= 12 && b <= 31 ? b : a;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function mergeTags(existing: string, ...add: string[]) {
  const set = new Set(
    [...tagList(existing), ...add].map((t) => t.trim()).filter(Boolean),
  );
  const rest = [...set].filter((t) => t !== TAG && t !== TAG_EXTRA);
  return [TAG, TAG_EXTRA, ...rest].join(", ");
}

function priorityFromTiming(timing: string): 0 | 1 | 2 | 3 {
  if (/court terme|prochainement|🔥/i.test(timing)) return 3;
  if (/moyen terme|🟠/i.test(timing)) return 2;
  if (/long terme|🔵/i.test(timing)) return 1;
  return 0;
}

function leftoverFreeNotes(notes: string) {
  return (notes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (line) =>
        Boolean(line) &&
        line !== "Imported from Odoo contacts." &&
        line.indexOf(":") < 1,
    )
    .join("\n");
}

function allSheetKeys(rows: Record<string, unknown>[]) {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) keys.add(k);
  }
  return [...keys];
}

function extrasFromRow(
  row: Record<string, unknown>,
  sheetKeys: string[],
  submissionIndex?: number,
): LeadExtra[] {
  const extras: LeadExtra[] = [];
  const prefix =
    submissionIndex != null && submissionIndex > 0
      ? `Soumission ${submissionIndex + 1} — `
      : "";

  const known = new Set(FORM_COLUMNS.map((c) => c.trim()));
  for (const col of FORM_COLUMNS) {
    const value = cell(row, col);
    if (!value) continue;
    // Skip identity fields in extras when primary (kept on lead fields)
    if (
      submissionIndex === 0 ||
      submissionIndex == null
    ) {
      if (
        col === "NOM Prénom" ||
        col === "Adresse e-mail" ||
        col === "Numéro de téléphone"
      ) {
        continue;
      }
    }
    extras.push({
      label: `${prefix}${EXTRA_LABELS[col] ?? col.trim()}`,
      value,
    });
  }

  // Any unexpected columns from the sheet — miss nothing
  for (const key of sheetKeys) {
    if (known.has(key.trim())) continue;
    const value = cell(row, key);
    if (!value) continue;
    extras.push({
      label: `${prefix}${key.trim()}`,
      value,
    });
  }

  extras.push({
    label: `${prefix}Événement`,
    value: "Alpes Aventure Motofestival — Barcelonnette 2026",
  });

  return extras;
}

type FormPerson = {
  email: string;
  rows: Record<string, unknown>[];
};

function groupFormRows(
  rows: Record<string, unknown>[],
): { withEmail: FormPerson[]; withoutEmail: Record<string, unknown>[] } {
  const byEmail = new Map<string, Record<string, unknown>[]>();
  const withoutEmail: Record<string, unknown>[] = [];

  for (const row of rows) {
    const name = cell(row, "NOM Prénom");
    const email = cell(row, "Adresse e-mail").toLowerCase();
    if (!name && !email) continue;
    if (email.includes("@")) {
      const list = byEmail.get(email) ?? [];
      list.push(row);
      byEmail.set(email, list);
    } else {
      withoutEmail.push(row);
    }
  }

  return {
    withEmail: [...byEmail.entries()].map(([email, formRows]) => ({
      email,
      rows: formRows,
    })),
    withoutEmail,
  };
}

function pickPrimaryLead(leads: Lead[]): Lead {
  // Prefer canonical ld_<email>, then oldest createdAt
  const canon = leads.find((l) => l.id === `ld_${l.email.toLowerCase()}`);
  if (canon) return canon;
  return [...leads].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]!;
}

function buildWriteFromSubmissions(
  formRows: Record<string, unknown>[],
  sheetKeys: string[],
  emailFallback: string,
): ContactWrite {
  // Latest submission wins for primary fields; all submissions kept in extras
  const latest = formRows[formRows.length - 1]!;
  const name =
    cell(latest, "NOM Prénom") ||
    formRows.map((r) => cell(r, "NOM Prénom")).find(Boolean) ||
    emailFallback.split("@")[0] ||
    "Contact Motofestival";
  const email =
    cell(latest, "Adresse e-mail").toLowerCase() || emailFallback;
  const phone =
    cell(latest, "Numéro de téléphone") ||
    formRows.map((r) => cell(r, "Numéro de téléphone")).find(Boolean) ||
    "";
  const when =
    cell(latest, "Quand aimeriez-vous partir ? ") ||
    formRows.map((r) => cell(r, "Quand aimeriez-vous partir ? ")).find(Boolean) ||
    "";
  const recontact =
    cell(latest, "On vous recontacte pour échanger sur votre projet ? ") ||
    formRows
      .map((r) => cell(r, "On vous recontacte pour échanger sur votre projet ? "))
      .find(Boolean) ||
    "";

  const extras: LeadExtra[] = [];
  formRows.forEach((row, i) => {
    extras.push(...extrasFromRow(row, sheetKeys, formRows.length > 1 ? i : 0));
  });

  const noteLines = [
    "Rencontre Alpes Aventure Motofestival — Barcelonnette 2026.",
    formRows.length > 1
      ? `${formRows.length} soumissions formulaire (toutes conservées).`
      : "",
  ];
  for (const row of formRows) {
    const stamp = cell(row, "Horodateur");
    const comment = cell(row, "Commentaire");
    if (stamp) noteLines.push(`Formulaire: ${stamp}`);
    if (comment) noteLines.push(`Commentaire: ${comment}`);
  }

  return {
    name,
    email,
    phone,
    company: "",
    city: "",
    country: "France",
    tags: `${TAG}, ${TAG_EXTRA}`,
    isCompany: false,
    active: true,
    stats: "",
    activities: "",
    activityStatus: "",
    nextActivity:
      recontact.toLowerCase() === "oui" ? "Envoyer roadbook + message" : "",
    upcomingActivity: "",
    properties: "",
    priority: priorityFromTiming(when),
    extras,
    notes: noteLines.filter(Boolean).join("\n"),
    status: "new",
  };
}

function noEmailKey(row: Record<string, unknown>) {
  const name = cell(row, "NOM Prénom").toLowerCase();
  const phone = cell(row, "Numéro de téléphone").replace(/\D/g, "");
  const stamp = cell(row, "Horodateur");
  return `noemail:${name}|${phone}|${stamp}`;
}

async function ensureMarketingTemplate() {
  const sb = getSupabase();
  const id = "tpl_barcelonnette_2026";
  const name = "Barcelonnette / Motofestival 2026";
  const subject = "Suite à notre rencontre à Barcelonnette — Inkamoto Tours";
  const preview =
    "Merci pour l’échange au Motofestival — roadbook et prochaines dates Pérou.";
  const html = branded(
    "Ravi de vous avoir croisés à Barcelonnette",
    `<p>Bonjour,</p>
<p>Merci pour votre passage sur le stand <strong>Inkamoto Tours</strong> à l’Alpes Aventure Motofestival (Barcelonnette 2026).</p>
<p>Comme promis, voici un suivi pour avancer sur votre projet de voyage moto au Pérou.</p>
<ul>
<li>Le <strong>Chemin des Incas</strong> — Sud du Pérou</li>
<li>Le <strong>Nord et l’Amazonie</strong></li>
<li>Formule <strong>voyage guidé</strong> en petit groupe (chauffeur, mécanicien, guide)</li>
</ul>
<p>Répondez simplement à cet e-mail avec vos dates idéales, le nombre de riders, et si vous préférez un devis ou d’abord le roadbook.</p>
<p>À très bientôt sur la piste,<br/><strong>Inkamoto Tours</strong><br/>contact@inkamototours.com</p>`,
  );

  const { error } = await sb.from("newsletter_templates").upsert(
    {
      id,
      name,
      subject,
      preview,
      html,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    console.warn("Template upsert skipped:", error.message);
  }

  const mailingId = "mail_barcelonnette_2026";
  const now = new Date().toISOString();
  const { error: mailErr } = await sb.from("newsletter_mailings").upsert(
    {
      id: mailingId,
      name,
      subject,
      preview,
      html,
      status: "draft",
      recipient_tag: TAG,
      emails: [],
      scheduled_at: null,
      responsible: "Team",
      template_id: id,
      created_at: now,
      updated_at: now,
    },
    { onConflict: "id" },
  );
  if (mailErr) {
    console.warn("Mailing draft upsert skipped:", mailErr.message);
    return {
      id,
      mailingId,
      templateOk: !error,
      mailingOk: false,
      error: mailErr.message,
    };
  }
  return { id, mailingId, templateOk: !error, mailingOk: true };
}

async function main() {
  loadEnv();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  const file = resolve(process.argv[2] || DEFAULT_DOWNLOAD);
  if (!existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }
  mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
  copyFileSync(file, DATA_COPY);

  const wb = XLSX.read(readFileSync(file), { type: "buffer", raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const sheetKeys = allSheetKeys(rows);
  const unknownCols = sheetKeys.filter(
    (k) => !FORM_COLUMNS.some((c) => c.trim() === k.trim()),
  );

  const { withEmail, withoutEmail } = groupFormRows(rows);
  const emails = withEmail.map((p) => p.email);

  const sb = getSupabase();
  const leadsByEmail = new Map<string, Lead[]>();
  for (let i = 0; i < emails.length; i += 80) {
    const batch = emails.slice(i, i + 80);
    const { data, error } = await sb
      .from("leads")
      .select(
        "id, name, email, phone, company, source, status, value, currency, owner, created_at, last_contact, notes",
      )
      .in("email", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const lead = mapLead(row as Record<string, unknown>);
      if (!lead.email) continue;
      const key = lead.email.toLowerCase();
      const list = leadsByEmail.get(key) ?? [];
      list.push(lead);
      leadsByEmail.set(key, list);
    }
  }

  const { data: taggedRows, error: taggedErr } = await sb
    .from("leads")
    .select("id, email, name, notes")
    .ilike("notes", "%Étiquettes:%Barcelonnette2026%");
  if (taggedErr) console.warn("Tagged scan:", taggedErr.message);

  let created = 0;
  let updated = 0;
  let duplicateLeadsKept = 0;
  const payload: Record<string, unknown>[] = [];
  const seenIds = new Set<string>();

  function pushUnique(row: Record<string, unknown>) {
    const id = String(row.id);
    if (seenIds.has(id)) {
      throw new Error(`Duplicate payload id blocked: ${id}`);
    }
    seenIds.add(id);
    payload.push(row);
  }

  for (const person of withEmail) {
    const write = buildWriteFromSubmissions(person.rows, sheetKeys, person.email);
    const existingList = leadsByEmail.get(person.email) ?? [];
    const stamp = cell(person.rows[person.rows.length - 1]!, "Horodateur");
    const day = dayFromStamp(stamp);

    if (existingList.length > 0) {
      const prev = pickPrimaryLead(existingList);
      duplicateLeadsKept += Math.max(0, existingList.length - 1);
      const details = parseLeadDetails(prev);
      const tags = mergeTags(details.tags, TAG, TAG_EXTRA);
      const merged: ContactWrite = {
        ...write,
        name: write.name || prev.name,
        phone: write.phone || prev.phone,
        company: prev.company || write.company,
        city: details.city || write.city,
        country: details.country || write.country,
        tags,
        isCompany: details.isCompany,
        active: details.active,
        stats: details.stats,
        activities: details.activities,
        activityStatus: details.activityStatus,
        nextActivity: write.nextActivity || details.nextActivity,
        upcomingActivity: details.upcomingActivity,
        properties: details.properties,
        priority: write.priority || details.priority,
        extras: [
          ...details.extras.filter(
            (e) =>
              !write.extras.some(
                (w) => w.label.toLowerCase() === e.label.toLowerCase(),
              ),
          ),
          ...write.extras,
        ],
        notes: [leftoverFreeNotes(prev.notes), write.notes]
          .filter(Boolean)
          .join("\n"),
        status: prev.status,
      };
      pushUnique({
        id: prev.id,
        name: merged.name,
        email: prev.email,
        phone: merged.phone,
        company: merged.company,
        source: prev.source,
        status: prev.status,
        value: prev.value,
        currency: prev.currency,
        owner: prev.owner,
        created_at: prev.createdAt,
        last_contact: day,
        notes: serializeContactNotes(merged, day),
      });
      // Soft-tag extra duplicate CRM rows so nothing is orphaned
      for (const extra of existingList) {
        if (extra.id === prev.id) continue;
        const d = parseLeadDetails(extra);
        const tagged = mergeTags(d.tags, TAG, TAG_EXTRA, "Motofestival-doublon");
        pushUnique({
          id: extra.id,
          name: extra.name,
          email: extra.email,
          phone: extra.phone,
          company: extra.company,
          source: extra.source,
          status: extra.status,
          value: extra.value,
          currency: extra.currency,
          owner: extra.owner,
          created_at: extra.createdAt,
          last_contact: extra.lastContact,
          notes: serializeContactNotes(
            {
              name: extra.name,
              email: extra.email,
              phone: extra.phone,
              company: extra.company,
              city: d.city,
              country: d.country,
              tags: tagged,
              isCompany: d.isCompany,
              active: d.active,
              stats: d.stats,
              activities: d.activities,
              activityStatus: d.activityStatus,
              nextActivity: d.nextActivity,
              upcomingActivity: d.upcomingActivity,
              properties: d.properties,
              priority: d.priority,
              extras: [
                ...d.extras,
                {
                  label: "Doublon Motofestival",
                  value: `Même email que ${prev.id} — données fusionnées sur le lead principal`,
                },
              ],
              notes: leftoverFreeNotes(extra.notes),
              status: extra.status,
            },
            extra.lastContact,
          ),
        });
      }
      updated += 1;
      continue;
    }

    pushUnique({
      id: `ld_${person.email}`,
      name: write.name,
      email: person.email,
      phone: write.phone,
      company: "",
      source: "manual",
      status: "new",
      value: 0,
      currency: "USD",
      owner: "Team",
      created_at: day,
      last_contact: day,
      notes: serializeContactNotes(write, day),
    });
    created += 1;
  }

  // No-email rows: one lead each, keyed by name+phone+stamp so re-runs stay stable
  for (const row of withoutEmail) {
    const write = buildWriteFromSubmissions([row], sheetKeys, "");
    const stamp = cell(row, "Horodateur");
    const day = dayFromStamp(stamp);
    const key = noEmailKey(row);
    const id = `ld_barcelonnette_${Buffer.from(key).toString("base64url").slice(0, 24)}`;
    // Try match existing tagged lead by name+phone
    const name = write.name.toLowerCase();
    const phoneDigits = write.phone.replace(/\D/g, "");
    const match = (taggedRows ?? []).find((t) => {
      const tEmail = String(t.email ?? "");
      if (tEmail.includes("@")) return false;
      const tName = String(t.name ?? "").toLowerCase();
      return tName === name;
    });
    if (match) {
      const { data: full } = await sb
        .from("leads")
        .select(
          "id, name, email, phone, company, source, status, value, currency, owner, created_at, last_contact, notes",
        )
        .eq("id", match.id)
        .maybeSingle();
      if (full) {
        const prev = mapLead(full as Record<string, unknown>);
        const details = parseLeadDetails(prev);
        const tags = mergeTags(details.tags, TAG, TAG_EXTRA);
        pushUnique({
          id: prev.id,
          name: write.name || prev.name,
          email: prev.email,
          phone: write.phone || prev.phone,
          company: prev.company,
          source: prev.source,
          status: prev.status,
          value: prev.value,
          currency: prev.currency,
          owner: prev.owner,
          created_at: prev.createdAt,
          last_contact: day,
          notes: serializeContactNotes(
            {
              ...write,
              tags,
              extras: [
                ...details.extras.filter(
                  (e) =>
                    !write.extras.some(
                      (w) => w.label.toLowerCase() === e.label.toLowerCase(),
                    ),
                ),
                ...write.extras,
              ],
              notes: [leftoverFreeNotes(prev.notes), write.notes]
                .filter(Boolean)
                .join("\n"),
              status: prev.status,
            },
            day,
          ),
        });
        updated += 1;
        continue;
      }
    }
    void phoneDigits;
    pushUnique({
      id,
      name: write.name,
      email: "",
      phone: write.phone,
      company: "",
      source: "manual",
      status: "new",
      value: 0,
      currency: "USD",
      owner: "Team",
      created_at: day,
      last_contact: day,
      notes: serializeContactNotes(write, day),
    });
    created += 1;
  }

  for (let i = 0; i < payload.length; i += 50) {
    const batch = payload.slice(i, i + 50);
    const { error } = await sb.from("leads").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Supabase upsert ${i}: ${error.message}`);
    console.log(
      `Upserted ${Math.min(i + batch.length, payload.length)}/${payload.length}`,
    );
  }

  const marketing = await ensureMarketingTemplate();

  // Verify: every sheet email is in CRM with tags
  const { data: afterTagged, error: afterErr } = await sb
    .from("leads")
    .select("id, email, name, notes")
    .ilike("notes", `%Étiquettes:%${TAG}%`);
  if (afterErr) console.warn("After tagged scan:", afterErr.message);

  const taggedEmails = new Set(
    (afterTagged ?? [])
      .map((r) => String(r.email ?? "").toLowerCase())
      .filter((e) => e.includes("@")),
  );
  const missingInCrm = emails.filter((e) => !taggedEmails.has(e));

  console.log(
    JSON.stringify(
      {
        file,
        formRows: rows.length,
        uniqueEmails: emails.length,
        withoutEmail: withoutEmail.length,
        sheetColumns: sheetKeys,
        unexpectedColumns: unknownCols,
        created,
        updated,
        duplicateLeadsKept,
        payloadRows: payload.length,
        taggedAfter: afterTagged?.length ?? 0,
        missingInCrmAfter: missingInCrm,
        tags: `${TAG}, ${TAG_EXTRA}`,
        marketing,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
