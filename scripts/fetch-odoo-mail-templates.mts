import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

const { connectOdooSession } = await import("../lib/odoo/session.ts");
const odoo = await connectOdooSession();

function stripPreview(html: unknown) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const templates = await odoo.executeKw<
  Array<{
    id: number;
    name: string;
    model: string | false;
    subject: string | false;
    body_html: string | false;
    description: string | false;
    active: boolean;
  }>
>("mail.template", "search_read", [[]], {
  fields: ["id", "name", "model", "subject", "body_html", "description", "active"],
  limit: 500,
  order: "name asc",
});

const summarized = templates.map((t) => ({
  id: t.id,
  name: t.name,
  model: t.model || null,
  subject: t.subject || "",
  active: t.active,
  bodyPreview: stripPreview(t.body_html).slice(0, 180),
  bodyHtml: typeof t.body_html === "string" ? t.body_html : "",
}));

console.log(`mail.template count: ${summarized.length}`);
for (const t of summarized) {
  console.log(
    `- [${t.id}] ${t.name} | model=${t.model} | subject=${JSON.stringify(t.subject)} | ${t.bodyPreview.slice(0, 80)}`,
  );
}

let shortcodes: unknown[] = [];
try {
  shortcodes = await odoo.executeKw("mail.shortcode", "search_read", [[]], {
    fields: ["id", "source", "substitution", "description"],
    limit: 200,
  });
  console.log(`mail.shortcode count: ${(shortcodes as unknown[]).length}`);
} catch (e) {
  console.log("mail.shortcode:", e instanceof Error ? e.message : e);
}

const out = resolve(process.cwd(), "lib/seed/odoo-mail-templates.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      templates: summarized,
      shortcodes,
    },
    null,
    2,
  ),
);
console.log(`wrote ${out}`);
