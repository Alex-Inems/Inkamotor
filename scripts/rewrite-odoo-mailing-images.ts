/**
 * Upload Odoo mailing images to Supabase Storage and rewrite mailing HTML.
 *
 * Prerequisites:
 *   1. npx tsx scripts/odoo-image-sink.ts  (running)
 *   2. Browser scrape posted images into data/odoo-mailing-images/
 *   3. data/odoo-mailings-full.json present
 *
 * Usage:
 *   npx tsx scripts/rewrite-odoo-mailing-images.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabase } from "../lib/supabase/server";

const BUCKET = "mailing-assets";
const IMG_DIR = resolve(process.cwd(), "data", "odoo-mailing-images");
const MANIFEST = resolve(IMG_DIR, "manifest.json");
const FULL = resolve(process.cwd(), "data", "odoo-mailings-full.json");
const ODOO_ORIGIN = "https://inkamoto-tours.odoo.com";

type Manifest = Record<
  string,
  { file: string; contentType: string; bytes: number }
>;

type OdooRow = {
  odooId: number;
  subject: string;
  state: string;
  calendarDate: string | null;
  sentDate: string | null;
  scheduleDate: string | null;
  createDate: string | null;
  writeDate: string | null;
  responsible: string;
  sent: number;
  deliveredPct: number;
  openPct: number;
  clickPct: number;
  replyPct: number;
  html?: string;
};

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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/^"+|"+$/g, "")
    .trim();
}

function collectUrls(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/\b(?:src|data-original-src)=["']([^"']+)["']/gi)) {
    found.add(decodeHtmlEntities(m[1]!));
  }
  for (const m of html.matchAll(/url\(([^)]+)\)/gi)) {
    found.add(decodeHtmlEntities(m[1]!.replace(/["']/g, "").trim()));
  }
  // Broken Odoo exports sometimes embed &quot;/web/image/...&quot; literally
  for (const m of html.matchAll(/&quot;(\/web[^&]+)&quot;/gi)) {
    found.add(decodeHtmlEntities(m[1]!));
  }
  return [...found].filter(
    (u) =>
      u &&
      u !== "null" &&
      !u.startsWith("data:") &&
      !u.startsWith("#") &&
      (u.startsWith("/") ||
        u.includes("odoo.com") ||
        u.startsWith("web/") ||
        u.startsWith("/web")),
  );
}

function normalizeKey(url: string): string[] {
  let path = url.trim();
  if (path.startsWith(ODOO_ORIGIN)) path = path.slice(ODOO_ORIGIN.length);
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      path = new URL(path).pathname + new URL(path).search;
    } catch {
      /* keep */
    }
  }
  const bare = path.split("?")[0]!;
  return path === bare ? [path] : [path, bare];
}

async function ensureBucket() {
  const sb = getSupabase();
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`createBucket: ${error.message}`);
    }
  }
}

