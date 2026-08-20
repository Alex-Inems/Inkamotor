import { jsonError } from "@/lib/api";
import {
  createAndSendCampaign,
  listBrevoContacts,
  missingBrevoEnv,
  sendTransactionalEmail,
} from "@/lib/brevo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  name?: string;
  subject?: string;
  htmlContent?: string;
  previewText?: string;
  emails?: string[];
  /** If true, send as one transactional email to `toEmail` instead of a campaign */
  transactional?: boolean;
  toEmail?: string;
  toName?: string;
};

function cleanEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    ),
  ];
}

export async function POST(request: Request) {
  const missing = missingBrevoEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add BREVO_API_KEY and BREVO_SENDER_EMAIL to .env.local, then restart.",
      code: "missing_credentials",
      missing,
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, { error: "Invalid JSON body", code: "send_failed" });
  }

  const subject = body.subject?.trim();
  const html =
    body.htmlContent?.trim() ||
    `<p>${(body.previewText || subject || "").replace(/</g, "&lt;")}</p>`;

  if (!subject) {
    return jsonError(400, { error: "Subject is required", code: "send_failed" });
  }

  try {
    if (body.transactional) {
      const to = body.toEmail?.trim();
      if (!to) {
        return jsonError(400, {
          error: "toEmail is required for transactional mail",
          code: "send_failed",
        });
      }
      await sendTransactionalEmail({
        toEmail: to,
        toName: body.toName,
        subject,
        htmlContent: html,
        textContent: body.previewText,
      });
      return Response.json({ ok: true, mode: "transactional" });
    }

    const requested = cleanEmails(body.emails);
    if (requested.length === 0) {
      return jsonError(400, {
        error: "Select at least one recipient.",
        code: "send_failed",
      });
    }

    const { contacts } = await listBrevoContacts();
    const allowed = new Set(
      contacts
        .filter((c) => !c.emailBlacklisted)
        .map((c) => c.email.trim().toLowerCase()),
    );
    const emails = requested.filter((email) => allowed.has(email));
    if (emails.length === 0) {
      return jsonError(400, {
        error: "None of those addresses are on the subscriber list.",
        code: "send_failed",
      });
    }

    const id = await createAndSendCampaign({
      name: body.name?.trim() || subject,
      subject,
      htmlContent: html,
      previewText: body.previewText,
      emails,
    });
    return Response.json({ ok: true, mode: "campaign", id, recipients: emails.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return jsonError(502, { error: message, code: "send_failed" });
  }
}
