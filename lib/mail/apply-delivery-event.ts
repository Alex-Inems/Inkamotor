import {
  normalizeDeliveryStatus,
  normalizeProviderMessageId,
  shouldAdvanceDelivery,
  type DeliveryStatus,
} from "@/lib/mail/delivery";
import { isMissingColumnError } from "@/lib/mail/schema-compat";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

export type DeliveryEventInput = {
  providerMessageId?: string | null;
  event?: string | null;
  date?: string | null;
};

type DeliveryRow = {
  id: string | number;
  delivery_status?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  provider_message_id?: string | null;
};

function idVariants(id: string): string[] {
  const bare = id.replace(/^<|>$/g, "").trim();
  // Prefer bare id first — that's how we store Brevo messageIds on send.
  return [...new Set([bare, id, `<${bare}>`].filter(Boolean))];
}

async function findRow(
  table: "mail_messages" | "mail_replies",
  providerMessageId: string,
): Promise<DeliveryRow | null> {
  const supabase = getSupabase();
  for (const candidate of idVariants(providerMessageId)) {
    const { data, error } = await supabase
      .from(table)
      .select("id, delivery_status, delivered_at, opened_at, provider_message_id")
      .eq("provider_message_id", candidate)
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isMissingColumnError(error)) return null;
      throw new Error(error.message);
    }
    if (data) return data as DeliveryRow;
  }
  return null;
}

async function patchRow(
  table: "mail_messages" | "mail_replies",
  data: DeliveryRow,
  next: DeliveryStatus,
  at: string,
): Promise<boolean> {
  const current =
    typeof data.delivery_status === "string"
      ? normalizeDeliveryStatus(data.delivery_status)
      : null;

  if (!shouldAdvanceDelivery(current, next)) return false;

  const patch: Record<string, string> = {
    delivery_status: next,
  };
  if (next === "delivered" || next === "opened") {
    patch.delivered_at = (data.delivered_at as string) || at;
  }
  if (next === "opened") {
    patch.opened_at = (data.opened_at as string) || at;
  }

  const { error: updateError } = await getSupabase()
    .from(table)
    .update(patch)
    .eq("id", data.id);
  if (updateError) {
    if (isMissingColumnError(updateError)) return false;
    throw new Error(updateError.message);
  }
  return true;
}

/** Map a Brevo transactional event onto mail_messages + mail_replies. */
export async function applyDeliveryEvent(
  input: DeliveryEventInput,
): Promise<{
  updated: boolean;
  found: boolean;
  status: DeliveryStatus | null;
}> {
  if (missingSupabaseEnv().length > 0) {
    return { updated: false, found: false, status: null };
  }

  const providerMessageId = normalizeProviderMessageId(input.providerMessageId);
  const status = normalizeDeliveryStatus(input.event);
  if (!providerMessageId || !status) {
    return { updated: false, found: false, status: null };
  }

  const at = input.date?.trim()
    ? new Date(input.date).toISOString()
    : new Date().toISOString();
  if (Number.isNaN(Date.parse(at))) {
    return { updated: false, found: false, status };
  }

  const [messageRow, replyRow] = await Promise.all([
    findRow("mail_messages", providerMessageId),
    findRow("mail_replies", providerMessageId),
  ]);
  const found = !!(messageRow || replyRow);
  if (!found) {
    return { updated: false, found: false, status };
  }

  const [messages, replies] = await Promise.all([
    messageRow
      ? patchRow("mail_messages", messageRow, status, at)
      : Promise.resolve(false),
    replyRow
      ? patchRow("mail_replies", replyRow, status, at)
      : Promise.resolve(false),
  ]);

  return { updated: messages || replies, found: true, status };
}

/**
 * If a row was marked Opened only from a privacy-proxy pixel, demote it to
 * Delivered when sync finds no real open event for that message id.
 */
export async function demoteFalseProxyOpen(
  providerMessageId: string,
): Promise<boolean> {
  if (missingSupabaseEnv().length > 0) return false;
  const mid = normalizeProviderMessageId(providerMessageId);
  if (!mid) return false;

  let changed = false;
  for (const table of ["mail_messages", "mail_replies"] as const) {
    const row = await findRow(table, mid);
    if (!row) continue;
    const current =
      typeof row.delivery_status === "string"
        ? normalizeDeliveryStatus(row.delivery_status)
        : null;
    if (current !== "opened") continue;

    const { error } = await getSupabase()
      .from(table)
      .update({
        delivery_status: "delivered",
        opened_at: null,
        delivered_at: (row.delivered_at as string) || new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) {
      if (isMissingColumnError(error)) continue;
      throw new Error(error.message);
    }
    changed = true;
  }
  return changed;
}
