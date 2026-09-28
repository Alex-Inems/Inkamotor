/**
 * Live Odoo → CRM ingest (sales, contacts, messages).
 * Browser (logged into Odoo) POSTs batches here; we upsert into Supabase.
 *
 *   npx tsx scripts/odoo-live-sync.mts
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] == null) process.env[k] = v;
    }
  }
}
loadEnv();

const PORT = Number(process.env.ODOO_LIVE_SYNC_PORT || 8777);
const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const stats = {
  sales: 0,
  contacts: 0,
  messages: 0,
  errors: [] as string[],
};

type M2O = [number, string] | false;

function dayFrom(value: string) {
  const m = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? new Date().toISOString().slice(0, 10);
}

function mapState(state: string) {
  switch (state) {
    case "sale":
      return "confirmed";
    case "done":
      return "fulfilled";
    case "cancel":
      return "cancelled";
    case "sent":
      return "sent";
    default:
      return "pending";
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmail(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const m = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0]?.toLowerCase() ?? null;
}

async function readJson(req: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function upsertSales(orders: Array<Record<string, unknown>>) {
  const rows = orders.map((o) => {
    const number = String(o.name ?? "");
    const partner = o.partner_id as M2O;
    const customer = Array.isArray(partner) ? partner[1] : "Unknown";
    const status = mapState(String(o.state ?? "draft"));
    const createdAt = dayFrom(String(o.date_order || o.create_date || ""));
    const email =
      extractEmail(o.partner_email) ||
      `order+${number.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@import.inkamototours.local`;
    const currencyId = o.currency_id as M2O;
    const currencyName = Array.isArray(currencyId) ? currencyId[1] : "";
    const currency = currencyName.toUpperCase().includes("USD") ? "USD" : "EUR";
    const lines = Array.isArray(o.lines)
      ? (o.lines as Array<Record<string, unknown>>).map((l) => {
          const dt = l.display_type;
          return {
            description: String(l.name ?? ""),
            displayType:
              dt === "line_section"
                ? "section"
                : dt === "line_note"
                  ? "note"
                  : "product",
            qty: Number(l.product_uom_qty ?? 0),
            unitPrice: Number(l.price_unit ?? 0),
          };
        })
      : [];
    const product =
      lines.find((l) => l.displayType === "product" && l.description)
        ?.description || "Circuit moto Inkamoto";
    const user = o.user_id as M2O;
    return {
      id: `sale_odoo_${number.toLowerCase()}`,
      number,
      customer,
      email,
      product,
      amount: Number(o.amount_total ?? 0),
      currency,
      status,
      source: "website",
      inquiry_id: null,
      lead_id: null,
      created_at: createdAt,
      closed_at:
        status === "cancelled" || status === "fulfilled" ? createdAt : null,
      notes: `Imported from Odoo sale.order ${o.id} (${o.state}).`,
      lines,
      quote_template_name: product,
      payment_terms: "",
      validity_date: o.validity_date
        ? dayFrom(String(o.validity_date))
        : null,
      terms_html: typeof o.note === "string" ? o.note : "",
      salesperson: Array.isArray(user) ? user[1] : "",
      invoice_id: null,
    };
  });

  for (let i = 0; i < rows.length; i += 40) {
    const batch = rows.slice(i, i + 40);
    const { error } = await sb.from("sales").upsert(batch, {
      onConflict: "number",
    });
    if (error) throw new Error(error.message);
    stats.sales += batch.length;
  }
}

async function upsertContacts(
  partners: Array<{
    id: number;
    name?: string;
    email?: string | false;
    phone?: string | false;
    mobile?: string | false;
    is_company?: boolean;
    parent_id?: M2O;
    write_date?: string;
    create_date?: string;
    comment?: string | false;
  }>,
) {
  const emailCount = new Map<string, number>();
  const rows = partners
    .map((p, index) => {
      const email = extractEmail(p.email) || "";
      const name =
        (p.name || "").trim() ||
        email.split("@")[0] ||
        `Contact ${p.id}`;
      let id: string;
      if (email) {
        const n = emailCount.get(email) ?? 0;
        emailCount.set(email, n + 1);
        id = n === 0 ? `ld_${email}` : `ld_${email}_${n + 1}`;
      } else {
        id = `ld_odoo_${p.id}`;
      }
      const updated = dayFrom(
        String(p.write_date || p.create_date || new Date().toISOString()),
      );
      const parent = p.parent_id;
      const company = Array.isArray(parent)
        ? parent[1]
        : p.is_company
          ? name
          : "";
      const phone =
        (typeof p.phone === "string" && p.phone) ||
        (typeof p.mobile === "string" && p.mobile) ||
        "";
      return {
        id,
        name,
        email: email || `odoo-partner-${p.id}@import.inkamototours.local`,
        phone,
        company,
        source: "manual" as const,
        status: "new",
        value: 0,
        currency: "EUR",
        owner: "Team",
        created_at: updated,
        last_contact: updated,
        notes: `Imported from Odoo res.partner ${p.id}.${
          typeof p.comment === "string" && p.comment.trim()
            ? `\n${stripHtml(p.comment).slice(0, 2000)}`
            : ""
        }`,
      };
    })
    .filter((r) => r.email.includes("@"));

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await sb.from("leads").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(error.message);
    stats.contacts += batch.length;
  }
}

async function upsertMessages(
  messages: Array<{
    id: number;
    date?: string;
    subject?: string | false;
    body?: string | false;
    email_from?: string | false;
    message_type?: string;
    partner_email?: string | null;
    outbound?: boolean;
  }>,
) {
  const companyFrom =
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.IMAP_USER?.trim() ||
    "contact@inkamototours.com";
  const companyName = process.env.BREVO_SENDER_NAME?.trim() || "Inkamoto Tours";

  const rows = [];
  for (const msg of messages) {
    const clientEmail = extractEmail(msg.partner_email);
    if (!clientEmail) continue;
    const bodyHtml = typeof msg.body === "string" ? msg.body : "";
    const bodyText = stripHtml(bodyHtml).slice(0, 20000);
    const subjectRaw =
      (typeof msg.subject === "string" && msg.subject.trim()) || "";
    const outbound = !!msg.outbound;
    const subject =
      subjectRaw ||
      (msg.message_type === "comment"
        ? "Note"
        : msg.message_type === "notification"
          ? "Update"
          : "(no subject)");
    const preview = (bodyText || subject).replace(/\s+/g, " ").trim().slice(0, 240);
    const fromEmail = extractEmail(msg.email_from);
    const receivedAt = (() => {
      const raw = String(msg.date || "").trim();
      if (!raw) return new Date().toISOString();
      const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
      const d = new Date(normalized);
      return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    })();
    rows.push({
      message_id: `odoo-msg-${msg.id}`,
      folder: outbound ? "SENT" : "INBOX",
      from_name: outbound ? companyName : fromEmail || null,
      from_email: outbound ? companyFrom : fromEmail || clientEmail,
      to_email: outbound ? clientEmail : companyFrom,
      subject:
        msg.message_type === "comment" && !subjectRaw
          ? `[Odoo] ${subject}`
          : subject,
      preview: preview || subject,
      body_text: bodyText || subject,
      received_at: receivedAt,
      is_read: true,
      synced_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await sb.from("mail_messages").upsert(batch, {
      onConflict: "message_id",
    });
    if (error) throw new Error(error.message);
    stats.messages += batch.length;
  }
}

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
  if (req.method !== "POST") {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const body = await readJson(req);
    if (req.url === "/sales") {
      await upsertSales(body.orders ?? []);
      console.log("[sales]", stats.sales);
    } else if (req.url === "/contacts") {
      await upsertContacts(body.partners ?? []);
      console.log("[contacts]", stats.contacts);
    } else if (req.url === "/messages") {
      await upsertMessages(body.messages ?? []);
      console.log("[messages]", stats.messages);
    } else if (req.url === "/done") {
      console.log("[done]", JSON.stringify(stats));
    } else {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, stats }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stats.errors.push(message);
    console.error(message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Odoo live sync ingest on http://127.0.0.1:${PORT}`);
});
