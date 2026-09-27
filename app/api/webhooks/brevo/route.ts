import { jsonError } from "@/lib/api";
import { applyDeliveryEvent } from "@/lib/mail/apply-delivery-event";

export const dynamic = "force-dynamic";

type BrevoEvent = {
  event?: string;
  "message-id"?: string;
  messageId?: string;
  "message-id-header"?: string;
  date?: string;
  ts?: number | string;
  ts_event?: number | string;
};

function webhookSecretOk(request: Request): boolean {
  const secret = process.env.BREVO_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const headerSecret =
    request.headers.get("x-brevo-secret")?.trim() ||
    request.headers.get("x-webhook-secret")?.trim() ||
    "";
  if (headerSecret && headerSecret === secret) return true;

  const auth = request.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (bearer && bearer === secret) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim() ?? "";
  return querySecret === secret;
}

function asEvents(body: unknown): BrevoEvent[] {
  if (Array.isArray(body)) return body as BrevoEvent[];
  if (body && typeof body === "object") return [body as BrevoEvent];
  return [];
}

function eventAt(row: BrevoEvent): string | null {
  if (row.date?.trim()) return row.date.trim();
  const ts = row.ts_event ?? row.ts;
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof ts === "string" && ts.trim()) {
    const n = Number(ts);
    if (Number.isFinite(n)) {
      const ms = n > 1e12 ? n : n * 1000;
      return new Date(ms).toISOString();
    }
    return ts.trim();
  }
  return null;
}

export async function POST(request: Request) {
  if (!webhookSecretOk(request)) {
    return jsonError(401, { error: "Unauthorized", code: "unauthorized" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "bad_request" });
  }

  const events = asEvents(body);
  let updated = 0;
  for (const row of events) {
    const providerMessageId =
      row["message-id"] || row.messageId || row["message-id-header"] || null;
    const result = await applyDeliveryEvent({
      providerMessageId,
      event: row.event,
      date: eventAt(row),
    });
    if (result.updated) updated += 1;
  }

  return Response.json({ ok: true, received: events.length, updated });
}
