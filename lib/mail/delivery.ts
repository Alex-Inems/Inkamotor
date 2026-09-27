export type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "bounced"
  | "error";

const RANK: Record<DeliveryStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  bounced: 4,
  error: 4,
};

export function normalizeDeliveryStatus(
  value: string | null | undefined,
): DeliveryStatus | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase().replace(/[_-]+/g, "");
  if (raw === "queued" || raw === "request" || raw === "requests") return "queued";
  if (raw === "sent" || raw === "deferred") return "sent";
  if (raw === "delivered") return "delivered";
  if (
    raw === "opened" ||
    raw === "uniqueopened" ||
    raw === "unique_opened" ||
    raw === "firstopening" ||
    raw === "proxyopen"
  ) {
    return "opened";
  }
  if (
    raw === "hardbounce" ||
    raw === "softbounce" ||
    raw === "bounce" ||
    raw === "blocked" ||
    raw === "invalid"
  ) {
    return "bounced";
  }
  if (raw === "error" || raw === "spam" || raw === "rejected") return "error";
  return null;
}

/** Prefer stronger / more advanced status; bounce/error only replace if not opened. */
export function shouldAdvanceDelivery(
  current: DeliveryStatus | null | undefined,
  next: DeliveryStatus,
): boolean {
  if (!current) return true;
  if (current === "opened") return false;
  if (next === "opened") return true;
  // Late delivery after bounce can still count as recovered.
  if ((current === "bounced" || current === "error") && next === "delivered") {
    return true;
  }
  if (current === "bounced" || current === "error") return false;
  return RANK[next] >= RANK[current];
}

export function normalizeProviderMessageId(
  value: string | null | undefined,
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  return raw.replace(/^<|>$/g, "").trim() || null;
}
