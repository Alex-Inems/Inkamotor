import { jsonError } from "@/lib/api";
import { actorFromClaims } from "@/lib/auth-actor";
import { getSessionClaims } from "@/lib/auth-request";
import { missingBrevoEnv, sendTransactionalEmail } from "@/lib/brevo";
import {
  getReplyAttachmentFile,
  saveReplyAttachment,
} from "@/lib/mail/attachments";
import { messageParagraphsToHtml } from "@/lib/mail/linkify";
import { getMailReply, saveMailReply } from "@/lib/mail/replies";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Re-send an already-sent outbound reply (same body, CC, and attachments)
 * and append a new history row in the thread.
 */
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

  if (missingSupabaseEnv().length > 0) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
    });
  }

  let replyId = "";
  try {
    const body = (await request.json()) as { replyId?: string };
    replyId = body.replyId?.trim() ?? "";
  } catch {
    return jsonError(400, {
      error: "Invalid JSON",
      code: "send_failed",
    });
  }

  if (!replyId) {
    return jsonError(400, {
      error: "replyId is required",
      code: "send_failed",
    });
  }

  const original = await getMailReply(replyId);
  if (!original) {
    return jsonError(404, {
      error: "Message not found",
      code: "send_failed",
    });
  }

  const attachments: { fileName: string; mimeType: string; base64: string }[] =
    [];
  for (const att of original.attachments) {
    const file = await getReplyAttachmentFile(att.id);
    if (!file?.data?.length) {
      return jsonError(502, {
        error: `Could not load attachment "${att.fileName}" for resend.`,
        code: "send_failed",
      });
    }
    attachments.push({
      fileName: file.meta.fileName || att.fileName,
      mimeType: file.meta.mimeType || att.mimeType || "application/octet-stream",
      base64: file.data.toString("base64"),
    });
  }

  const bodyText =
    original.bodyText.trim() ||
    attachments.map((file) => file.fileName).join(", ");
  const messageHtml = original.bodyHtml.trim();
  const ccEmails = original.ccEmails;
  const subject =
    original.subject.trim() || "Message from Inkamoto Tours";

  const htmlInner = messageHtml
    ? messageHtml
    : original.bodyText.trim()
      ? messageParagraphsToHtml(original.bodyText)
      : "";

  const html = `<div style="font-family:Georgia,serif;line-height:1.5;color:#1c1b19">
    ${htmlInner}
    ${
      attachments.length
        ? `<p style="margin-top:1rem;color:#666;font-size:13px">${attachments.length} attachment(s): ${attachments
            .map((file) => file.fileName)
            .join(", ")}</p>`
        : ""
    }
    <p style="margin-top:1.5rem;color:#666;font-size:13px">— Inkamoto Tours<br/>contact@inkamototours.com</p>
  </div>`;

  let providerMessageId: string | null = null;
  try {
    const sent = await sendTransactionalEmail({
      toEmail: original.toEmail,
      toName: original.toName ?? undefined,
      subject,
      htmlContent: html,
      textContent: bodyText,
      tags: ["inbox-resend"],
      ccEmails,
      attachments: attachments.map((file) => ({
        name: file.fileName,
        content: file.base64,
      })),
    });
    providerMessageId = sent.messageId;
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not resend message",
      code: "send_failed",
    });
  }

  const actor = actorFromClaims(await getSessionClaims());

  let reply = null;
  try {
    reply = await saveMailReply({
      toEmail: original.toEmail,
      toName: original.toName,
      subject,
      bodyText,
      bodyHtml: messageHtml,
      ccEmails,
      relatedMailId: original.relatedMailId,
      relatedInquiryId: original.relatedInquiryId,
      providerMessageId,
      deliveryStatus: "sent",
      actor,
    });

    const savedAttachments = [];
    for (const file of attachments) {
      const saved = await saveReplyAttachment({
        replyId: reply.id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        base64: file.base64,
        dedupe: false,
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
    reply = {
      id: crypto.randomUUID(),
      toName: original.toName,
      toEmail: original.toEmail,
      subject,
      bodyText,
      bodyHtml: messageHtml,
      ccEmails,
      relatedMailId: original.relatedMailId,
      relatedInquiryId: original.relatedInquiryId,
      sentAt: new Date().toISOString(),
      editedAt: null,
      providerMessageId,
      deliveryStatus: "sent" as const,
      deliveredAt: null,
      openedAt: null,
      sentByEmail: actor?.email ?? null,
      sentByName: actor?.name ?? null,
      attachments: [],
    };
  }

  return Response.json({ ok: true, subject, reply });
}
