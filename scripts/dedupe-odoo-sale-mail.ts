/**
 * Remove duplicate odoo-msg-* rows when odoo-sale-msg-* already exists
 * for the same Odoo mail.message id (sale import carries attachments).
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

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function loadAll(prefix: string) {
  const rows: { id: string; num: string }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("mail_messages")
      .select("id, message_id")
      .like("message_id", `${prefix}%`)
      .order("message_id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`${prefix}: ${error.message}`);
    const batch = data ?? [];
    for (const row of batch) {
      const mid = String(row.message_id ?? "");
      rows.push({ id: String(row.id), num: mid.slice(prefix.length) });
    }
    console.log(`loaded ${prefix}*`, rows.length);
    if (batch.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  const sale = await loadAll("odoo-sale-msg-");
  const saleNums = new Set(sale.map((r) => r.num));
  const mail = await loadAll("odoo-msg-");
  const toDelete = mail.filter((r) => saleNums.has(r.num));
  console.log("duplicates", toDelete.length);

  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 50) {
    const chunk = toDelete.slice(i, i + 50);
    const { error } = await sb
      .from("mail_messages")
      .delete()
      .in(
        "id",
        chunk.map((r) => r.id),
      );
    if (error) {
      console.error("batch fail", error.message);
      continue;
    }
    deleted += chunk.length;
    console.log("deleted", deleted, "/", toDelete.length);
  }
  console.log("done", { deleted });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
