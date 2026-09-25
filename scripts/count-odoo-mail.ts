/**
 * Probe + count CRM odoo-msg-* rows (no secrets printed).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

loadEnv();
const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const { count: odooCount, error: e1 } = await sb
  .from("mail_messages")
  .select("*", { count: "exact", head: true })
  .like("message_id", "odoo-msg-%");
const { count: total, error: e2 } = await sb
  .from("mail_messages")
  .select("*", { count: "exact", head: true });
const { data: sample } = await sb
  .from("mail_messages")
  .select("message_id,from_email,to_email,subject,received_at")
  .like("message_id", "odoo-msg-%")
  .order("received_at", { ascending: false })
  .limit(3);

console.log(
  JSON.stringify(
    { odooCount, total, sample, errors: [e1?.message, e2?.message].filter(Boolean) },
    null,
    2,
  ),
);
