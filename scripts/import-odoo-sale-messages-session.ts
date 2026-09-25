/**
 * Import Odoo sale.order chatter messages + PDF/docs into CRM mail_messages
 * (attachments stored on mail_reply_attachments keyed by mail_messages.id).
 *
 *   npx tsx scripts/import-odoo-sale-messages-session.ts
 * Then run the browser export (agent CDP or bookmarklet on Odoo).
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { encodeByteaHex } from "../lib/mail/bytea";

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

const PORT = Number(process.env.ODOO_SALE_MSG_INGEST_PORT || 8767);
const MAX_ATTACH_BYTES = 15 * 1024 * 1024;
const OUT = resolve(process.cwd(), "data", "odoo-sale-messages-stats.json");

type M2O = [number, string] | false;

type InMsg = {
  id: number;
  date: string;
  subject: string | false;
  body: string | false;
  email_from: string | false;
  message_type: string;
  partner_ids: number[];
  model: string | false;
  res_id: number | false;
  attachment_ids?: number[];
  client_email?: string | null;
  client_name?: string | null;
  order_name?: string | null;
  attachments?: Array<{
    id: number;
    name: string;
    mimetype: string;
    file_size: number;
    datas: string | false;
  }>;
};

const OWN_HINTS = [
  "inkamototours.com",
  "inkamoto-tours.odoo.com",
  "inkamoto",
  "contact@inkamototours",
  "notifications@",
  "catchall@",
];

const stats = {
  batches: 0,
  messages: 0,
  upserted: 0,
  skipped: 0,
  attachmentsSaved: 0,
  attachmentsSkipped: 0,
  errors: [] as string[],
};

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad\u034f\u180e]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmail(raw: string | false | null | undefined): string | null {
  if (!raw || raw === false) return null;
  const match = String(raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? null;
}

function isOwnEmail(email: string | null, ownEmails: string[]) {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (ownEmails.some((x) => x === lower)) return true;
  return OWN_HINTS.some((hint) => lower.includes(hint));
}

function asIso(value: string | false | null | undefined) {
  if (!value || value === false) return new Date().toISOString();
  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const ownEmails = [
  process.env.IMAP_USER?.trim().toLowerCase(),
  process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase(),
  "contact@inkamototours.com",
].filter(Boolean) as string[];

const companyFrom =
  process.env.BREVO_SENDER_EMAIL?.trim() ||
  process.env.IMAP_USER?.trim() ||
  "contact@inkamototours.com";
const companyName = process.env.BREVO_SENDER_NAME?.trim() || "Inkamoto Tours";

const emailByOrderNumber = new Map<string, { email: string; name: string }>();

async function loadCrmSaleEmails() {
  emailByOrderNumber.clear();
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("sales")
      .select("number,email,customer")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const number = String(row.number ?? "").trim().toUpperCase();
      const email = String(row.email ?? "").trim().toLowerCase();
      if (!number || !email.includes("@")) continue;
      if (email.endsWith("@import.inkamototours.local")) continue;
      emailByOrderNumber.set(number, {
        email,
        name: String(row.customer ?? ""),
      });
    }
    if (rows.length < 1000) break;
    from += 1000;
  }
}

void loadCrmSaleEmails().catch((e) =>
  console.error("[sale-msg] CRM email map failed", e),
);

async function saveAttachment(
  messageUuid: string,
  fileName: string,
  mimeType: string,
  base64: string,
) {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_ATTACH_BYTES) {
    stats.attachmentsSkipped += 1;
    return;
  }

  const { data: existing } = await sb
    .from("mail_reply_attachments")
    .select("id")
    .eq("reply_id", messageUuid)
    .eq("file_name", fileName)
    .eq("byte_size", bytes.length)
    .maybeSingle();
  if (existing) {
    stats.attachmentsSkipped += 1;
    return;
  }

  const { error } = await sb.from("mail_reply_attachments").insert({
    reply_id: messageUuid,
    file_name: fileName,
    mime_type: mimeType || "application/pdf",
    file_data: encodeByteaHex(bytes),
    byte_size: bytes.length,
  });
  if (error) {
    stats.errors.push(`att ${fileName}: ${error.message}`);
    stats.attachmentsSkipped += 1;
    return;
  }
  stats.attachmentsSaved += 1;
}

async function ingest(messages: InMsg[]) {
  for (const msg of messages) {
    stats.messages += 1;
    try {
      let clientEmail =
        extractEmail(msg.client_email ?? null) &&
        !isOwnEmail(extractEmail(msg.client_email ?? null), ownEmails)
          ? extractEmail(msg.client_email ?? null)
          : null;

      const orderName = (msg.order_name || "").trim().toUpperCase();
      if (!clientEmail && orderName) {
        const hit = emailByOrderNumber.get(orderName);
        if (hit) {
          clientEmail = hit.email;
          if (!msg.client_name) msg.client_name = hit.name;
        }
      }

      if (!clientEmail) {
        const from = extractEmail(msg.email_from);
        if (from && !isOwnEmail(from, ownEmails)) clientEmail = from;
      }

      if (!clientEmail && orderName) {
        // last resort so documents still land on a conversation keyed by order
        clientEmail = `order+${orderName.toLowerCase()}@import.inkamototours.local`;
      }

      const bodyHtml = typeof msg.body === "string" ? msg.body : "";
      const bodyText = stripHtml(bodyHtml).slice(0, 20000);
      const subjectRaw =
        (typeof msg.subject === "string" && msg.subject.trim()) || "";
      const hasAtt = (msg.attachments?.length ?? 0) > 0;
      if (!bodyText && !subjectRaw && !hasAtt) {
        stats.skipped += 1;
        continue;
      }

      const fromEmail = extractEmail(msg.email_from);
      const outbound = isOwnEmail(fromEmail, ownEmails) || !fromEmail;
      const subject =
        subjectRaw ||
        (msg.message_type === "comment"
          ? "Note"
          : msg.message_type === "notification"
            ? "Update"
            : "(no subject)");
      const preview = (bodyText || subject).replace(/\s+/g, " ").trim().slice(0, 240);
      const clientName = msg.client_name?.trim() || null;

      const row = {
        message_id: `odoo-sale-msg-${msg.id}`,
        folder: outbound ? "SENT" : "INBOX",
        from_name: outbound ? companyName : clientName || fromEmail || null,
        from_email: outbound ? companyFrom : fromEmail || clientEmail,
        to_email: outbound ? clientEmail : companyFrom,
        subject,
        preview,
        body_text: bodyText || subject,
        received_at: asIso(msg.date),
        is_read: true,
        synced_at: new Date().toISOString(),
      };

      const { data, error } = await sb
        .from("mail_messages")
        .upsert(row, { onConflict: "message_id" })
        .select("id")
        .single();

      if (error || !data) {
        stats.errors.push(`msg ${msg.id}: ${error?.message || "no id"}`);
        stats.skipped += 1;
        continue;
      }

      stats.upserted += 1;
      const messageUuid = String((data as { id: string }).id);

      for (const att of msg.attachments || []) {
        if (!att.datas || att.datas === false) {
          stats.attachmentsSkipped += 1;
          continue;
        }
        await saveAttachment(
          messageUuid,
          att.name || `attachment-${att.id}`,
          att.mimetype || "application/octet-stream",
          String(att.datas),
        );
      }
    } catch (err) {
      stats.errors.push(
        `msg ${msg.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      stats.skipped += 1;
    }
  }
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
    if (json.error) throw new Error(JSON.stringify(json.error.data?.message || json.error));
    return json.result;
  }
  const orderIds = await rpc('sale.order', 'search', [[]]);
  const orders = [];
  for (let i = 0; i < orderIds.length; i += 80) {
    const slice = orderIds.slice(i, i + 80);
    const rows = await rpc('sale.order', 'read', [slice], { fields: ['id','name','partner_id','create_date'] });
    orders.push(...rows);
  }
  const partnerIds = [...new Set(orders.map(o => Array.isArray(o.partner_id) ? o.partner_id[0] : null).filter(Boolean))];
  const partners = [];
  for (let i = 0; i < partnerIds.length; i += 80) {
    partners.push(...await rpc('res.partner', 'read', [partnerIds.slice(i, i + 80)], { fields: ['id','name','email'] }));
  }
  const emailByPartner = new Map(partners.map(p => [p.id, { email: (p.email||'').toLowerCase() || null, name: p.name || null }]));
  const clientByOrder = new Map(orders.map(o => {
    const pid = Array.isArray(o.partner_id) ? o.partner_id[0] : null;
    const p = emailByPartner.get(pid) || { email: null, name: null };
    return [o.id, { email: p.email, name: p.name, orderName: o.name }];
  }));
  const msgIds = await rpc('mail.message', 'search', [[
    ['model','=','sale.order'],
    ['message_type','in',['email','comment','notification']],
  ]], { order: 'id asc' });
  console.log('sale messages', msgIds.length);
  const batchSize = 20;
  for (let i = 0; i < msgIds.length; i += batchSize) {
    const slice = msgIds.slice(i, i + batchSize);
    const msgs = await rpc('mail.message', 'read', [slice], {
      fields: ['id','date','subject','body','email_from','message_type','partner_ids','model','res_id','attachment_ids']
    });
    const attIds = [...new Set(msgs.flatMap(m => m.attachment_ids || []))];
    let atts = [];
    if (attIds.length) {
      // read without datas first for size filter, then datas in chunks
      const meta = await rpc('ir.attachment', 'read', [attIds], { fields: ['id','name','mimetype','file_size'] });
      const loadIds = meta.filter(a => (a.file_size||0) > 0 && (a.file_size||0) <= 15*1024*1024).map(a => a.id);
      for (let j = 0; j < loadIds.length; j += 8) {
        const part = await rpc('ir.attachment', 'read', [loadIds.slice(j, j + 8)], {
          fields: ['id','name','mimetype','file_size','datas']
        });
        atts.push(...part);
      }
    }
    const attById = new Map(atts.map(a => [a.id, a]));
    const payload = msgs.map(m => {
      const client = clientByOrder.get(m.res_id) || { email: null, name: null, orderName: null };
      return {
        ...m,
        client_email: client.email,
        client_name: client.name,
        order_name: client.orderName,
        attachments: (m.attachment_ids || []).map(id => attById.get(id)).filter(Boolean).map(a => ({
          id: a.id, name: a.name, mimetype: a.mimetype, file_size: a.file_size, datas: a.datas
        })),
      };
    }).filter(m => {
      const body = typeof m.body === 'string' ? m.body.replace(/<[^>]+>/g,' ').trim() : '';
      const subject = typeof m.subject === 'string' ? m.subject.trim() : '';
      const hasAtt = (m.attachments||[]).length > 0;
      if (m.message_type === 'notification' && !body && !subject && !hasAtt) return false;
      return true;
    });
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payload }),
    });
    console.log('batch', i, '/', msgIds.length, await res.text());
  }
  // Orphan documents on sale.order not already linked via message attachment_ids
  console.log('importing orphan sale attachments…');
  for (let i = 0; i < orders.length; i += 10) {
    const slice = orders.slice(i, i + 10);
    const orphans = [];
    for (const o of slice) {
      const rows = await rpc('ir.attachment', 'search_read', [[['res_model','=','sale.order'],['res_id','=',o.id]]], {
        fields: ['id','name','mimetype','file_size','create_date'],
        limit: 80
      });
      const client = clientByOrder.get(o.id) || { email: null, name: null, orderName: o.name };
      const loadIds = rows.filter(a => (a.file_size||0) > 0 && (a.file_size||0) <= 15*1024*1024).map(a => a.id);
      if (!loadIds.length) continue;
      const withData = [];
      for (let j = 0; j < loadIds.length; j += 6) {
        withData.push(...await rpc('ir.attachment', 'read', [loadIds.slice(j, j + 6)], {
          fields: ['id','name','mimetype','file_size','datas']
        }));
      }
      orphans.push({
        id: 900000000 + o.id,
        date: withData[0]?.create_date || o.create_date || new Date().toISOString(),
        subject: 'Documents · ' + (client.orderName || o.name),
        body: '<p>Documents joints à la commande ' + (client.orderName || o.name) + '</p>',
        email_from: '"Inkamoto Tours" <contact@inkamototours.com>',
        message_type: 'comment',
        partner_ids: [],
        model: 'sale.order',
        res_id: o.id,
        client_email: client.email,
        client_name: client.name,
        order_name: client.orderName || o.name,
        attachments: withData.map(a => ({
          id: a.id, name: a.name, mimetype: a.mimetype, file_size: a.file_size, datas: a.datas
        })),
      });
    }
    if (!orphans.length) continue;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: orphans }),
    });
    console.log('orphans', i, await res.text());
  }
  alert('Sale messages import done: ' + msgIds.length);
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
    const body = JSON.parse(raw) as { messages?: InMsg[] };
    const messages = body.messages ?? [];
    stats.batches += 1;
    await ingest(messages);
    mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
    writeFileSync(OUT, JSON.stringify(stats, null, 2));
    console.log(
      `[sale-msg] batch=${stats.batches} +${messages.length} upserted=${stats.upserted} skipped=${stats.skipped} atts=${stats.attachmentsSaved}`,
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, stats }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(msg);
    console.error("[sale-msg]", msg);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: msg }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Sale message ingest on http://127.0.0.1:${PORT}/ingest`);
});
