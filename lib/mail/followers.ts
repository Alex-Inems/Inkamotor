import { isMissingColumnError } from "@/lib/mail/schema-compat";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export type MailFollower = {
  id: string;
  threadEmail: string;
  partnerEmail: string;
  partnerName: string;
  userId: string | null;
  createdAt: string;
};

function mapFollower(row: Record<string, unknown>): MailFollower {
  return {
    id: String(row.id),
    threadEmail: String(row.thread_email ?? "").toLowerCase(),
    partnerEmail: String(row.partner_email ?? "").toLowerCase(),
    partnerName: String(row.partner_name ?? ""),
    userId: (row.user_id as string) || null,
    createdAt: String(row.created_at),
  };
}

export async function listFollowers(threadEmail: string): Promise<MailFollower[]> {
  if (missingSupabaseEnv().length) return [];
  const key = threadEmail.trim().toLowerCase();
  if (!key) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from("mail_followers")
    .select("id, thread_email, partner_email, partner_name, user_id, created_at")
    .ilike("thread_email", key)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingColumnError(error) || /relation .* does not exist/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapFollower(row as Record<string, unknown>));
}

export async function addFollower(input: {
  threadEmail: string;
  partnerEmail: string;
  partnerName?: string;
  userId?: string | null;
}): Promise<MailFollower> {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const threadEmail = input.threadEmail.trim().toLowerCase();
  const partnerEmail = input.partnerEmail.trim().toLowerCase();
  if (!threadEmail || !partnerEmail) {
    throw new Error("Follower needs thread and email");
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("mail_followers")
    .upsert(
      {
        thread_email: threadEmail,
        partner_email: partnerEmail,
        partner_name: input.partnerName?.trim() || "",
        user_id: input.userId ?? null,
      },
      { onConflict: "thread_email,partner_email" },
    )
    .select("id, thread_email, partner_email, partner_name, user_id, created_at")
    .single();
  if (error) throw new Error(error.message);
  return mapFollower(data as Record<string, unknown>);
}

export async function removeFollower(id: string): Promise<void> {
  if (missingSupabaseEnv().length) return;
  const sb = getSupabase();
  const { error } = await sb.from("mail_followers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeFollowerByEmail(
  threadEmail: string,
  partnerEmail: string,
): Promise<void> {
  if (missingSupabaseEnv().length) return;
  const sb = getSupabase();
  const { error } = await sb
    .from("mail_followers")
    .delete()
    .ilike("thread_email", threadEmail.trim().toLowerCase())
    .ilike("partner_email", partnerEmail.trim().toLowerCase());
  if (error) throw new Error(error.message);
}
