/**
 * Export Inkamoto CRM clients into 3 distinct files by language:
 * - exports/clients_english.csv
 * - exports/clients_french.csv
 * - exports/clients_spanish.csv
 * (+ exports/clients_unclassified.csv for leads with zero signals)
 *
 * Usage:
 *   npx --yes tsx scripts/export-clients-by-language.ts
 *   npm run export-clients-by-language
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  detectClientLanguage,
  type ClientLanguage,
} from "../lib/crm/client-language";
import { parseLeadDetails } from "../lib/crm/contact-details";
import type { Lead } from "../lib/demo-data";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = val;
    }
  }
}

function escapeCsv(val: unknown): string {
  if (val == null) return '""';
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}

function toCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(",");
}

const CSV_HEADERS = [
  "ID",
  "Name",
  "Email",
  "Phone",
  "Company",
  "Country",
  "City",
  "Language Code",
  "Language Label",
  "Confidence",
  "Detection Reason",
  "Status",
  "Value (USD)",
  "Total Messages Exchanged",
  "Created At",
  "Last Contact",
];

async function main() {
  loadLocalEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  const sb = createClient(url, key);

  console.log("=================================================");
  console.log("  Inkamoto CRM — Export Clients by Language");
  console.log("=================================================");
  console.log("1. Fetching all clients (leads)...");

  const leads: Lead[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Supabase query error: ${error.message}`);
    if (!data || data.length === 0) break;
    leads.push(...(data as Lead[]));
    from += PAGE;
  }
  console.log(`   Found ${leads.length} clients in database.`);

  console.log("2. Fetching message history for language matching...");
  // Group inbound messages by sender email
  const messageTextsByEmail = new Map<string, string[]>();
  const messageCountByEmail = new Map<string, number>();

  let msgFrom = 0;
  while (true) {
    const { data, error } = await sb
      .from("mail_messages")
      .select("from_email, subject, body_text")
      .range(msgFrom, msgFrom + PAGE - 1);

    if (error || !data || data.length === 0) break;
    for (const m of data) {
      const email = (m.from_email || "").toLowerCase().trim();
      if (!email) continue;
      if (!messageTextsByEmail.has(email)) messageTextsByEmail.set(email, []);
      messageTextsByEmail.get(email)!.push(`${m.subject || ""} ${m.body_text || ""}`);
      messageCountByEmail.set(email, (messageCountByEmail.get(email) || 0) + 1);
    }
    msgFrom += PAGE;
  }

  // Group outbound replies by recipient email
  const { data: replies } = await sb
    .from("mail_replies")
    .select("to_email, subject, body_text");

  for (const r of replies || []) {
    const email = (r.to_email || "").toLowerCase().trim();
    if (!email) continue;
    if (!messageTextsByEmail.has(email)) messageTextsByEmail.set(email, []);
    messageTextsByEmail.get(email)!.push(`${r.subject || ""} ${r.body_text || ""}`);
    messageCountByEmail.set(email, (messageCountByEmail.get(email) || 0) + 1);
  }

  console.log(
    `   Indexed conversations across ${messageTextsByEmail.size} distinct email threads.`,
  );

  console.log("3. Classifying clients into EN, FR, and ES...");

  type ExportRow = {
    lead: Lead;
    language: ClientLanguage;
    label: string;
    confidence: string;
    reason: string;
    country: string;
    city: string;
    messageCount: number;
  };

  const buckets: Record<ClientLanguage, ExportRow[]> = {
    en: [],
    fr: [],
    es: [],
    unknown: [],
  };

  for (const lead of leads) {
    const email = (lead.email || "").toLowerCase().trim();
    const thread = messageTextsByEmail.get(email)?.join("\n\n") || "";
    const msgCount = messageCountByEmail.get(email) || 0;

    const details = parseLeadDetails(lead);
    const detection = detectClientLanguage(lead, {
      messagesText: thread,
      explicitCountry: details.country,
    });

    const labelMap: Record<ClientLanguage, string> = {
      en: "English",
      fr: "Français (French)",
      es: "Español (Spanish)",
      unknown: "Unclassified",
    };

    const row: ExportRow = {
      lead,
      language: detection.language,
      label: labelMap[detection.language],
      confidence: detection.confidence,
      reason: detection.reason,
      country: details.country || "",
      city: details.city || "",
      messageCount: msgCount,
    };

    buckets[detection.language].push(row);
  }

  // Ensure export output directory exists
  const outDir = resolve(process.cwd(), "exports");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  console.log("4. Writing sorted CSV files (UTF-8 with BOM for Excel)...");

  function exportBucket(lang: ClientLanguage, filename: string) {
    const list = buckets[lang];
    const rows = [
      toCsvRow(CSV_HEADERS),
      ...list.map((r) =>
        toCsvRow([
          r.lead.id,
          r.lead.name,
          r.lead.email,
          r.lead.phone,
          r.lead.company,
          r.country,
          r.city,
          r.language.toUpperCase(),
          r.label,
          r.confidence,
          r.reason,
          r.lead.status,
          r.lead.value,
          r.messageCount,
          r.lead.created_at,
          r.lead.last_contact,
        ]),
      ),
    ];

    // Prepend UTF-8 BOM (\uFEFF) so Excel opens accents (é, è, ñ, etc.) without garbled text
    const csvContent = "\uFEFF" + rows.join("\r\n");
    const targetPath = resolve(outDir, filename);
    writeFileSync(targetPath, csvContent, "utf8");
    return targetPath;
  }

  const enFile = exportBucket("en", "clients_english.csv");
  const frFile = exportBucket("fr", "clients_french.csv");
  const esFile = exportBucket("es", "clients_spanish.csv");
  const unFile = exportBucket("unknown", "clients_unclassified.csv");

  console.log("\n=================================================");
  console.log("  EXPORT COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
  console.log(`🇬🇧 English clients : ${buckets.en.length.toString().padStart(5)} -> ${enFile}`);
  console.log(`🇫🇷 French clients  : ${buckets.fr.length.toString().padStart(5)} -> ${frFile}`);
  console.log(`🇪🇸 Spanish clients : ${buckets.es.length.toString().padStart(5)} -> ${esFile}`);
  console.log(`🌐 Unclassified    : ${buckets.unknown.length.toString().padStart(5)} -> ${unFile}`);
  console.log("-------------------------------------------------");
  console.log(`TOTAL CLIENTS      : ${leads.length}`);
  console.log("=================================================\n");
}

main().catch((err) => {
  console.error("Export error:", err);
  process.exit(1);
});
