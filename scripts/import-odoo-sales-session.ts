/**
 * Live-import Odoo sale.order records via the logged-in browser session.
 *
 * 1. npx tsx scripts/import-odoo-sales-session.ts
 * 2. On https://inkamoto-tours.odoo.com (logged in), run the bookmarklet printed
 *    by this script — or the agent posts batches via browser CDP.
 *
 * Requires .env.local (Supabase service role).
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { SaleLine, SaleStatus } from "../lib/demo-data";

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

const PORT = Number(process.env.ODOO_SALES_INGEST_PORT || 8766);
const OUT = resolve(process.cwd(), "data", "odoo-sales-live.json");

type M2O = [number, string] | false;
type OdooOrder = {
  id: number;
  name: string;
  partner_id: M2O;
  date_order: string;
  create_date: string;
  state: string;
  amount_total: number;
  currency_id: M2O;
  user_id: M2O;
  validity_date: string | false;
  invoice_status: string;
  note?: string | false;
  partner_email?: string | null;
  lines?: Array<{
    name: string;
    display_type: string | false;
    product_uom_qty: number;
    price_unit: number;
  }>;
};

const stats = {
  batches: 0,
  received: 0,
  upserted: 0,
  errors: [] as string[],
};

function mapState(state: string): SaleStatus {
  switch (state) {
    case "sale":
      return "confirmed";
    case "done":
      return "fulfilled";
    case "cancel":
      return "cancelled";
    case "sent":
      return "sent";
    case "draft":
    default:
      return "pending";
  }
}

function dayFrom(value: string) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? new Date().toISOString().slice(0, 10);
}

function currencyOf(c: M2O): "EUR" | "USD" {
  const name = Array.isArray(c) ? c[1] : "";
  return name.toUpperCase().includes("USD") ? "USD" : "EUR";
}

function placeholderEmail(ref: string) {
  const slug = ref.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `order+${slug}@import.inkamototours.local`;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapLines(
  lines: OdooOrder["lines"] | undefined,
): SaleLine[] {
  if (!lines?.length) return [];
  return lines.map((l) => {
    const dt = l.display_type;
    const displayType =
      dt === "line_section"
        ? "section"
        : dt === "line_note"
          ? "note"
          : "product";
    return {
      description: l.name || "",
      displayType,
      qty: Number(l.product_uom_qty ?? 0),
      unitPrice: Number(l.price_unit ?? 0),
    };
  });
}

function productLabel(lines: SaleLine[]) {
  const first = lines.find((l) => l.displayType === "product" && l.description);
  return first?.description || "Circuit moto Inkamoto";
}

async function loadLeadLookup(sb: ReturnType<typeof createClient>) {
  const { data, error } = await sb.from("leads").select("id, name, email");
  if (error) throw new Error(error.message);
  const exact = new Map<string, { id: string; email: string }>();
  for (const lead of data ?? []) {
    const name = String(lead.name ?? "").trim();
    const email = String(lead.email ?? "").trim().toLowerCase();
    if (!name || !email.includes("@")) continue;
    exact.set(normalizeName(name), { id: String(lead.id), email });
  }
  function match(customer: string) {
    const key = normalizeName(customer);
    if (!key) return null;
    const hit = exact.get(key);
    if (hit) return hit;
    for (const [leadName, lead] of exact) {
      if (key.includes(leadName) || leadName.includes(key)) return lead;
    }
    return null;
  }
  return { match };
}

function getSb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function upsertOrders(orders: OdooOrder[]) {
  const sb = getSb();
  const leads = await loadLeadLookup(sb);
  mkdirSync(resolve(process.cwd(), "data"), { recursive: true });

  const existing = await (async () => {
    try {
      return JSON.parse(readFileSync(OUT, "utf8")) as OdooOrder[];
    } catch {
      return [] as OdooOrder[];
    }
  })();
  const byId = new Map(existing.map((o) => [o.id, o]));
  for (const o of orders) byId.set(o.id, o);
  const merged = [...byId.values()].sort((a, b) => b.id - a.id);
  writeFileSync(OUT, JSON.stringify(merged, null, 2));

  let matched = 0;
  const rows = orders.map((o) => {
    const number = o.name;
    const customer = Array.isArray(o.partner_id) ? o.partner_id[1] : "Unknown";
    const status = mapState(o.state);
    const createdAt = dayFrom(o.date_order || o.create_date);
    const closedAt =
      status === "cancelled" || status === "fulfilled" ? createdAt : null;
    const lines = mapLines(o.lines);
    const lead = leads.match(customer);
    if (lead) matched += 1;
    const email =
      (o.partner_email && o.partner_email.includes("@")
        ? o.partner_email.toLowerCase()
        : null) ||
      lead?.email ||
      placeholderEmail(number);
    const salesperson = Array.isArray(o.user_id) ? o.user_id[1] : "";
    return {
      id: `sale_odoo_${number.toLowerCase()}`,
      number,
      customer,
      email,
      product: productLabel(lines),
      amount: Number(o.amount_total ?? 0),
      currency: currencyOf(o.currency_id),
      status,
      source: lead ? "lead" : "website",
      inquiry_id: null,
      lead_id: lead?.id ?? null,
      created_at: createdAt,
      closed_at: closedAt,
      notes: `Imported from Odoo sale.order ${o.id} (${o.state}).`,
      lines,
      quote_template_name: productLabel(lines),
      payment_terms: "",
      validity_date: o.validity_date ? dayFrom(String(o.validity_date)) : null,
      terms_html: typeof o.note === "string" ? o.note : "",
      salesperson,
      invoice_id: null,
    };
  });

  const chunk = 50;
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk);
    const { error } = await sb.from("sales").upsert(batch, { onConflict: "number" });
    if (error) {
      stats.errors.push(error.message);
      throw new Error(error.message);
    }
    stats.upserted += batch.length;
  }

  return { upserted: rows.length, matched, totalCached: merged.length };
}

const BOOKMARKLET = `
(async () => {
  const ENDPOINT = 'http://127.0.0.1:${PORT}/ingest';
  async function rpc(model, method, args, kwargs) {
    const res = await fetch('/web/dataset/call_kw/' + model + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call',
        params: { model, method, args: args || [], kwargs: kwargs || {} },
        id: Date.now()
      })
    });
    const json = await res.json();
    if (json.error) throw new Error(JSON.stringify(json.error));
    return json.result;
  }
  const fields = ['id','name','partner_id','date_order','create_date','state','amount_total','currency_id','user_id','validity_date','invoice_status','note','order_line'];
  const ids = await rpc('sale.order', 'search', [[]], { order: 'date_order desc' });
  console.log('sale.order count', ids.length);
  const batchSize = 40;
  for (let i = 0; i < ids.length; i += batchSize) {
    const slice = ids.slice(i, i + batchSize);
    const orders = await rpc('sale.order', 'read', [slice], { fields });
    const lineIds = orders.flatMap(o => o.order_line || []);
    const partnerIds = [...new Set(orders.map(o => Array.isArray(o.partner_id) ? o.partner_id[0] : null).filter(Boolean))];
    const [lines, partners] = await Promise.all([
      lineIds.length ? rpc('sale.order.line', 'read', [lineIds], { fields: ['order_id','name','display_type','product_uom_qty','price_unit','sequence'] }) : [],
      partnerIds.length ? rpc('res.partner', 'read', [partnerIds], { fields: ['email','name'] }) : [],
    ]);
    const linesByOrder = new Map();
    for (const l of lines) {
      const oid = Array.isArray(l.order_id) ? l.order_id[0] : l.order_id;
      if (!linesByOrder.has(oid)) linesByOrder.set(oid, []);
      linesByOrder.get(oid).push(l);
    }
    const emailByPartner = new Map(partners.map(p => [p.id, p.email || null]));
    const payload = orders.map(o => ({
      ...o,
      partner_email: Array.isArray(o.partner_id) ? emailByPartner.get(o.partner_id[0]) : null,
      lines: (linesByOrder.get(o.id) || []).sort((a,b) => (a.sequence||0)-(b.sequence||0)).map(l => ({
        name: l.name, display_type: l.display_type, product_uom_qty: l.product_uom_qty, price_unit: l.price_unit
      })),
    }));
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: payload }),
    });
    const text = await res.text();
    console.log('batch', i, '/', ids.length, text);
  }
  console.log('done');
  alert('Odoo sales import done: ' + ids.length);
})();
`.trim();

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/stats") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
    return;
  }
  if (req.method === "GET" && req.url === "/bookmarklet") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(BOOKMARKLET);
    return;
  }
  if (req.method !== "POST" || req.url !== "/ingest") {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    const body = JSON.parse(raw) as { orders?: OdooOrder[] };
    const orders = body.orders ?? [];
    stats.batches += 1;
    stats.received += orders.length;
    const result = await upsertOrders(orders);
    console.log(
      `[sales-ingest] batch=${stats.batches} received=${orders.length} upserted=${result.upserted} matched=${result.matched} cached=${result.totalCached}`,
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...result, stats }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(msg);
    console.error("[sales-ingest]", msg);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: msg }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Odoo sales ingest on http://127.0.0.1:${PORT}/ingest`);
  console.log(`GET /bookmarklet for export script`);
});
