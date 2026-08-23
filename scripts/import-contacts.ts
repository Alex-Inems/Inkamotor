import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { importContactsToList } from "../lib/brevo";
import { getSupabase } from "../lib/supabase/server";

const FILE = resolve(process.cwd(), "data", "contacts.xlsx");

const SKIP_KEYS = new Set(["Avatar 128"]);

function cell(row: Record<string, unknown>, key: string) {
  return String(row[key] ?? "").trim();
}

function dayFrom(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? new Date().toISOString().slice(0, 10);
}

function notesFrom(row: Record<string, unknown>) {
  const lines: string[] = ["Imported from Odoo contacts."];
  for (const [key, raw] of Object.entries(row)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = String(raw ?? "").trim();
    if (!value) continue;
    if (
      key === "Nom complet" ||
      key === "Email" ||
      key === "Téléphone" ||
      key === "Société associée"
    ) {
      continue;
    }
    lines.push(`${key}: ${value}`);
  }
  return lines.join("\n");
}

function isCompanyRow(row: Record<string, unknown>) {
  return /^(true|1|yes|oui|vrai)$/i.test(cell(row, "Est une société"));
}

function companyOf(row: Record<string, unknown>) {
  const associated = cell(row, "Société associée");
  if (associated) return associated;
  if (!isCompanyRow(row)) return "";
  const name = cell(row, "Nom complet");
  if (name && !name.includes("@")) return name;
  return "";
}

function displayName(row: Record<string, unknown>, index: number) {
  const name = cell(row, "Nom complet");
  if (name && !name.includes("@")) return name;
  const company = companyOf(row);
  if (company) return company;
  const email = cell(row, "Email");
  if (email) return email.split("@")[0] ?? email;
  if (name) return name;
  return `Contact ${index + 1}`;
}

async function main() {
  const wb = XLSX.read(readFileSync(FILE), { type: "buffer", raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (rows.length === 0) throw new Error("Spreadsheet is empty");

  const emailCount = new Map<string, number>();
  const leads = rows.map((row, index) => {
    const rawEmail = cell(row, "Email").toLowerCase();
    const email = rawEmail;
    let id: string;
    if (email) {
      const n = emailCount.get(email) ?? 0;
      emailCount.set(email, n + 1);
      id = n === 0 ? `ld_${email}` : `ld_${email}_${n + 1}`;
    } else {
      id = `ld_xlsx_${String(index + 1).padStart(4, "0")}`;
    }
    const updated = dayFrom(cell(row, "Mis à jour le"));
    return {
      id,
      name: displayName(row, index),
      email,
      phone: cell(row, "Téléphone"),
      company: companyOf(row),
      source: "manual",
      status: "new",
      value: 0,
      currency: "USD",
      owner: "Team",
      created_at: updated,
      last_contact: updated,
      notes: notesFrom(row),
    };
  });

  const sb = getSupabase();
  const chunk = 200;
  for (let i = 0; i < leads.length; i += chunk) {
    const batch = leads.slice(i, i + chunk);
    const { error } = await sb.from("leads").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Supabase ${i}: ${error.message}`);
    console.log(`Leads ${Math.min(i + chunk, leads.length)}/${leads.length}`);
  }

  const subscribers = leads
    .filter((lead) => lead.email.includes("@"))
    .map((lead) => ({
      email: lead.email,
      name: lead.name.includes("@") ? "" : lead.name,
    }));

  let subscribed = 0;
  try {
    subscribed = await importContactsToList(subscribers);
    console.log(`Newsletter ${subscribed} unique emails queued in Brevo`);
  } catch (err) {
    console.error(
      "Leads saved, newsletter import failed:",
      err instanceof Error ? err.message : err,
    );
  }

  console.log(
    JSON.stringify(
      {
        rows: rows.length,
        leads: leads.length,
        withoutEmail: leads.filter((l) => !l.email).length,
        newsletter: subscribed,
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
