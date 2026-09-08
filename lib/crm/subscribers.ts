import type { Subscriber } from "@/lib/brevo";
import { parseLeadDetails, tagList } from "@/lib/crm/contact-details";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

const PAGE = 1000;

type Row = {
  email: string;
  name: string | null;
  source: string | null;
  blocked: boolean;
  added_at: string | null;
};

function isMissingTable(message: string) {
  return /newsletter_subscribers|schema cache|does not exist/i.test(message);
}

function mapRow(row: Row): Subscriber {
  const email = row.email.trim().toLowerCase();
  return {
    id: email,
    email,
    name: row.name?.trim() || null,
    source: row.source,
    blocked: Boolean(row.blocked),
    addedAt: row.added_at,
    tags: [],
  };
}

async function fetchLeadPeople(): Promise<Subscriber[]> {
  const sb = getSupabase();
  const { count, error: countError } = await sb
    .from("leads")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);
  if (!count) return [];

  const pages = Math.ceil(count / PAGE);
  const batches = [];
  for (let i = 0; i < pages; i++) {
    const { data, error } = await sb
      .from("leads")
      .select("id, name, email, source, created_at, notes")
      .range(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    batches.push(data ?? []);
  }

  const unique = new Map<string, Subscriber>();
  for (const row of batches.flat()) {
    const email = String(row.email ?? "")
      .trim()
      .toLowerCase();
    if (!email.includes("@") || unique.has(email)) continue;
    const details = parseLeadDetails({
      id: String(row.id ?? email),
      name: String(row.name ?? ""),
      email,
      phone: "",
      company: "",
      source: "manual",
      status: "new",
      value: 0,
      currency: "USD",
      owner: "Team",
      createdAt: String(row.created_at ?? ""),
      lastContact: String(row.created_at ?? ""),
      notes: String(row.notes ?? ""),
    });
    unique.set(email, {
      id: email,
      email,
      name: String(row.name ?? "").trim() || null,
      source: String(row.source ?? "") || null,
      blocked: false,
      addedAt: row.created_at ? String(row.created_at) : null,
      tags: tagList(details.tags),
    });
  }
  return [...unique.values()];
}

async function fetchTableRows(): Promise<Row[] | "missing"> {
  const sb = getSupabase();
  const { count, error: countError } = await sb
    .from("newsletter_subscribers")
    .select("email", { count: "exact", head: true });
  if (countError) {
    if (isMissingTable(countError.message)) return "missing";
    throw new Error(countError.message);
  }
  if (!count) return [];

  const pages = Math.ceil(count / PAGE);
  const batches: Row[][] = [];
  for (let i = 0; i < pages; i++) {
    const { data, error } = await sb
      .from("newsletter_subscribers")
      .select("email, name, source, blocked, added_at")
      .order("added_at", { ascending: false })
      .range(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    batches.push((data ?? []) as Row[]);
  }
  return batches.flat();
}

function mergePeople(fromLeads: Subscriber[], table: Row[]): Subscriber[] {
  const byEmail = new Map(fromLeads.map((person) => [person.email, person]));
  for (const row of table) {
    const mapped = mapRow(row);
    const existing = byEmail.get(mapped.email);
    if (existing) {
      byEmail.set(mapped.email, {
        ...existing,
        blocked: mapped.blocked,
        name: mapped.name || existing.name,
        source: mapped.source || existing.source,
        addedAt: mapped.addedAt || existing.addedAt,
        tags: existing.tags ?? [],
      });
    } else {
      byEmail.set(mapped.email, mapped);
    }
  }
  return [...byEmail.values()];
}

export async function listDbSubscribers(): Promise<{
  subscribers: Subscriber[];
  tags: string[];
}> {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const people = await fetchLeadPeople();
  let subscribers: Subscriber[];
  try {
    const table = await fetchTableRows();
    subscribers = table === "missing" ? people : mergePeople(people, table);
  } catch {
    subscribers = people;
  }
  const tags = [
    ...new Set(
      subscribers.flatMap((person) => person.tags ?? []).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return { subscribers, tags };
}

export async function upsertDbSubscriber(input: {
  email: string;
  name?: string | null;
  source?: string;
}) {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const email = input.email.trim().toLowerCase();
  const sb = getSupabase();
  const { error } = await sb.from("newsletter_subscribers").upsert(
    {
      email,
      name: input.name?.trim() || null,
      source: input.source || "manual",
      blocked: false,
    },
    { onConflict: "email" },
  );
  if (error) {
    if (!isMissingTable(error.message)) throw new Error(error.message);
    const day = new Date().toISOString().slice(0, 10);
    const { error: leadErr } = await sb.from("leads").upsert(
      {
        id: `ld_${email}`,
        name: input.name?.trim() || email.split("@")[0] || email,
        email,
        phone: "",
        company: "",
        source: "manual",
        status: "new",
        value: 0,
        currency: "USD",
        owner: "Team",
        created_at: day,
        last_contact: day,
        notes: "Newsletter subscriber.",
      },
      { onConflict: "id" },
    );
    if (leadErr) throw new Error(leadErr.message);
  }
}

export async function setDbSubscriberBlocked(email: string, blocked: boolean) {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const clean = email.trim().toLowerCase();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("newsletter_subscribers")
    .update({ blocked })
    .eq("email", clean)
    .select("email")
    .maybeSingle();
  if (error) {
    if (isMissingTable(error.message)) {
      throw new Error(
        "Run supabase/newsletter_subscribers.sql in Supabase once to store unsubscribes.",
      );
    }
    throw new Error(error.message);
  }
  if (data) return;
  const { error: insertErr } = await sb.from("newsletter_subscribers").insert({
    email: clean,
    blocked,
    source: "manual",
  });
  if (insertErr) throw new Error(insertErr.message);
}

export async function blockedSubscriberEmails(): Promise<Set<string>> {
  try {
    const table = await fetchTableRows();
    if (table === "missing") return new Set();
    return new Set(
      table
        .filter((row) => row.blocked)
        .map((row) => row.email.trim().toLowerCase())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}
