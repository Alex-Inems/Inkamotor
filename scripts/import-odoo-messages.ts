/**
 * Import Odoo chatter / email history for CRM contacts into mail_messages.
 *
 * Requires in .env.local:
 *   ODOO_URL=https://inkamoto-tours.odoo.com
 *   ODOO_DB=...
 *   ODOO_USERNAME=...
 *   ODOO_API_KEY=...
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/import-odoo-messages.ts
 *   npx tsx scripts/import-odoo-messages.ts --limit=50
 *   npx tsx scripts/import-odoo-messages.ts --email=client@example.com
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { missingOdooEnv } from "../lib/odoo/client";
import { importOdooClientMessages } from "../lib/odoo/import-messages";
import { missingSupabaseEnv } from "../lib/supabase/server";

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

function argValue(prefix: string) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  loadEnv();
  const missing = [...missingSupabaseEnv(), ...missingOdooEnv()];
  if (missing.length) {
    console.error(
      `Missing env: ${missing.join(", ")}\n` +
        `Add Odoo API credentials to .env.local (see .env.example), then re-run.`,
    );
    process.exit(1);
  }

  console.log(
    `Odoo ${process.env.ODOO_URL} / db=${process.env.ODOO_DB}`,
  );
  const limitRaw = argValue("--limit=");
  const email = argValue("--email=");
  const limitPartners = limitRaw ? Number(limitRaw) : undefined;

  console.log("Importing Odoo client messages…");
  const stats = await importOdooClientMessages({
    emails: email ? [email] : undefined,
    limitPartners:
      limitPartners && Number.isFinite(limitPartners)
        ? limitPartners
        : undefined,
  });

  console.log(
    JSON.stringify(
      {
        partnersMatched: stats.partners,
        messagesFetched: stats.fetched,
        upserted: stats.upserted,
        skipped: stats.skipped,
        errors: stats.errors.slice(0, 20),
        errorCount: stats.errors.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
