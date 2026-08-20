import { jsonError } from "@/lib/api";
import { missingBrevoEnv, sendTransactionalEmail } from "@/lib/brevo";
import { saveMailReply } from "@/lib/mail/replies";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  toEmail?: string;
  toName?: string;
  subject?: string;
  message?: string;
  /** Original subject for Re: prefix */
  inReplyToSubject?: string;
  relatedMailId?: string;
  relatedInquiryId?: string;
};

export async function POST(request: Request) {
  const missing = missingBrevoEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error:
        "Add BREVO_API_KEY and BREVO_SENDER_EMAIL to send inbox replies.",
      code: "missing_credentials",
      missing,
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, { error: "Invalid JSON", code: "send_failed" });
  }

  const to = body.toEmail?.trim();
  const message = body.message?.trim();
  if (!to || !message) {
    return jsonError(400, {
      error: "toEmail and message are required",
      code: "send_failed",
    });
  }

  const baseSubject =
    body.subject?.trim() ||
    body.inReplyToSubject?.trim() ||
    "Message from Inkamoto Tours";
  const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

  const html = `<div style="font-family:Georgia,serif;line-height:1.5;color:#1c1b19">
    ${message
      .split(/\n+/)
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("")}
    <p style="margin-top:1.5rem;color:#666;font-size:13px">— Inkamoto Tours<br/>contact@inkamototours.com</p>
  </div>`;

  try {
    await sendTransactionalEmail({
      toEmail: to,
      toName: body.toName,
      subject,
      htmlContent: html,
      textContent: message,
    });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not send reply",
      code: "send_failed",
    });
  }

  let reply = null;
  if (missingSupabaseEnv().length === 0) {
    try {
      reply = await saveMailReply({
        toEmail: to,
        toName: body.toName,
        subject,
        bodyText: message,
        relatedMailId: body.relatedMailId,
        relatedInquiryId: body.relatedInquiryId,
      });
    } catch {
      // Email already went out — still return a history row so the thread
      // shows the send even if one of the tables isn't migrated yet.
      reply = {
        id: crypto.randomUUID(),
        toName: body.toName ?? null,
        toEmail: to,
        subject,
        bodyText: message,
        relatedMailId: body.relatedMailId ?? null,
        relatedInquiryId: body.relatedInquiryId ?? null,
        sentAt: new Date().toISOString(),
      };
    }
  }

  return Response.json({ ok: true, subject, reply });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
