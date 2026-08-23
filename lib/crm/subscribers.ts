import type { Subscriber } from "@/lib/brevo";
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
  };
}

async function fetchLeadPeople(): Promise<Subscriber[]> {
  const sb = getSupabase();
  const { count, error: countError } = await sb
    .from("leads")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const batches = await Promise.all(
    Array.from({ length: pages }, async (_, i) => {
      const { data, error } = await sb
        .from("leads")
        .select("id, name, email, source, created_at")
        .range(i * PAGE, i * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  );

  const unique = new Map<string, Subscriber>();
  for (const row of batches.flat()) {
    const email = String(row.email ?? "")
      .trim()
      .toLowerCase();
    if (!email.includes("@") || unique.has(email)) continue;
    unique.set(email, {
      id: email,
      email,
      name: String(row.name ?? "").trim() || null,
      source: String(row.source ?? "") || null,
      blocked: false,
      addedAt: row.created_at ? String(row.created_at) : null,
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

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const batches = await Promise.all(
    Array.from({ length: pages }, async (_, i) => {
      const { data, error } = await sb
        .from("newsletter_subscribers")
        .select("email, name, source, blocked, added_at")
        .order("added_at", { ascending: false })
        .range(i * PAGE, i * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    }),
  );
  return batches.flat();
}

async function backfillFromLeads() {
  const people = await fetchLeadPeople();
  if (people.length === 0) return;
  const sb = getSupabase();
  const chunk = 200;
  for (let i = 0; i < people.length; i += chunk) {
    const batch = people.slice(i, i + chunk).map((person) => ({
      email: person.email,
      name: person.name,
      source: person.source || "import",
      blocked: false,
      added_at: person.addedAt || new Date().toISOString(),
    }));
    const { error } = await sb
      .from("newsletter_subscribers")
      .upsert(batch, { onConflict: "email" });
    if (error) throw new Error(error.message);
  }
}

export async function listDbSubscribers(): Promise<Subscriber[]> {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const rows = await fetchTableRows();
  if (rows === "missing") return fetchLeadPeople();
  if (rows.length === 0) {
    await backfillFromLeads();
    const filled = await fetchTableRows();
    if (filled === "missing") return fetchLeadPeople();
    return filled.map(mapRow);
  }
  return rows.map(mapRow);
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

export async function allowedSubscriberEmails(): Promise<Set<string>> {
  const rows = await listDbSubscribers();
  return new Set(
    rows.filter((row) => !row.blocked).map((row) => row.email.toLowerCase()),
  );
}
