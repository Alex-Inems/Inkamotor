import { missingEnv } from "@/lib/api";

const BREVO_KEYS = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL"] as const;
const BASE = "https://api.brevo.com/v3";

export type BrevoCampaign = {
  id: number;
  name: string;
  subject?: string;
  status?: string;
  scheduledAt?: string;
  sentDate?: string;
  statistics?: {
    globalStats?: {
      delivered?: number;
      uniqueOpens?: number;
      uniqueClicks?: number;
      unsubscriptions?: number;
    };
  };
  recipients?: { lists?: number[] };
  previewText?: string;
  htmlContent?: string;
};

export function missingBrevoEnv(): string[] {
  return missingEnv(BREVO_KEYS);
}

function headers() {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": process.env.BREVO_API_KEY!.trim(),
  };
}

async function brevo<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo ${res.status}: ${text.slice(0, 400)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function sender() {
  return {
    email: process.env.BREVO_SENDER_EMAIL!.trim(),
    name: process.env.BREVO_SENDER_NAME?.trim() || "Inkamoto Tours",
  };
}

export async function listBrevoCampaigns(limit = 50) {
  const data = await brevo<{ campaigns?: BrevoCampaign[] }>(
    `/emailCampaigns?limit=${limit}&sort=desc`,
  );
  return data.campaigns ?? [];
}

export async function createAndSendCampaign(input: {
  name: string;
  subject: string;
  htmlContent: string;
  previewText?: string;
  listId?: number;
}) {
  const listId =
    input.listId ??
    (process.env.BREVO_LIST_ID?.trim()
      ? Number(process.env.BREVO_LIST_ID.trim())
      : NaN);

  if (!Number.isFinite(listId)) {
    throw new Error(
      "Set BREVO_LIST_ID in .env.local (Brevo → Contacts → Lists → list id).",
    );
  }

  const created = await brevo<{ id: number }>("/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      subject: input.subject,
      sender: sender(),
      htmlContent: input.htmlContent,
      previewText: input.previewText || input.subject,
      recipients: { listIds: [listId] },
    }),
  });

  await brevo(`/emailCampaigns/${created.id}/sendNow`, { method: "POST" });
  return created.id;
}

export async function sendTransactionalEmail(input: {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}) {
  await brevo("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender: sender(),
      to: [{ email: input.toEmail, name: input.toName }],
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
    }),
  });
}

export function mapBrevoCampaign(c: BrevoCampaign) {
  const stats = c.statistics?.globalStats;
  const statusRaw = (c.status || "draft").toLowerCase();
  const status =
    statusRaw.includes("sent") || statusRaw === "sent"
      ? "sent"
      : statusRaw.includes("queue") || statusRaw.includes("schedule")
        ? "scheduled"
        : statusRaw.includes("archive") || statusRaw.includes("suspend")
          ? "archived"
          : "draft";

  return {
    id: String(c.id),
    brevoId: String(c.id),
    name: c.name,
    subject: c.subject || c.name,
    status,
    audience: "Brevo list",
    recipients: stats?.delivered ?? 0,
    opens: stats?.uniqueOpens ?? 0,
    clicks: stats?.uniqueClicks ?? 0,
    unsubscribes: stats?.unsubscriptions ?? 0,
    scheduledAt: c.scheduledAt ?? null,
    sentAt: c.sentDate ?? null,
    preview: c.previewText || "",
  };
}
