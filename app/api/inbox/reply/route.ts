import { jsonError } from "@/lib/api";
import { missingBrevoEnv, sendTransactionalEmail } from "@/lib/brevo";
import { saveReplyAttachment } from "@/lib/mail/attachments";
import {
  COMPOSE_MAX_FILE_BYTES,
  COMPOSE_MAX_FILES,
} from "@/lib/mail/compose-attachments";
import { messageParagraphsToHtml } from "@/lib/mail/linkify";
import { saveMailReply } from "@/lib/mail/replies";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AttachmentBody = {
  fileName?: string;
  mimeType?: string;
  base64?: string;
};

type Body = {
  toEmail?: string;
  toName?: string;
  subject?: string;
  message?: string;
  /** Original subject for Re: prefix */
  inReplyToSubject?: string;
  relatedMailId?: string;
  relatedInquiryId?: string;
  attachments?: AttachmentBody[];
};

function sanitizeAttachments(raw: AttachmentBody[] | undefined) {
  if (!raw?.length) return [];
  if (raw.length > COMPOSE_MAX_FILES) {
    throw new Error(`At most ${COMPOSE_MAX_FILES} attachments per message.`);
  }

  const out: { fileName: string; mimeType: string; base64: string }[] = [];
  for (const file of raw) {
    const fileName = file.fileName?.trim();
    const base64 = file.base64?.trim();
    if (!fileName || !base64) continue;

    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length) {
      throw new Error(`Attachment "${fileName}" is empty.`);
    }
    if (bytes.length > COMPOSE_MAX_FILE_BYTES) {
      throw new Error(`Attachment "${fileName}" is too large.`);
    }

    out.push({
      fileName,
      mimeType: file.mimeType?.trim() || "application/octet-stream",
      base64,
    });
  }
  return out;
}

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
  const message = body.message?.trim() ?? "";
  let attachments: { fileName: string; mimeType: string; base64: string }[] = [];
  try {
    attachments = sanitizeAttachments(body.attachments);
  } catch (err) {
    return jsonError(400, {
      error: err instanceof Error ? err.message : "Invalid attachments",
      code: "send_failed",
    });
  }

  if (!to || (!message && attachments.length === 0)) {
    return jsonError(400, {
      error: "Add a message, attachment, or link before sending.",
      code: "send_failed",
    });
  }

  const baseSubject =
    body.subject?.trim() ||
    body.inReplyToSubject?.trim() ||
    "Message from Inkamoto Tours";
  const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

  const bodyText =
    message ||
    attachments.map((file) => file.fileName).join(", ");

  const html = `<div style="font-family:Georgia,serif;line-height:1.5;color:#1c1b19">
    ${message ? messageParagraphsToHtml(message) : ""}
    ${
      attachments.length
        ? `<p style="margin-top:1rem;color:#666;font-size:13px">${attachments.length} attachment(s): ${attachments
            .map((file) => file.fileName)
            .join(", ")}</p>`
        : ""
    }
    <p style="margin-top:1.5rem;color:#666;font-size:13px">— Inkamoto Tours<br/>contact@inkamototours.com</p>
  </div>`;

  try {
    await sendTransactionalEmail({
      toEmail: to,
      toName: body.toName,
      subject,
      htmlContent: html,
      textContent: bodyText,
      attachments: attachments.map((file) => ({
        name: file.fileName,
        content: file.base64,
      })),
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
        bodyText,
        relatedMailId: body.relatedMailId,
        relatedInquiryId: body.relatedInquiryId,
      });

      const savedAttachments = [];
      for (const file of attachments) {
        const saved = await saveReplyAttachment({
          replyId: reply.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          base64: file.base64,
        });
        if (saved) {
          savedAttachments.push({
            id: saved.id,
            fileName: saved.fileName,
            mimeType: saved.mimeType,
            byteSize: saved.byteSize,
          });
        }
      }
      reply = { ...reply, attachments: savedAttachments };
    } catch {
      // Email already went out — still return a history row so the thread
      // shows the send even if one of the tables isn't migrated yet.
      reply = {
        id: crypto.randomUUID(),
        toName: body.toName ?? null,
        toEmail: to,
        subject,
        bodyText,
        relatedMailId: body.relatedMailId ?? null,
        relatedInquiryId: body.relatedInquiryId ?? null,
        sentAt: new Date().toISOString(),
        attachments: [],
      };
    }
  }

  return Response.json({ ok: true, subject, reply });
}
