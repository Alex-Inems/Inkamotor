import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const rawPath = resolve("lib/seed/odoo-mail-templates.json");
const outPath = resolve("lib/seed/odoo-message-templates.json");

const raw = JSON.parse(readFileSync(rawPath, "utf8")) as {
  fetchedAt: string;
  templates: Array<{
    id: number;
    name: string;
    model: string | null;
    subject: string;
    bodyHtml: string;
  }>;
};

const SYSTEM =
  /^(Appointment:|Calendar:|Gamification:|Settings:|Sales:|Purchase:|Planning:|Project:|Survey:|Shipping:|Payment:|Invoice:|Credit Note|Customer Statement|Follow Up Report|Journal Notification|Bank connection|IAP |Mail: Install|Self-billing|Tax payment|Website:|New eInvoices|Payment Reminder)/;

const MODELS = new Set(["crm.lead", "sale.order", "res.partner", "account.move"]);

function decode(s: string) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCharCode(Number(n)),
    )
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToText(html: string) {
  let s = String(html || "");
  s = s.replace(
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, label: string) => {
      const text = decode(label.replace(/<[^>]+>/g, "")).trim() || href;
      return text === href ? href : `[${text}](${href})`;
    },
  );
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n");
  s = s.replace(/<(p|div|h[1-6]|li|tr)(\s[^>]*)?>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<t[\s\S]*?<\/t>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<[^>]+>/g, "");
  s = decode(s);
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

const templates = [];
for (const t of raw.templates) {
  if (!t.model || !MODELS.has(t.model)) continue;
  if (SYSTEM.test(t.name)) continue;
  if (/\{\{|\{%|<t\s/.test(t.bodyHtml || "")) continue;
  const body = htmlToText(t.bodyHtml);
  if (body.length < 40) continue;
  if (/^--\s*Administrator\s*$/i.test(body)) continue;
  templates.push({
    id: t.id,
    name: t.name,
    model: t.model as
      | "crm.lead"
      | "sale.order"
      | "res.partner"
      | "account.move",
    subject: (t.subject || "").trim(),
    body,
  });
}

templates.sort((a, b) => a.name.localeCompare(b.name, "fr"));

writeFileSync(
  outPath,
  JSON.stringify({ fetchedAt: raw.fetchedAt, templates }, null, 2),
);
console.log(`wrote ${templates.length} templates → ${outPath}`);
for (const t of templates) {
  console.log(
    `${t.id}\t${t.model}\t${t.name}\t| ${t.body.slice(0, 70).replace(/\n/g, " ")}`,
  );
}

// Drop the bulky raw dump from the working tree (kept only for this build).
if (existsSync(rawPath)) {
  unlinkSync(rawPath);
  console.log(`removed bulky ${rawPath}`);
}
