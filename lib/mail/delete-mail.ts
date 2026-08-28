import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export function parseInboxMessageKey(key: string) {
  if (key.startsWith("out-mail-")) {
    return { table: "mail_messages" as const, id: key.slice("out-mail-".length) };
  }
  if (key.startsWith("in-")) {
    return { table: "mail_messages" as const, id: key.slice("in-".length) };
  }
  if (key.startsWith("out-")) {
    return { table: "mail_replies" as const, id: key.slice("out-".length) };
  }
  return null;
}

async function deleteReplyAttachments(sb: ReturnType<typeof getSupabase>, replyIds: string[]) {
  if (replyIds.length === 0) return;
  const { error } = await sb
    .from("mail_reply_attachments")
    .delete()
    .in("reply_id", replyIds);
  if (error) throw new Error(error.message);
}

export async function deleteInboxMessage(messageKey: string) {
  if (missingSupabaseEnv().length > 0) {
    throw new Error("Supabase is not configured");
  }

  const parsed = parseInboxMessageKey(messageKey);
  if (!parsed) throw new Error("Invalid message id");

  const sb = getSupabase();

  if (parsed.table === "mail_replies") {
    await deleteReplyAttachments(sb, [parsed.id]);
    const { error } = await sb.from("mail_replies").delete().eq("id", parsed.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { data: row, error: findErr } = await sb
    .from("mail_messages")
    .select("message_id")
    .eq("id", parsed.id)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  const { error } = await sb.from("mail_messages").delete().eq("id", parsed.id);
  if (error) throw new Error(error.message);

  const messageId = row?.message_id ? String(row.message_id) : "";
  if (messageId.startsWith("crm-sent-")) {
    const replyId = messageId.slice("crm-sent-".length);
    await deleteReplyAttachments(sb, [replyId]);
    await sb.from("mail_replies").delete().eq("id", replyId);
  }
}

export async function deleteInboxConversation(email: string) {
  if (missingSupabaseEnv().length > 0) {
    throw new Error("Supabase is not configured");
  }

  const target = email.trim().toLowerCase();
  if (!target || !target.includes("@")) {
    throw new Error("Valid email is required");
  }

  const sb = getSupabase();

  const { data: replies, error: repliesErr } = await sb
    .from("mail_replies")
    .select("id")
    .ilike("to_email", target);
  if (repliesErr) throw new Error(repliesErr.message);

  const replyIds = (replies ?? []).map((row) => String(row.id));
  await deleteReplyAttachments(sb, replyIds);

  const { error: delRepliesErr } = await sb
    .from("mail_replies")
    .delete()
    .ilike("to_email", target);
  if (delRepliesErr) throw new Error(delRepliesErr.message);

  const { error: delFromErr } = await sb
    .from("mail_messages")
    .delete()
    .ilike("from_email", target);
  if (delFromErr) throw new Error(delFromErr.message);

  const { error: delToErr } = await sb
    .from("mail_messages")
    .delete()
    .ilike("to_email", target);
  if (delToErr) throw new Error(delToErr.message);
}
