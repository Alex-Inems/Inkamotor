import { jsonError } from "@/lib/api";
import { missingBrevoEnv, sendTransactionalEmail } from "@/lib/brevo";
import { invoiceCompany } from "@/lib/invoice-company";

export const dynamic = "force-dynamic";

type Body = {
  toEmail?: string;
  toName?: string;
  number?: string;
  subject?: string;
  htmlContent?: string;
  totalLabel?: string;
};

export async function POST(request: Request) {
  const missing = missingBrevoEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add BREVO_API_KEY and BREVO_SENDER_EMAIL to .env.local to email invoices.",
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

  const to = body.toEmail?.trim();
  const number = body.number?.trim();
  if (!to || !number) {
    return jsonError(400, {
      error: "toEmail and number are required",
      code: "send_failed",
    });
  }

  const subject =
    body.subject?.trim() ||
    `Invoice ${number} from ${invoiceCompany.name}`;

  const html =
    body.htmlContent?.trim() ||
    `<div style="font-family:Georgia,serif;color:#1c1b19">
      <p>Hello${body.toName ? ` ${body.toName}` : ""},</p>
      <p>Please find invoice <strong>${number}</strong>${
        body.totalLabel ? ` (${body.totalLabel})` : ""
      } from ${invoiceCompany.name}.</p>
      <p>${invoiceCompany.paymentNote}</p>
      <p>Open the CRM for the PDF preview, or reply to this email with any questions.</p>
      <p>— ${invoiceCompany.name}<br/>${invoiceCompany.email}<br/>${invoiceCompany.phone}</p>
    </div>`;

  try {
    await sendTransactionalEmail({
      toEmail: to,
      toName: body.toName,
      subject,
      htmlContent: html,
    });
    return Response.json({
      ok: true,
      queued: true,
      to,
      hint: "Brevo accepted the message. Delivery still needs a verified sender — check spam if it does not arrive.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send invoice email";
    return jsonError(502, { error: message, code: "send_failed" });
  }
}
