import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (process.env[k] == null) process.env[k] = v;
  }
}

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// Is Numeriser 127.pdf already in CRM?
const { data: existing } = await sb
  .from("mail_reply_attachments")
  .select("id, file_name, byte_size, reply_id")
  .ilike("file_name", "%127.pdf%")
  .limit(20);

console.log("existing 127.pdf attachments:", JSON.stringify(existing, null, 2));

const { count: attCount } = await sb
  .from("mail_reply_attachments")
  .select("id", { count: "exact", head: true });

console.log("total attachments in CRM:", attCount);

writeFileSync("data/odoo-sale-msg-missing-ids.json", "[]");
console.log("cleared missing-ids file");