async function uploadAll(manifest: Manifest) {
  const sb = getSupabase();
  const urlByPath = new Map<string, string>();

  for (const [path, meta] of Object.entries(manifest)) {
    if (urlByPath.has(path)) continue;
    const local = resolve(IMG_DIR, meta.file);
    if (!existsSync(local)) {
      console.warn("missing file", meta.file);
      continue;
    }
    const buf = readFileSync(local);
    const hash = createHash("sha1").update(path.split("?")[0]!).digest("hex").slice(0, 20);
    const ext = meta.file.includes(".") ? meta.file.slice(meta.file.lastIndexOf(".")) : ".bin";
    const storagePath = `odoo/${hash}${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(storagePath, buf, {
      contentType: meta.contentType,
      upsert: true,
    });
    if (error) {
      console.error("upload fail", path, error.message);
      continue;
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = data.publicUrl;
    for (const key of normalizeKey(path)) urlByPath.set(key, publicUrl);
    urlByPath.set(path, publicUrl);
  }
  return urlByPath;
}

function rewriteHtml(html: string, urlByPath: Map<string, string>) {
  let out = html;
  const replaceUrl = (raw: string) => {
    const decoded = decodeHtmlEntities(raw);
    const keys = [
      raw,
      decoded,
      ...normalizeKey(raw),
      ...normalizeKey(decoded),
      `&quot;${decoded}&quot;`,
    ];
    for (const key of keys) {
      const hit = urlByPath.get(key);
      if (hit) return hit;
    }
    if (decoded.startsWith("/") && urlByPath.has(decoded)) {
      return urlByPath.get(decoded)!;
    }
    return decoded.startsWith("http") ? decoded : raw;
  };

  out = out.replace(
    /\b(src|data-original-src)=["']([^"']+)["']/gi,
    (_full, attr: string, url: string) => `${attr}="${replaceUrl(url)}"`,
  );
  out = out.replace(/url\(([^)]+)\)/gi, (_full, inner: string) => {
    const cleaned = decodeHtmlEntities(inner.replace(/["']/g, "").trim());
    const next = replaceUrl(cleaned);
    return `url("${next}")`;
  });
  out = out.replace(/&quot;(\/web[^&]+)&quot;/gi, (_full, path: string) => {
    return replaceUrl(path);
  });
  return out;
}

function mapStatus(state: string): "draft" | "in_queue" | "sending" | "sent" {
  if (state === "draft") return "draft";
  if (state === "in_queue") return "in_queue";
  if (state === "sending") return "sending";
  return "sent";
}

function asIso(value: string | null | false | undefined): string | null {
  if (!value || value === false) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function mailingDate(row: OdooRow): string | null {
  return (
    asIso(row.sentDate) ||
    asIso(row.calendarDate) ||
    asIso(row.scheduleDate) ||
    asIso(row.writeDate) ||
    asIso(row.createDate)
  );
}

async function main() {
  loadEnv();
  if (!existsSync(MANIFEST)) {
    console.error("Missing image manifest. Run the browser image scrape first.");
    process.exit(1);
  }
  if (!existsSync(FULL)) {
    console.error("Missing data/odoo-mailings-full.json");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
  console.log("manifest images", Object.keys(manifest).length);

  await ensureBucket();
  const urlByPath = await uploadAll(manifest);
  console.log("public urls", urlByPath.size);

  const rows = JSON.parse(readFileSync(FULL, "utf8")) as OdooRow[];
  let rewritten = 0;
  let stillRelative = 0;

  for (const row of rows) {
    const before = row.html || "";
    const after = rewriteHtml(before, urlByPath);
    if (after !== before) rewritten += 1;
    row.html = after;
    const left = collectUrls(after).filter((u) => u.startsWith("/"));
    stillRelative += left.length;
  }

  writeFileSync(FULL, JSON.stringify(rows));
  console.log({ rewritten, stillRelative });

  const sb = getSupabase();
  let upserted = 0;
  let failed = 0;
  for (const row of rows) {
    const id = `odoo_${row.odooId}`;
    const subject = (row.subject || "").trim() || `Mailing #${row.odooId}`;
    const date = mailingDate(row);
    const now = new Date().toISOString();
    const payload = {
      id,
      name: subject,
      subject,
      preview: "",
      html: row.html || "",
      status: mapStatus(row.state),
      recipient_tag: null as string | null,
      emails: [] as string[],
      scheduled_at: asIso(row.scheduleDate),
      responsible: (row.responsible || "Team").replace(/\s+/g, " ").trim(),
      template_id: null as string | null,
      odoo_id: row.odooId,
      mailing_date: date,
      sent_count: Math.max(0, Math.round(Number(row.sent) || 0)),
      delivered_pct: Number(row.deliveredPct) || 0,
      open_pct: Number(row.openPct) || 0,
      click_pct: Number(row.clickPct) || 0,
      reply_pct: Number(row.replyPct) || 0,
      created_at: asIso(row.createDate) || date || now,
      updated_at: asIso(row.writeDate) || date || now,
    };
    const { error } = await sb.from("newsletter_mailings").upsert(payload, {
      onConflict: "id",
    });
    if (error) {
      failed += 1;
      console.error(`#${row.odooId}`, error.message);
    } else upserted += 1;
  }
  console.log(`DB upserted=${upserted} failed=${failed}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
