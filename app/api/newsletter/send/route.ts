import { jsonError } from "@/lib/api";
import {
  createAndSendCampaign,
  missingBrevoEnv,
  sendTransactionalEmail,
} from "@/lib/brevo";

export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  subject?: string;
  htmlContent?: string;
  previewText?: string;
  /** If true, send as one transactional email to `toEmail` instead of a campaign */
  transactional?: boolean;
  toEmail?: string;
  toName?: string;
};

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

    const id = await createAndSendCampaign({
      name: body.name?.trim() || subject,
      subject,
      htmlContent: html,
      previewText: body.previewText,
    });
    return Response.json({ ok: true, mode: "campaign", id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return jsonError(502, { error: message, code: "send_failed" });
  }
}
