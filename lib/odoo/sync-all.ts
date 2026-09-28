import { connectOdooSession, type OdooSessionClient } from "@/lib/odoo/session";
import { getSupabase } from "@/lib/supabase/server";

export type OdooSyncStats = {
  sales: number;
  contacts: number;
  messages: number;
  errors: string[];
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

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const OWN_HINTS = [
  "inkamototours.com",
  "inkamoto-tours.odoo.com",
  "contact@inkamotours",
  "notifications@",
  "catchall@",
];

function isOwn(email: string | null) {
  if (!email) return false;
  const e = email.toLowerCase();
  return OWN_HINTS.some((h) => e.includes(h));
}

async function syncSales(client: OdooSessionClient, stats: OdooSyncStats) {
  const sb = getSupabase();
  const saleIds = await client.executeKw<number[]>(
    "sale.order",
    "search",
    [[]],
    { order: "date_order desc" },
  );
  const fields = [
    "id",
    "name",
    "partner_id",
    "date_order",
    "create_date",
    "state",
    "amount_total",
    "currency_id",
    "user_id",
    "validity_date",
    "invoice_status",
    "note",
    "order_line",
  ];

  for (const slice of chunk(saleIds, 40)) {
    const orders = await client.executeKw<Record<string, unknown>[]>(
      "sale.order",
      "read",
      [slice],
      { fields },
    );
    const lineIds = orders.flatMap((o) =>
      Array.isArray(o.order_line) ? (o.order_line as number[]) : [],
    );
    const partnerIds = [
      ...new Set(
        orders
          .map((o) => {
            const p = o.partner_id as M2O;
            return Array.isArray(p) ? p[0] : null;
          })
          .filter((id): id is number => typeof id === "number"),
      ),
    ];
    const [lines, partners] = await Promise.all([
      lineIds.length
        ? client.executeKw<Record<string, unknown>[]>(
            "sale.order.line",
            "read",
            [lineIds],
            {
              fields: [
                "order_id",
                "name",
                "display_type",
                "product_uom_qty",
                "price_unit",
                "sequence",
              ],
            },
          )
        : Promise.resolve([]),
      partnerIds.length
        ? client.executeKw<{ id: number; email: string | false; name: string }[]>(
            "res.partner",
            "read",
            [partnerIds],
            { fields: ["id", "email", "name"] },
          )
        : Promise.resolve([]),
    ]);

    const linesByOrder = new Map<number, Record<string, unknown>[]>();
    for (const l of lines) {
      const oidRaw = l.order_id as M2O | number;
      const oid = Array.isArray(oidRaw) ? oidRaw[0] : Number(oidRaw);
      if (!linesByOrder.has(oid)) linesByOrder.set(oid, []);
      linesByOrder.get(oid)!.push(l);
    }
    const emailByPartner = new Map(
      partners.map((p) => [p.id, extractEmail(p.email)]),
    );

    const rows = orders.map((o) => {
      const number = String(o.name ?? "");
      const partner = o.partner_id as M2O;
      const customer = Array.isArray(partner) ? partner[1] : "Unknown";
      const partnerId = Array.isArray(partner) ? partner[0] : null;
      const status = mapState(String(o.state ?? "draft"));
      const createdAt = dayFrom(String(o.date_order || o.create_date || ""));
      const email =
        (partnerId != null ? emailByPartner.get(partnerId) : null) ||
        `order+${number.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@import.inkamototours.local`;
      const currencyId = o.currency_id as M2O;
      const currencyName = Array.isArray(currencyId) ? currencyId[1] : "";
      const currency = currencyName.toUpperCase().includes("USD") ? "USD" : "EUR";
      const mappedLines = (linesByOrder.get(Number(o.id)) || [])
        .sort(
          (a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0),
        )
        .map((l) => {
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
        });
      const product =
        mappedLines.find((l) => l.displayType === "product" && l.description)
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
        lines: mappedLines,
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

    const { error } = await sb.from("sales").upsert(rows, {
      onConflict: "number",
    });
    if (error) {
      stats.errors.push(error.message);
      throw new Error(error.message);
    }
    stats.sales += rows.length;
  }
}

async function syncContacts(client: OdooSessionClient, stats: OdooSyncStats) {
  const sb = getSupabase();
  const partnerIds = await client.executeKw<number[]>(
    "res.partner",
    "search",
    [[["email", "!=", false], ["email", "!=", ""]]],
    { order: "write_date desc" },
  );
  const emailCount = new Map<string, number>();

  for (const slice of chunk(partnerIds, 80)) {
    const partners = await client.executeKw<
      {
        id: number;
        name?: string;
        email?: string | false;
        phone?: string | false;
        is_company?: boolean;
        parent_id?: M2O;
        write_date?: string;
        create_date?: string;
        comment?: string | false;
      }[]
    >("res.partner", "read", [slice], {
      fields: [
        "id",
        "name",
        "email",
        "phone",
        "is_company",
        "parent_id",
        "write_date",
        "create_date",
        "comment",
      ],
    });

    const rows = partners.map((p) => {
      const email = extractEmail(p.email) || "";
      const name =
        (p.name || "").trim() || email.split("@")[0] || `Contact ${p.id}`;
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
      return {
        id,
        name,
        email: email || `odoo-partner-${p.id}@import.inkamototours.local`,
        phone: typeof p.phone === "string" ? p.phone : "",
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
    });

    const { error } = await sb.from("leads").upsert(rows, { onConflict: "id" });
    if (error) {
      stats.errors.push(error.message);
      throw new Error(error.message);
    }
    stats.contacts += rows.length;
  }
}

async function syncMessages(
  client: OdooSessionClient,
  stats: OdooSyncStats,
  days = 3,
) {
  const sb = getSupabase();
  const companyFrom =
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.IMAP_USER?.trim() ||
    "contact@inkamototours.com";
  const companyName = process.env.BREVO_SENDER_NAME?.trim() || "Inkamoto Tours";

  const since = new Date(Date.now() - days * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const msgIds = await client.executeKw<number[]>(
    "mail.message",
    "search",
    [
      [
        "&",
        ["date", ">=", since],
        ["message_type", "in", ["email", "comment"]],
      ],
    ],
    { order: "date desc", limit: 1500 },
  );

  const fields = [
    "id",
    "date",
    "subject",
    "body",
    "email_from",
    "message_type",
    "partner_ids",
    "model",
    "res_id",
  ];

  for (const slice of chunk(msgIds, 60)) {
    const rows = await client.executeKw<Record<string, unknown>[]>(
      "mail.message",
      "read",
      [slice],
      { fields },
    );
    const partnerIds = [
      ...new Set(
        rows
          .flatMap((r) => (Array.isArray(r.partner_ids) ? r.partner_ids : []))
          .concat(
            rows
              .filter((r) => r.model === "res.partner" && r.res_id)
              .map((r) => Number(r.res_id)),
          )
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    ];
    const partners = partnerIds.length
      ? await client.executeKw<{ id: number; email: string | false }[]>(
          "res.partner",
          "read",
          [partnerIds],
          { fields: ["id", "email"] },
        )
      : [];
    const byId = new Map(partners.map((p) => [p.id, p]));

    const upserts = [];
    for (const msg of rows) {
      let clientEmail: string | null = null;
      for (const pid of (msg.partner_ids as number[]) || []) {
        const em = extractEmail(byId.get(pid)?.email);
        if (em && !isOwn(em)) {
          clientEmail = em;
          break;
        }
      }
      if (!clientEmail && msg.model === "res.partner" && msg.res_id) {
        const em = extractEmail(byId.get(Number(msg.res_id))?.email);
        if (em && !isOwn(em)) clientEmail = em;
      }
      const fromEmail = extractEmail(msg.email_from);
      const outbound = isOwn(fromEmail) || !fromEmail;
      if (!clientEmail && !outbound) clientEmail = fromEmail;
      if (!clientEmail) continue;

      const bodyHtml = typeof msg.body === "string" ? msg.body : "";
      const bodyText = stripHtml(bodyHtml).slice(0, 20000);
      const subjectRaw =
        (typeof msg.subject === "string" && msg.subject.trim()) || "";
      const subject =
        subjectRaw ||
        (msg.message_type === "comment" ? "Note" : "(no subject)");
      const preview = (bodyText || subject)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240);
      const rawDate = String(msg.date || "").trim();
      const normalized = rawDate.includes("T")
        ? rawDate
        : `${rawDate.replace(" ", "T")}Z`;
      const receivedAt = Number.isNaN(Date.parse(normalized))
        ? new Date().toISOString()
        : new Date(normalized).toISOString();

      upserts.push({
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

    if (!upserts.length) continue;
    const { error } = await sb.from("mail_messages").upsert(upserts, {
      onConflict: "message_id",
    });
    if (error) {
      stats.errors.push(error.message);
      throw new Error(error.message);
    }
    stats.messages += upserts.length;
  }
}

/** Pull Odoo sales, contacts, and recent messages into Supabase. */
export async function syncOdooAll(opts?: {
  days?: number;
}): Promise<OdooSyncStats> {
  const stats: OdooSyncStats = {
    sales: 0,
    contacts: 0,
    messages: 0,
    errors: [],
  };
  const client = await connectOdooSession();
  await syncSales(client, stats);
  await syncContacts(client, stats);
  await syncMessages(client, stats, opts?.days ?? 3);
  return stats;
}
