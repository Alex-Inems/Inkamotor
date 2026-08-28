import { sendTransactionalEmail } from "@/lib/brevo";
import { type Sale } from "@/lib/demo-data";
import { type Locale } from "@/lib/i18n";
import { saveReplyAttachment } from "@/lib/mail/attachments";
import {
  quoteEmailBodyText,
  quoteEmailHtml,
  quoteEmailSubject,
  quotePdfFileName,
} from "@/lib/mail/quote-email-copy";
import { saveMailReply } from "@/lib/mail/replies";
import { buildQuotePdfBase64 } from "@/lib/quote-pdf";
import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";

async function findRelatedMailId(clientEmail: string): Promise<string | null> {
  if (missingSupabaseEnv().length > 0) return null;
  const email = clientEmail.trim().toLowerCase();
  const supabase = getSupabase();
  const { data } = await supabase
    .from("mail_messages")
    .select("message_id")
    .or(`from_email.eq.${email},to_email.eq.${email}`)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.message_id ? String(data.message_id) : null;
}

export async function sendSaleQuoteEmail(input: {
  sale: Sale;
  locale: Locale;
  relatedInquiryId?: string | null;
}) {
  const { sale, locale } = input;
  const to = sale.email.trim();
  if (!to || !to.includes("@")) {
    throw new Error("Client email is required to send a quotation.");
  }

  const pdfBase64 = await buildQuotePdfBase64(sale, locale);
  const subject = quoteEmailSubject(sale, locale);
  const bodyText = quoteEmailBodyText(sale, locale);
  const htmlContent = quoteEmailHtml(sale, locale);
  const relatedMailId = (await findRelatedMailId(to)) ?? undefined;

  await sendTransactionalEmail({
    toEmail: to,
    toName: sale.customer,
    subject,
    htmlContent,
    textContent: `${bodyText}\n\n— Inkamoto Tours`,
    tags: ["quotation", sale.number],
    attachments: [
      {
        name: quotePdfFileName(sale),
        content: pdfBase64,
      },
    ],
  });

  const reply = await saveMailReply({
    toEmail: to,
    toName: sale.customer,
    subject,
    bodyText,
    relatedMailId,
    relatedInquiryId: input.relatedInquiryId ?? null,
  });

  await saveReplyAttachment({
    replyId: reply.id,
    fileName: quotePdfFileName(sale),
    mimeType: "application/pdf",
    base64: pdfBase64,
  });

  return { to, subject, replyId: reply.id };
}
