import { sendTransactionalEmail } from "@/lib/brevo";
import { type Sale } from "@/lib/demo-data";
import { type Locale } from "@/lib/i18n";
import { saveReplyAttachment } from "@/lib/mail/attachments";
import {
  quoteEmailBodyText,
  quoteEmailHtmlFromText,
  quoteEmailSubject,
  quotePdfFileName,
} from "@/lib/mail/quote-email-copy";
import { saveMailReply } from "@/lib/mail/replies";
import { buildQuotePdfBase64 } from "@/lib/quote-pdf";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

async function findRelatedMailId(clientEmail: string): Promise<string | null> {
  if (missingSupabaseEnv().length > 0) return null;
  const email = clientEmail.trim().toLowerCase();
  if (!email.includes("@")) return null;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("mail_messages")
    .select("id")
    .or(`from_email.ilike."${email}",to_email.ilike."${email}"`)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

function brevoSafeTag(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function sendSaleQuoteEmail(input: {
  sale: Sale;
  locale: Locale;
  relatedInquiryId?: string | null;
  message?: string | null;
}) {
  const { sale, locale } = input;
  const to = sale.email.trim();
  if (!to || !to.includes("@")) {
    throw new Error("Client email is required to send a quotation.");
  }

  const pdfBase64 = await buildQuotePdfBase64(sale, locale);
  const subject = quoteEmailSubject(sale, locale);
  const bodyText =
    input.message?.trim() || quoteEmailBodyText(sale, locale);
  const htmlContent = quoteEmailHtmlFromText(bodyText, locale);
  const relatedMailId = (await findRelatedMailId(to)) ?? undefined;
  const saleTag = brevoSafeTag(sale.number);

  const { messageId } = await sendTransactionalEmail({
    toEmail: to,
    toName: sale.customer,
    subject,
    htmlContent,
    textContent: `${bodyText}\n\n— Inkamoto Tours`,
    tags: ["quotation", saleTag].filter(Boolean),
    attachments: [
      {
        name: quotePdfFileName(sale),
        content: pdfBase64,
      },
    ],
  });

  // Email already accepted by Brevo — persist history best-effort so a DB
  // migration gap does not surface as a failed send.
  let replyId: string | null = null;
  try {
    const reply = await saveMailReply({
      toEmail: to,
      toName: sale.customer,
      subject,
      bodyText,
      relatedMailId,
      relatedInquiryId: input.relatedInquiryId ?? null,
      providerMessageId: messageId,
      deliveryStatus: "sent",
    });
    replyId = reply.id;

    const saved = await saveReplyAttachment({
      replyId: reply.id,
      fileName: quotePdfFileName(sale),
      mimeType: "application/pdf",
      base64: pdfBase64,
    });
    if (!saved) {
      console.warn(
        "[send-quote] Quotation emailed but PDF was not saved to Inbox history.",
      );
    }
  } catch (err) {
    console.warn(
      "[send-quote] Quotation emailed but history save failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return { to, subject, replyId };
}
