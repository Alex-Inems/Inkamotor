import { missingBrevoEnv, listSmtpEmailEvents } from "@/lib/brevo";
import { applyDeliveryEvent } from "@/lib/mail/apply-delivery-event";
import {
  normalizeDeliveryStatus,
  normalizeProviderMessageId,
  shouldAdvanceDelivery,
  type DeliveryStatus,
} from "@/lib/mail/delivery";
import { isMissingColumnError } from "@/lib/mail/schema-compat";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

type SyncEvent = {
  email?: string;
  event?: string;
  date?: string;
  subject?: string;
  messageId?: string;
  status: DeliveryStatus;
};

const recentSync = new Map<
  string,
  { at: number; result: Promise<{ checked: number; updated: number }> }
>();
const SYNC_COOLDOWN_MS = 12_000;

/**
 * Pull recent Brevo transactional events and advance delivery_status on
 * matching CRM rows. Used when the Brevo webhook is not configured — opening
 * mail in Gmail often only shows up as `loadedByProxy` / `opened` here.
 */
export async function syncDeliveryFromBrevo(opts?: {
  email?: string | null;
  limit?: number;
}): Promise<{ checked: number; updated: number }> {
  if (missingSupabaseEnv().length > 0 || missingBrevoEnv().length > 0) {
    return { checked: 0, updated: 0 };
  }

  const email = opts?.email?.trim().toLowerCase() || "";
  const cacheKey = email || "*";
  const cached = recentSync.get(cacheKey);
  if (cached && Date.now() - cached.at < SYNC_COOLDOWN_MS) {
    return cached.result;
  }

  const result = runSync({ email, limit: opts?.limit });
  recentSync.set(cacheKey, { at: Date.now(), result });
  try {
    return await result;
  } catch (err) {
    recentSync.delete(cacheKey);
    throw err;
  }
}

async function runSync(opts: {
  email: string;
  limit?: number;
}): Promise<{ checked: number; updated: number }> {
  const events = await listSmtpEmailEvents({
    limit: opts.limit ?? 50,
    email: opts.email || undefined,
  });

  // Collapse to strongest status per message-id (or email+subject fallback key).
  const best = new Map<string, SyncEvent>();
  for (const row of events) {
    const status = normalizeDeliveryStatus(row.event);
    if (!status || status === "queued") continue;
    const mid = normalizeProviderMessageId(row.messageId);
    const key =
      mid ??
      `email:${(row.email ?? "").trim().toLowerCase()}|${(row.subject ?? "").trim().toLowerCase()}`;
    if (!mid && key === "email:|") continue;

    const next: SyncEvent = { ...row, status };
    const prev = best.get(key);
    if (!prev || shouldAdvanceDelivery(prev.status, status)) {
      best.set(key, next);
    }
  }

  let updated = 0;
  for (const row of best.values()) {
    if (row.messageId) {
      const byId = await applyDeliveryEvent({
        providerMessageId: row.messageId,
        event: row.status,
        date: row.date,
      });
      if (byId.updated) {
        updated += 1;
        continue;
      }
      // Row exists but is already at/past this status — don't subject-match
      // a different outbound message.
      if (byId.found) continue;
    }

    const recipient = row.email?.trim().toLowerCase();
    if (!recipient) continue;
    const advanced = await advanceLatestReplyForEmail({
      email: recipient,
      status: row.status,
      at: row.date,
      subject: row.subject,
    });
    if (advanced) updated += 1;
  }

  return { checked: events.length, updated };
}

async function advanceLatestReplyForEmail(input: {
  email: string;
  status: DeliveryStatus;
  at?: string | null;
  subject?: string | null;
}): Promise<boolean> {
  const supabase = getSupabase();
  const at = input.at?.trim()
    ? new Date(input.at).toISOString()
    : new Date().toISOString();
  if (Number.isNaN(Date.parse(at))) return false;

  const { data, error } = await supabase
    .from("mail_replies")
    .select(
      "id, delivery_status, delivered_at, opened_at, subject, provider_message_id",
    )
    .eq("to_email", input.email)
    .order("sent_at", { ascending: false })
    .limit(8);

  if (error) {
    if (isMissingColumnError(error)) return false;
    throw new Error(error.message);
  }
  if (!data?.length) return false;

  const subject = input.subject?.trim().toLowerCase() || "";
  const candidates = subject
    ? data.filter((row) => {
        const sub = String(row.subject ?? "").trim().toLowerCase();
        return (
          !sub ||
          sub === subject ||
          sub === `re: ${subject}` ||
          subject === `re: ${sub}` ||
          sub.includes(subject) ||
          subject.includes(sub.replace(/^re:\s*/i, ""))
        );
      })
    : data;
  const rows = candidates.length ? candidates : data;

  for (const row of rows) {
    const current =
      typeof row.delivery_status === "string"
        ? normalizeDeliveryStatus(row.delivery_status)
        : null;
    if (!shouldAdvanceDelivery(current, input.status)) continue;

    const patch: Record<string, string> = {
      delivery_status: input.status,
    };
    if (input.status === "delivered" || input.status === "opened") {
      patch.delivered_at = (row.delivered_at as string) || at;
    }
    if (input.status === "opened") {
      patch.opened_at = (row.opened_at as string) || at;
    }

    const { error: updateError } = await supabase
      .from("mail_replies")
      .update(patch)
      .eq("id", row.id);
    if (updateError) {
      if (isMissingColumnError(updateError)) return false;
      throw new Error(updateError.message);
    }

    const providerId =
      typeof row.provider_message_id === "string"
        ? row.provider_message_id
        : null;
    if (providerId) {
      await applyDeliveryEvent({
        providerMessageId: providerId,
        event: input.status,
        date: at,
      });
    }
    return true;
  }
  return false;
}
