import type { ActorAttribution } from "@/lib/auth-actor";
import { isMissingColumnError } from "@/lib/mail/schema-compat";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export type MailNote = {
  id: string;
  threadEmail: string;
  bodyText: string;
  bodyHtml: string;
  authorEmail: string | null;
  authorName: string | null;
  relatedSaleId: string | null;
  createdAt: string;
  editedAt: string | null;
};

function mapNote(row: Record<string, unknown>): MailNote {
  return {
    id: String(row.id),
    threadEmail: String(row.thread_email ?? "").toLowerCase(),
    bodyText: String(row.body_text ?? ""),
    bodyHtml: String(row.body_html ?? ""),
    authorEmail: (row.author_email as string) || null,
    authorName: (row.author_name as string) || null,
    relatedSaleId: (row.related_sale_id as string) || null,
    createdAt: String(row.created_at),
    editedAt: (row.edited_at as string) || null,
  };
}

export async function listMailNotes(
  threadEmail: string,
  limit = 200,
): Promise<MailNote[]> {
  if (missingSupabaseEnv().length) return [];
  const key = threadEmail.trim().toLowerCase();
  if (!key) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from("mail_notes")
    .select(
      "id, thread_email, body_text, body_html, author_email, author_name, related_sale_id, created_at, edited_at",
    )
    .ilike("thread_email", key)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    if (isMissingColumnError(error) || /relation .* does not exist/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapNote(row as Record<string, unknown>));
}

export async function createMailNote(input: {
  threadEmail: string;
  bodyText: string;
  bodyHtml?: string;
  relatedSaleId?: string | null;
  actor?: ActorAttribution | null;
}): Promise<MailNote> {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const threadEmail = input.threadEmail.trim().toLowerCase();
  const bodyText = input.bodyText.trim();
  if (!threadEmail || !bodyText) {
    throw new Error("Note needs a thread and body");
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("mail_notes")
    .insert({
      thread_email: threadEmail,
      body_text: bodyText,
      body_html: input.bodyHtml?.trim() || "",
      author_email: input.actor?.email ?? null,
      author_name: input.actor?.name ?? null,
      related_sale_id: input.relatedSaleId ?? null,
    })
    .select(
      "id, thread_email, body_text, body_html, author_email, author_name, related_sale_id, created_at, edited_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return mapNote(data as Record<string, unknown>);
}

export async function updateMailNote(
  id: string,
  bodyText: string,
  bodyHtml?: string,
): Promise<MailNote> {
  if (missingSupabaseEnv().length) {
    throw new Error("Supabase is not configured");
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("mail_notes")
    .update({
      body_text: bodyText.trim(),
      body_html: bodyHtml?.trim() || "",
      edited_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(
      "id, thread_email, body_text, body_html, author_email, author_name, related_sale_id, created_at, edited_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return mapNote(data as Record<string, unknown>);
}

export async function deleteMailNote(id: string): Promise<void> {
  if (missingSupabaseEnv().length) return;
  const sb = getSupabase();
  const { error } = await sb.from("mail_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
