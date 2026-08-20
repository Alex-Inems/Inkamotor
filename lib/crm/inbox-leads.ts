import type { Lead, LeadSource, LeadStatus } from "@/lib/demo-data";
import { listMailMessages } from "@/lib/mail/imap";
import { listMailReplies } from "@/lib/mail/replies";
import {
  displayContactName,
  groupMailRooms,
  phoneFromFields,
} from "@/lib/mail/rooms";
import { getSupabase } from "@/lib/supabase/server";

const LOCKED_STATUS = new Set<LeadStatus>(["qualified", "won", "lost"]);

const DEMO_LEAD_IDS = Array.from(
  { length: 15 },
  (_, i) => `ld_${1001 + i}`,
);
const DEMO_INQUIRY_IDS = Array.from(
  { length: 12 },
  (_, i) => `inq_${String(i + 1).padStart(2, "0")}`,
);
const DEMO_FOLLOW_IDS = Array.from(
  { length: 12 },
  (_, i) => `fu_${String(i + 1).padStart(2, "0")}`,
);

export function leadIdForEmail(email: string) {
  return `ld_${email.trim().toLowerCase()}`;
}

export function isDemoLeadId(id: string) {
  return /^ld_10\d{2}$/.test(id);
}

function ownAddresses() {
  return [
    process.env.IMAP_USER,
    process.env.BREVO_SENDER_EMAIL,
  ];
}

function day(iso: string) {
  return (iso || new Date().toISOString()).slice(0, 10);
}

async function stripDemoRows() {
  const sb = getSupabase();
  await Promise.all([
    sb.from("leads").delete().in("id", DEMO_LEAD_IDS),
    sb.from("site_inquiries").delete().in("id", DEMO_INQUIRY_IDS),
    sb.from("follow_ups").delete().in("id", DEMO_FOLLOW_IDS),
  ]);
}

/**
 * Every Inbox conversation except Promos is a lead. Upsert by email so the
 * same person never becomes two rows. Won/lost/qualified stay as the team set them.
 */
export async function syncLeadsFromInbox(): Promise<number> {
  await stripDemoRows();

  const [mail, replies] = await Promise.all([
    listMailMessages(400),
    listMailReplies(200),
  ]);
  const rooms = groupMailRooms({
    mail,
    replies,
    ownAddresses: ownAddresses(),
  }).filter((room) => !room.bulk);

  if (rooms.length === 0) return 0;

  const sb = getSupabase();
  const ids = rooms.map((r) => leadIdForEmail(r.email));
  const { data: existingRows } = await sb
    .from("leads")
    .select("id, email, status, value, owner, company, phone, name")
    .in("id", ids);

  const existing = new Map(
    (existingRows ?? []).map((row) => [
      String(row.id),
      row as Record<string, unknown>,
    ]),
  );

  const rows = rooms.map((room) => {
    const id = leadIdForEmail(room.email);
    const prev = existing.get(id);
    const first = room.messages[0]?.at;
    const last = room.lastAt;
    const replied = room.messages.some((m) => m.mine);
    const form = room.fields.length > 0;
    const prevStatus = prev?.status as LeadStatus | undefined;
    const status: LeadStatus =
      prevStatus && LOCKED_STATUS.has(prevStatus)
        ? prevStatus
        : replied
          ? "contacted"
          : "new";
    const source: LeadSource = form ? "website" : "organic";
    const phone = phoneFromFields(room.fields) || String(prev?.phone ?? "");
    const name =
      displayContactName(room.name, room.email) ||
      String(prev?.name ?? room.email);

    return {
      id,
      name,
      email: room.email,
      phone,
      company: String(prev?.company ?? ""),
      source,
      status,
      value: Number(prev?.value ?? 0),
      currency: "USD",
      owner: String(prev?.owner ?? "Team"),
      created_at: day(first || last),
      last_contact: day(last),
      notes: [room.lastSubject, room.lastText].filter(Boolean).join(" — "),
    };
  });

  const { error } = await sb.from("leads").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return rows.length;
}

export function withoutDemoLeads(leads: Lead[]) {
  return leads.filter((l) => !isDemoLeadId(l.id));
}
