/**
 * Import Odoo Email Marketing mailings into newsletter_mailings.
 *
 * Source: data/odoo-mailings-full.json (export from inkamoto-tours.odoo.com)
 *
 * Usage:
 *   npx tsx scripts/import-odoo-mailings.ts
 *
 * Requires .env.local (Supabase) and supabase/newsletter_mailings_odoo_stats.sql applied.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabase } from "../lib/supabase/server";

type OdooRow = {
  odooId: number;
  subject: string;
  state: string;
  calendarDate: string | null;
  sentDate: string | null;
  scheduleDate: string | null;
  createDate: string | null;
  writeDate: string | null;
  responsible: string;
  sent: number;
  deliveredPct: number;
  openPct: number;
  clickPct: number;
  replyPct: number;
  html?: string;
};

const DEFAULT_FILE = resolve(process.cwd(), "data", "odoo-mailings-full.json");

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

function mapStatus(state: string): "draft" | "in_queue" | "sending" | "sent" {
  if (state === "draft") return "draft";
  if (state === "in_queue") return "in_queue";
  if (state === "sending") return "sending";
  return "sent";
}

function asIso(value: string | null | false | undefined): string | null {
  if (!value || value === false) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Odoo often returns "YYYY-MM-DD HH:mm:ss" (UTC-ish server time)
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function mailingDate(row: OdooRow): string | null {
  return (
    asIso(row.sentDate) ||
    asIso(row.calendarDate) ||
    asIso(row.scheduleDate) ||
    asIso(row.writeDate) ||
    asIso(row.createDate)
  );
}

async function main() {
  loadEnv();
  const file = resolve(process.argv[2] || DEFAULT_FILE);
  if (!existsSync(file)) {
    console.error(`Missing export file: ${file}`);
    process.exit(1);
  }

  const rows = JSON.parse(readFileSync(file, "utf8")) as OdooRow[];
  if (!Array.isArray(rows) || !rows.length) {
    console.error("Export file is empty");
    process.exit(1);
  }

  const sb = getSupabase();
  let upserted = 0;
  let failed = 0;

  for (const row of rows) {
    const id = `odoo_${row.odooId}`;
    const subject = (row.subject || "").trim() || `Mailing #${row.odooId}`;
    const status = mapStatus(row.state);
    const date = mailingDate(row);
    const now = new Date().toISOString();
    const created = asIso(row.createDate) || date || now;
    const updated = asIso(row.writeDate) || date || now;

    const payload = {
      id,
      name: subject,
      subject,
      preview: "",
      html: row.html || "",
      status,
      recipient_tag: null as string | null,
      emails: [] as string[],
      scheduled_at: asIso(row.scheduleDate),
      responsible: (row.responsible || "Team").replace(/\s+/g, " ").trim(),
      template_id: null as string | null,
      odoo_id: row.odooId,
      mailing_date: date,
      sent_count: Math.max(0, Math.round(Number(row.sent) || 0)),
      delivered_pct: Number(row.deliveredPct) || 0,
      open_pct: Number(row.openPct) || 0,
      click_pct: Number(row.clickPct) || 0,
      reply_pct: Number(row.replyPct) || 0,
      created_at: created,
      updated_at: updated,
    };

    const { error } = await sb.from("newsletter_mailings").upsert(payload, {
      onConflict: "id",
    });
    if (error) {
      failed += 1;
      console.error(`#${row.odooId} ${subject}: ${error.message}`);
    } else {
      upserted += 1;
    }
  }

  console.log(
    `Done. upserted=${upserted} failed=${failed} total=${rows.length}`,
  );
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
