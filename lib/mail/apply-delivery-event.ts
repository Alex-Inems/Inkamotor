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

async function patchTable(
  table: "mail_messages" | "mail_replies",
  providerMessageId: string,
  next: DeliveryStatus,
  at: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(table)
    .select("id, delivery_status, delivered_at, opened_at")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) return false;
    throw new Error(error.message);
  }
  if (!data) return false;

  const current =
    typeof data.delivery_status === "string"
      ? normalizeDeliveryStatus(data.delivery_status)
      : null;

  if (!shouldAdvanceDelivery(current, next)) return false;

  const patch: Record<string, string> = {
    delivery_status: next,
  };
  if (next === "delivered") {
    patch.delivered_at = (data.delivered_at as string) || at;
  }
  if (next === "opened") {
    if (!data.delivered_at) patch.delivered_at = at;
    patch.opened_at = (data.opened_at as string) || at;
  }

  const { error: updateError } = await supabase
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
): Promise<{ updated: boolean; status: DeliveryStatus | null }> {
  if (missingSupabaseEnv().length > 0) {
    return { updated: false, status: null };
  }

  const providerMessageId = normalizeProviderMessageId(input.providerMessageId);
  const status = normalizeDeliveryStatus(input.event);
  if (!providerMessageId || !status) {
    return { updated: false, status: null };
  }

  const at = input.date?.trim()
    ? new Date(input.date).toISOString()
    : new Date().toISOString();
  if (Number.isNaN(Date.parse(at))) {
    return { updated: false, status };
  }

  const [messages, replies] = await Promise.all([
    patchTable("mail_messages", providerMessageId, status, at),
    patchTable("mail_replies", providerMessageId, status, at),
  ]);

  return { updated: messages || replies, status };
}
