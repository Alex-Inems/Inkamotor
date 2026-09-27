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

function idVariants(id: string): string[] {
  const bare = id.replace(/^<|>$/g, "").trim();
  return [...new Set([id, bare, `<${bare}>`].filter(Boolean))];
}

async function findRow(
  table: "mail_messages" | "mail_replies",
  providerMessageId: string,
) {
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
    if (data) return data;
  }
  return null;
}

async function patchTable(
  table: "mail_messages" | "mail_replies",
  providerMessageId: string,
  next: DeliveryStatus,
  at: string,
): Promise<boolean> {
  const data = await findRow(table, providerMessageId);
  if (!data) return false;

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
