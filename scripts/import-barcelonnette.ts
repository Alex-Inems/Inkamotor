/**
 * Import Alpes Aventure Motofestival / Barcelonnette 2026 form responses as leads.
 *
 * Tags each contact with Étiquette "Barcelonnette2026".
 * Merges the tag into existing leads (same email) without wiping other notes.
 *
 * Usage:
 *   npx tsx scripts/import-barcelonnette.ts [path-to-xlsx]
 *
 * Requires .env.local (Supabase service role).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import {
  parseLeadDetails,
  serializeContactNotes,
  tagList,
  type ContactWrite,
} from "../lib/crm/contact-details";
import { mapLead } from "../lib/crm/repository";
import { getSupabase } from "../lib/supabase/server";

const TAG = "Barcelonnette2026";
const DEFAULT_FILE = resolve(
  process.cwd(),
  "data",
  "barcelonnette-2026-motofestival.xlsx",
);

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
  // Tolerate trailing spaces in Google Forms headers
  for (const [k, v] of Object.entries(row)) {
    const nk = k.trim();
    if (keys.some((want) => want.trim() === nk) && String(v ?? "").trim()) {
      return String(v).trim();
    }
  }
  return "";
}

function dayFromStamp(value: string) {
  // e.g. 9/4/2026 10:35:57 (US) or 04/09/2026
  const m = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  const a = Number(m[1]);
  const b = Number(m[2]);
  const y = m[3];
  // Google Forms FR often still exports M/D/YYYY in Sheets
  const month = a <= 12 && b <= 31 ? a : b;
  const day = a <= 12 && b <= 31 ? b : a;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function mergeTags(existing: string, add: string) {
  const set = new Set(
    [...tagList(existing), ...tagList(add)].map((t) => t.trim()).filter(Boolean),
  );
  // Keep Barcelonnette tag first for visibility
  const rest = [...set].filter((t) => t !== TAG);
  return [TAG, ...rest].join(", ");
}

function priorityFromTiming(timing: string): 0 | 1 | 2 | 3 {
  if (/court terme|prochainement|🔥/i.test(timing)) return 3;
  if (/moyen terme|🟠/i.test(timing)) return 2;
  if (/long terme|🔵/i.test(timing)) return 1;
  return 0;
}

function buildWrite(row: Record<string, unknown>): ContactWrite | null {
  const name = cell(row, "NOM Prénom");
  const email = cell(row, "Adresse e-mail").toLowerCase();
  if (!name && !email) return null;

  const phone = cell(row, "Numéro de téléphone");
  const trips = cell(row, "Le ou les voyages qui vous tentent le plus ? ");
  const formula = cell(row, "La formule qui vous intéresse ?");
  const when = cell(row, "Quand aimeriez-vous partir ? ");
  const recontact = cell(
    row,
    "On vous recontacte pour échanger sur votre projet ? ",
  );
  const comment = cell(row, "Commentaire");
  const stamp = cell(row, "Horodateur");

  const extras = [
    { label: "Voyages souhaités", value: trips },
    { label: "Formule", value: formula },
    { label: "Départ souhaité", value: when },
    { label: "Recontact", value: recontact },
  ].filter((e) => e.value);

  return {
    name: name || email.split("@")[0] || "Contact Motofestival",
    email,
    phone,
    company: "",
    city: "",
    country: "France",
    tags: TAG,
    isCompany: false,
    active: true,
    stats: "",
    activities: "",
    activityStatus: "",
    nextActivity: recontact.toLowerCase() === "oui" ? "Envoyer roadbook + message" : "",
    upcomingActivity: "",
    properties: "",
    priority: priorityFromTiming(when),
    extras,
    notes: [
      "Rencontre Alpes Aventure Motofestival — Barcelonnette 2026.",
      stamp ? `Formulaire: ${stamp}` : "",
      comment ? `Commentaire: ${comment}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    status: "new",
  };
}

async function main() {
  loadEnv();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const file = resolve(process.argv[2] || DEFAULT_FILE);
  if (!existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }

  const wb = XLSX.read(readFileSync(file), { type: "buffer", raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const writes = rows
    .map((row) => buildWrite(row))
    .filter((w): w is ContactWrite => Boolean(w));

  const emails = [
    ...new Set(writes.map((w) => w.email).filter((e) => e.includes("@"))),
  ];

  const sb = getSupabase();
  const existingByEmail = new Map<string, ReturnType<typeof mapLead>>();
  if (emails.length) {
    // chunk .in() queries
    const chunk = 80;
    for (let i = 0; i < emails.length; i += chunk) {
      const batch = emails.slice(i, i + chunk);
      const { data, error } = await sb
        .from("leads")
        .select(
          "id, name, email, phone, company, source, status, value, currency, owner, created_at, last_contact, notes",
        )
        .in("email", batch);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const lead = mapLead(row as Record<string, unknown>);
        if (lead.email) existingByEmail.set(lead.email.toLowerCase(), lead);
      }
    }
  }

  const emailCount = new Map<string, number>();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const payload: Record<string, unknown>[] = [];

  for (const write of writes) {
    const email = write.email;
    let id: string;
    if (email.includes("@")) {
      const n = emailCount.get(email) ?? 0;
      emailCount.set(email, n + 1);
      const prev = n === 0 ? existingByEmail.get(email) : undefined;
      if (prev) {
        const details = parseLeadDetails(prev);
        const tags = mergeTags(details.tags, TAG);
        const alreadyTagged =
          tagList(details.tags).some((t) => t.toLowerCase() === TAG.toLowerCase()) &&
          prev.notes.includes("Barcelonnette 2026");
        if (alreadyTagged) {
          skipped += 1;
          continue;
        }
        const merged: ContactWrite = {
          ...write,
          name: prev.name || write.name,
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
          notes: [
            leftoverFreeNotes(prev.notes),
            write.notes,
          ]
            .filter(Boolean)
            .join("\n"),
          status: prev.status,
        };
        const day = dayFromStamp(
          cell(
            rows.find(
              (r) =>
                cell(r, "Adresse e-mail").toLowerCase() === email,
            ) ?? {},
            "Horodateur",
          ),
        );
        payload.push({
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
        updated += 1;
        continue;
      }
      id = n === 0 ? `ld_${email}` : `ld_${email}_${n + 1}`;
    } else {
      id = `ld_barcelonnette_${String(payload.length + 1).padStart(4, "0")}`;
    }

    const stamp = cell(
      rows.find((r) => cell(r, "Adresse e-mail").toLowerCase() === email) ??
        {},
      "Horodateur",
    );
    const day = dayFromStamp(stamp);
    payload.push({
      id,
      name: write.name,
      email,
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

  const chunk = 100;
  for (let i = 0; i < payload.length; i += chunk) {
    const batch = payload.slice(i, i + chunk);
    const { error } = await sb.from("leads").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Supabase upsert ${i}: ${error.message}`);
    console.log(`Upserted ${Math.min(i + chunk, payload.length)}/${payload.length}`);
  }

  console.log(
    JSON.stringify(
      {
        file,
        formRows: rows.length,
        created,
        updated,
        skipped,
        tagged: TAG,
        withoutEmail: writes.filter((w) => !w.email.includes("@")).length,
      },
      null,
      2,
    ),
  );
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
