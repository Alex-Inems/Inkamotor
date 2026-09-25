/**
 * Temporary ingest server: browser (logged into Odoo) POSTs mail.message
 * batches here; we upsert into mail_messages.
 *
 * Usage:
 *   npx tsx scripts/odoo-session-ingest.ts
 * Then run the bookmarklet / browser export against http://127.0.0.1:8765
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

const PORT = Number(process.env.ODOO_INGEST_PORT || 8765);
const OWN_HINTS = [
  "inkamototours.com",
  "inkamoto-tours.odoo.com",
  "inkamoto",
  "contact@inkamototours",
  "notifications@",
  "catchall@",
];

type Partner = { id: number; name: string; email: string | false | null };
type Msg = {
  id: number;
  date: string;
  subject: string | false;
  body: string | false;
  email_from: string | false;
  message_type: string;
  partner_ids: number[];
  model: string | false;
  res_id: number | false;
  /** Pre-resolved client address from lead/sale/partner lookup in the browser export. */
  client_email?: string | null;
};

const stats = {
  batches: 0,
  upserted: 0,
  skipped: 0,
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

async function ingest(partners: Partner[], messages: Msg[]) {
  const byId = new Map<number, { id: number; name: string; email: string }>();
  for (const p of partners) {
    const email = extractEmail(p.email);
    if (!email) continue;
    byId.set(p.id, { id: p.id, name: p.name || email, email });
  }

  let upserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const msg of messages) {
    try {
      let clientEmail: string | null =
        extractEmail(msg.client_email ?? null) &&
        !isOwnEmail(extractEmail(msg.client_email ?? null), ownEmails)
          ? extractEmail(msg.client_email ?? null)
          : null;
      if (!clientEmail) {
        for (const pid of msg.partner_ids || []) {
          const partner = byId.get(pid);
          if (partner && !isOwnEmail(partner.email, ownEmails)) {
            clientEmail = partner.email;
            break;
          }
        }
      }
      if (
        !clientEmail &&
        msg.model === "res.partner" &&
        typeof msg.res_id === "number"
      ) {
        const partner = byId.get(msg.res_id);
        if (partner && !isOwnEmail(partner.email, ownEmails)) {
          clientEmail = partner.email;
        }
      }
      if (!clientEmail) {
        const from = extractEmail(msg.email_from);
        if (from && !isOwnEmail(from, ownEmails)) clientEmail = from;
      }
      if (!clientEmail) {
        skipped += 1;
        continue;
      }

      const bodyHtml = typeof msg.body === "string" ? msg.body : "";
      const bodyText = stripHtml(bodyHtml).slice(0, 20000);
      if (!bodyText && !(typeof msg.subject === "string" && msg.subject.trim())) {
        skipped += 1;
        continue;
      }

      const fromEmail = extractEmail(msg.email_from);
      const outbound = isOwnEmail(fromEmail, ownEmails) || !fromEmail;
      const subject =
        (typeof msg.subject === "string" && msg.subject.trim()) ||
        (msg.message_type === "comment" ? "Note" : "(no subject)");
      const preview = bodyText.replace(/\s+/g, " ").trim().slice(0, 240);
      const partner = [...byId.values()].find((p) => p.email === clientEmail);

      const { error } = await sb.from("mail_messages").upsert(
        {
          message_id: `odoo-msg-${msg.id}`,
          folder: outbound ? "SENT" : "INBOX",
          from_name: outbound
            ? companyName
            : partner?.name || fromEmail || null,
          from_email: outbound ? companyFrom : fromEmail || clientEmail,
          to_email: outbound ? clientEmail : companyFrom,
          subject:
            msg.message_type === "comment" && !String(msg.subject || "").trim()
              ? `[Odoo] ${subject}`
              : subject,
          preview: preview || subject,
          body_text: bodyText || subject,
          received_at: asIso(msg.date),
          is_read: true,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "message_id" },
      );
      if (error) {
        errors.push(`#${msg.id}: ${error.message}`);
        continue;
      }
      upserted += 1;
    } catch (err) {
      errors.push(`#${msg.id}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  stats.batches += 1;
  stats.upserted += upserted;
  stats.skipped += skipped;
  stats.errors.push(...errors);
  return { upserted, skipped, errors: errors.length, totals: { ...stats } };
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
    return;
  }

  if (req.method === "POST" && req.url === "/ingest") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        partners?: Partner[];
        messages?: Msg[];
        done?: boolean;
      };
      const result = await ingest(body.partners || [], body.messages || []);
      if (body.done) {
        console.log("DONE", JSON.stringify(stats, null, 2));
      } else {
        console.log(
          `batch #${stats.batches}: +${result.upserted} upserted, ${result.skipped} skipped (total upserted ${stats.upserted})`,
        );
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(msg);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: msg }));
    }
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Odoo session ingest listening on http://127.0.0.1:${PORT}`);
  console.log("POST /ingest  GET /status");
});
