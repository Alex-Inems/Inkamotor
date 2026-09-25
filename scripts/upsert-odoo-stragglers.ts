/**
 * Upsert two stubborn Odoo messages that failed via the batch ingest.
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

const rows = [
  {
    message_id: "odoo-msg-200096",
    folder: "INBOX",
    from_name: "louis.lochon",
    from_email: "louis.lochon@gmail.com",
    to_email: process.env.IMAP_USER || "contact@inkamototours.com",
    subject: "RE: POSSIBLE DE LE FAIRE A  SUR LA MOTO",
    preview: "RE: POSSIBLE DE LE FAIRE A  SUR LA MOTO",
    body_text: "RE: POSSIBLE DE LE FAIRE A  SUR LA MOTO",
    received_at: "2026-02-11T13:38:15.000Z",
    is_read: true,
    synced_at: new Date().toISOString(),
  },
  {
    message_id: "odoo-msg-239759",
    folder: "INBOX",
    from_name: "Michel Feriti",
    from_email: "michelferiti@gmail.com",
    to_email: process.env.IMAP_USER || "contact@inkamototours.com",
    subject: "Re: qu’elle est la meilleure période.",
    preview: "Re: qu’elle est la meilleure période.",
    body_text: "Re: qu’elle est la meilleure période.",
    received_at: "2026-06-02T06:46:06.000Z",
    is_read: true,
    synced_at: new Date().toISOString(),
  },
];

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  for (const row of rows) {
    const { error } = await sb
      .from("mail_messages")
      .upsert(row, { onConflict: "message_id" });
    console.log(row.message_id, error ? error.message : "ok");
  }
  const { count } = await sb
    .from("mail_messages")
    .select("*", { count: "exact", head: true })
    .like("message_id", "odoo-msg-%");
  console.log("odoo-msg count:", count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
