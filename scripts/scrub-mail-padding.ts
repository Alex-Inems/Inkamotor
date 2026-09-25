/**
 * Scrub Outlook invisible padding / excess blank lines from stored mail bodies.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

function scrub(raw: string) {
  return raw
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad\u034f\u180e]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  let from = 0;
  let updated = 0;
  let scanned = 0;
  for (;;) {
    let q = sb
      .from("mail_messages")
      .select("id, body_text, preview")
      .range(from, from + 199);
    if (email) {
      q = q.or(`from_email.eq.${email},to_email.eq.${email}`);
    } else {
      q = q.or("message_id.like.odoo-sale-msg-%,message_id.like.odoo-msg-%");
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      scanned += 1;
      const body = String(row.body_text ?? "");
      const next = scrub(body);
      if (next === body) continue;
      const preview = next.replace(/\s+/g, " ").slice(0, 240);
      const { error: upErr } = await sb
        .from("mail_messages")
        .update({ body_text: next, preview })
        .eq("id", row.id);
      if (upErr) {
        console.error(row.id, upErr.message);
        continue;
      }
      updated += 1;
    }
    if (rows.length < 200) break;
    from += 200;
  }
  console.log({ scanned, updated, email: email || "(all odoo imports)" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
