/**
 * Import Odoo sale orders from an Excel export into Supabase `sales`.
 *
 * Usage:
 *   npx tsx scripts/import-sales.ts
 *   npx tsx scripts/import-sales.ts -- "C:\path\to\Bon de commande (sale.order).xlsx"
 *
 * Requires .env.local (Supabase service role).
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import type { SaleStatus } from "../lib/demo-data";
import { getSupabase } from "../lib/supabase/server";

const DEFAULT_DOWNLOAD = resolve(
  homedir(),
  "Downloads",
  "Bon de commande (sale.order).xlsx",
);
const DATA_COPY = resolve(process.cwd(), "data", "sale-orders.xlsx");

function loadLocalEnv() {
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

function cell(row: Record<string, unknown>, key: string) {
  return String(row[key] ?? "").trim();
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dayFrom(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? new Date().toISOString().slice(0, 10);
}

function parseAmount(raw: string) {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function mapOdooStatus(statut: string): SaleStatus {
  const s = statut.trim().toLowerCase();
  if (s.includes("annul")) return "cancelled";
  if (s.includes("bon de commande") || s.includes("commande")) return "confirmed";
  if (s.includes("envoy")) return "sent";
  if (s.includes("verrou") || s.includes("termin")) return "fulfilled";
  if (s.includes("devis")) return "pending";
  return "pending";
}

function placeholderEmail(ref: string) {
  const slug = ref.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `order+${slug}@import.inkamototours.local`;
}

function notesFrom(row: Record<string, unknown>, statut: string) {
  const lines = ["Imported from Odoo sale.order export."];
  const vendeur = cell(row, "Vendeur");
  const activites = cell(row, "Activités");
  if (vendeur) lines.push(`Vendeur: ${vendeur}`);
  if (statut) lines.push(`Statut Odoo: ${statut}`);
  if (activites) lines.push(`Activités: ${activites}`);
  return lines.join("\n");
}

function resolveInputPath(argv: string[]) {
  const arg = argv.find((a) => !a.startsWith("-") && a.endsWith(".xlsx"));
  if (arg) return resolve(arg);
  if (existsSync(DATA_COPY)) return DATA_COPY;
  if (existsSync(DEFAULT_DOWNLOAD)) return DEFAULT_DOWNLOAD;
  throw new Error(
    `Spreadsheet not found. Pass a path or place the file at ${DEFAULT_DOWNLOAD}`,
  );
}

async function loadLeadLookup(sb: ReturnType<typeof getSupabase>) {
  const { data, error } = await sb.from("leads").select("id, name, email");
  if (error) throw new Error(error.message);

  const exact = new Map<string, { id: string; email: string }>();
  const rows = data ?? [];

  for (const lead of rows) {
    const name = String(lead.name ?? "").trim();
    const email = String(lead.email ?? "").trim().toLowerCase();
    if (!name || !email.includes("@")) continue;
    exact.set(normalizeName(name), { id: String(lead.id), email });
  }

  function match(customer: string) {
    const key = normalizeName(customer);
    if (!key) return null;
    const hit = exact.get(key);
    if (hit) return hit;

    for (const [leadName, lead] of exact) {
      if (key.includes(leadName) || leadName.includes(key)) return lead;
    }
    return null;
  }

  return { match, total: rows.length };
}

async function main() {
  loadLocalEnv();
  const input = resolveInputPath(process.argv.slice(2));

  mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
  if (input !== DATA_COPY) {
    copyFileSync(input, DATA_COPY);
    console.log(`Copied to ${DATA_COPY}`);
  }

  const wb = XLSX.read(readFileSync(input), { type: "buffer", raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (rows.length === 0) throw new Error("Spreadsheet is empty");

  const sb = getSupabase();
  const leads = await loadLeadLookup(sb);

  let matchedEmail = 0;
  const sales = rows.map((row) => {
    const number = cell(row, "Référence de commande");
    if (!number) throw new Error("Row missing order reference");
    const customer = cell(row, "Client") || "Unknown";
    const statut = cell(row, "Statut");
    const status = mapOdooStatus(statut);
    const createdAt = dayFrom(cell(row, "Date de création"));
    const closedAt = status === "cancelled" || status === "fulfilled" ? createdAt : null;
    const lead = leads.match(customer);
    if (lead) matchedEmail += 1;
    const email = lead?.email ?? placeholderEmail(number);
    const activites = cell(row, "Activités");

    return {
      id: `sale_odoo_${number.toLowerCase()}`,
      number,
      customer,
      email,
      product: activites || "Circuit moto Inkamoto",
      amount: parseAmount(cell(row, "Total")),
      currency: "EUR",
      status,
      source: lead ? "lead" : "website",
      inquiry_id: null,
      lead_id: lead?.id ?? null,
      created_at: createdAt,
      closed_at: closedAt,
      notes: notesFrom(row, statut),
      lines: [],
      quote_template_name:
        activites || "Le grand chemin des Incas via la route des canyons",
      payment_terms: "",
      validity_date: null,
      terms_html: "",
      salesperson: cell(row, "Vendeur"),
      invoice_id: null,
    };
  });

  const chunk = 100;
  for (let i = 0; i < sales.length; i += chunk) {
    const batch = sales.slice(i, i + chunk);
    const { error } = await sb.from("sales").upsert(batch, { onConflict: "number" });
    if (error) throw new Error(`Supabase ${i}: ${error.message}`);
    console.log(`Sales ${Math.min(i + chunk, sales.length)}/${sales.length}`);
  }

  const byStatus = sales.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        file: input,
        rows: rows.length,
        imported: sales.length,
        leadsIndexed: leads.total,
        matchedLeadEmail: matchedEmail,
        byStatus,
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
