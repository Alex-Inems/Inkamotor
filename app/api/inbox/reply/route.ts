import { jsonError } from "@/lib/api";
import { actorFromClaims } from "@/lib/auth-actor";
import { getSessionClaims } from "@/lib/auth-request";
import { missingBrevoEnv, sendTransactionalEmail } from "@/lib/brevo";
import { saveReplyAttachment } from "@/lib/mail/attachments";
import {
  COMPOSE_MAX_FILE_BYTES,
  COMPOSE_MAX_FILES,
  COMPOSE_MAX_TOTAL_BYTES,
} from "@/lib/mail/compose-attachments";
import { messageParagraphsToHtml } from "@/lib/mail/linkify";
import { saveMailReply } from "@/lib/mail/replies";
import {
  deleteStagedFiles,
  loadStagedFiles,
} from "@/lib/mail/staged-files";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  messageHtml?: string;
  ccEmails?: string[];
  /** Original subject for Re: prefix */
  inReplyToSubject?: string;
  relatedMailId?: string;
  relatedInquiryId?: string;
  attachments?: AttachmentBody[];
};

function sanitizeBase64Attachments(raw: AttachmentBody[] | undefined) {
  if (!raw?.length) return [];
  if (raw.length > COMPOSE_MAX_FILES) {
    throw new Error(`At most ${COMPOSE_MAX_FILES} attachments per message.`);
  }

  const out: { fileName: string; mimeType: string; base64: string }[] = [];
  let total = 0;
  for (const file of raw) {
    const fileName = file.fileName?.trim();
    const base64 = file.base64?.trim();
    if (!fileName || !base64) continue;

    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length) {
      throw new Error(`Attachment "${fileName}" is empty.`);
    }
    if (bytes.length > COMPOSE_MAX_FILE_BYTES) {
      throw new Error(
        `Attachment "${fileName}" is too large (max ${Math.round(COMPOSE_MAX_FILE_BYTES / (1024 * 1024))} MB).`,
      );
    }
    total += bytes.length;
    if (total > COMPOSE_MAX_TOTAL_BYTES) {
      throw new Error("Attachments together are too large for one message.");
    }

    out.push({
      fileName,
      mimeType: file.mimeType?.trim() || "application/octet-stream",
      base64,
    });
  }
  return out;
}

async function parseRequest(request: Request): Promise<{
  body: Body;
  attachments: { fileName: string; mimeType: string; base64: string }[];
  stagedIds: string[];
}> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const body: Body = {
      toEmail: String(form.get("toEmail") ?? ""),
      toName: String(form.get("toName") ?? "") || undefined,
      subject: String(form.get("subject") ?? "") || undefined,
      message: String(form.get("message") ?? ""),
      messageHtml: String(form.get("messageHtml") ?? "") || undefined,
      ccEmails: form
        .getAll("ccEmails")
        .map((v) => String(v).trim())
        .filter(Boolean),
      inReplyToSubject: String(form.get("inReplyToSubject") ?? "") || undefined,
      relatedMailId: String(form.get("relatedMailId") ?? "") || undefined,
      relatedInquiryId: String(form.get("relatedInquiryId") ?? "") || undefined,
    };

    const stagedIds = form
      .getAll("stagedIds")
      .map((v) => String(v).trim())
      .filter(Boolean);

    const files = form.getAll("files").filter((v): v is File => v instanceof File);
    if (files.length + stagedIds.length > COMPOSE_MAX_FILES) {
      throw new Error(`At most ${COMPOSE_MAX_FILES} attachments per message.`);
    }

    const attachments: { fileName: string; mimeType: string; base64: string }[] =
      [];
    let total = 0;
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      if (!buf.length) {
        throw new Error(`Attachment "${file.name}" is empty.`);
      }
      if (buf.length > COMPOSE_MAX_FILE_BYTES) {
        throw new Error(
          `Attachment "${file.name}" is too large (max ${Math.round(COMPOSE_MAX_FILE_BYTES / (1024 * 1024))} MB).`,
        );
      }
      total += buf.length;
      if (total > COMPOSE_MAX_TOTAL_BYTES) {
        throw new Error("Attachments together are too large for one message.");
      }
      attachments.push({
        fileName: file.name || "attachment",
        mimeType: file.type || "application/octet-stream",
        base64: buf.toString("base64"),
      });
    }

    if (stagedIds.length) {
      const staged = await loadStagedFiles(stagedIds);
      if (staged.length !== stagedIds.length) {
        throw new Error("One or more uploaded files expired — attach them again.");
      }
      for (const file of staged) {
        total += file.byteSize;
        if (total > COMPOSE_MAX_TOTAL_BYTES) {
          throw new Error("Attachments together are too large for one message.");
        }
        attachments.push({
          fileName: file.fileName,
          mimeType: file.mimeType,
          base64: file.base64,
        });
      }
    }

    return { body, attachments, stagedIds };
  }

  const body = (await request.json()) as Body;
  return {
    body,
    attachments: sanitizeBase64Attachments(body.attachments),
    stagedIds: [],
  };
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
  let attachments: { fileName: string; mimeType: string; base64: string }[] = [];
  let stagedIds: string[] = [];
  try {
    const parsed = await parseRequest(request);
    body = parsed.body;
    attachments = parsed.attachments;
    stagedIds = parsed.stagedIds;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    const isJson = /json/i.test(message);
    return jsonError(400, {
      error: isJson ? "Invalid JSON" : message,
      code: "send_failed",
    });
  }

  const to = body.toEmail?.trim();
  const message = body.message?.trim() ?? "";

  if (!to || (!message && attachments.length === 0)) {
    return jsonError(400, {
      error: "Add a message, attachment, or link before sending.",
      code: "send_failed",
    });
  }

  const explicitSubject = body.subject?.trim();
  const fallbackSubject =
    body.inReplyToSubject?.trim() || "Message from Inkamoto Tours";
  const subject = explicitSubject
    ? explicitSubject
    : /^re:/i.test(fallbackSubject)
      ? fallbackSubject
      : `Re: ${fallbackSubject}`;

  const bodyText =
    message ||
    attachments.map((file) => file.fileName).join(", ");
  const messageHtml = body.messageHtml?.trim() || "";
  const ccEmails = (body.ccEmails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const htmlInner = messageHtml
    ? messageHtml
    : message
      ? messageParagraphsToHtml(message)
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
      toEmail: to,
      toName: body.toName,
      subject,
      htmlContent: html,
      textContent: bodyText,
      tags: ["inbox-reply"],
      ccEmails,
      attachments: attachments.map((file) => ({
        name: file.fileName,
        content: file.base64,
      })),
    });
    providerMessageId = sent.messageId;
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Could not send reply",
      code: "send_failed",
    });
  }

  const actor = actorFromClaims(await getSessionClaims());

  let reply = null;
  if (missingSupabaseEnv().length === 0) {
    try {
      reply = await saveMailReply({
        toEmail: to,
        toName: body.toName,
        subject,
        bodyText,
        bodyHtml: messageHtml,
        ccEmails,
        relatedMailId: body.relatedMailId,
        relatedInquiryId: body.relatedInquiryId,
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
        bodyHtml: messageHtml,
        ccEmails,
        relatedMailId: body.relatedMailId ?? null,
        relatedInquiryId: body.relatedInquiryId ?? null,
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
  }

  if (stagedIds.length) {
    await deleteStagedFiles(stagedIds).catch(() => undefined);
  }

  return Response.json({ ok: true, subject, reply });
}
