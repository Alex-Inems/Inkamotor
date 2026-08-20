/**
 * Pre-translate every stored inbox message and reply into the CRM languages
 * (EN, FR, ES). Results are cached in `mail_translations`, so Inbox can show
 * unopened conversations in the chosen language without waiting.
 *
 * Usage:
 *   npm run translate-inbox
 *   npm run translate-inbox -- --locale=fr
 *
 * Requires .env.local (Supabase) and supabase/mail_translations.sql once.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isLocale, locales, type Locale } from "../lib/i18n/config";

function loadLocalEnv() {
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

function parseLocales(argv: string[]): Locale[] {
  const flag = argv.find((a) => a.startsWith("--locale="));
  if (!flag) return [...locales];
  const value = flag.slice("--locale=".length).toLowerCase();
  if (!isLocale(value)) {
    throw new Error(`Unknown locale "${value}". Use en, fr, or es.`);
  }
  return [value];
}

async function main() {
  loadLocalEnv();
  const targets = parseLocales(process.argv.slice(2));
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const { translateAllStoredMail } = await import(
    "../lib/mail/translate-mailbox"
  );

  console.log(
    `Translating inbox → ${targets.join(", ").toUpperCase()} (every message, including unread)…`,
  );
  const result = await translateAllStoredMail(targets);
  console.log(
    `Mailbox: ${result.messages} incoming + ${result.replies} sent replies`,
  );
  for (const locale of result.locales) {
    const s = result.stats[locale];
    console.log(
      `  ${locale}: ${s.translated} translated, ${s.cached} cached, ${s.failed} failed (${s.unique} unique strings)`,
    );
  }
  console.log("Done. Open Inbox and switch EN / FR / ES — all threads update.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
