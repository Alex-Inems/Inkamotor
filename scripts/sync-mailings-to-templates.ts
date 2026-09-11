/**
 * Upsert every newsletter mailing as a reusable template.
 * Template ids are stable: tpl_mailing_{mailingId}
 *
 * Usage: npx tsx scripts/sync-mailings-to-templates.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { templateIdForMailing } from "../lib/newsletter/templates";
import { getSupabase } from "../lib/supabase/server";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i < 0) continue;
      const key = trimmed.slice(0, i).trim();
      let val = trimmed.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

async function main() {
  loadEnv();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("newsletter_mailings")
    .select("id, name, subject, preview, html")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = (row.name || row.subject || "").trim();
    const html = (row.html || "").trim();
    if (!name || !html) {
      skipped += 1;
      continue;
    }
    const id = templateIdForMailing(row.id);
    const { error: upErr } = await sb.from("newsletter_templates").upsert(
      {
        id,
        name,
        subject: (row.subject || name).trim(),
        preview: (row.preview || "").trim(),
        html,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (upErr) throw new Error(`${row.id}: ${upErr.message}`);
    upserted += 1;
  }

  console.log(
    JSON.stringify({ mailings: rows.length, upserted, skipped }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
