/**
 * Pull more history from Namecheap IMAP into mail_messages.
 * Usage: npx tsx scripts/sync-imap-history.ts [limit]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { syncImapInbox } from "../lib/mail/imap";

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

async function main() {
  loadEnv();
  const limit = Number(process.argv[2] || "800");
  console.log(`Syncing IMAP (limit=${limit})…`);
  const result = await syncImapInbox(
    Number.isFinite(limit) && limit > 0 ? limit : 800,
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
