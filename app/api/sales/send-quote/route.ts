import { jsonError } from "@/lib/api";
import { missingBrevoEnv } from "@/lib/brevo";
import { applyCrmMutation, getSaleById } from "@/lib/crm/repository";
import { localeFromRequest } from "@/lib/i18n/request-locale";
import { sendSaleQuoteEmail } from "@/lib/mail/send-quote";
import { enrichSale } from "@/lib/sale-quote";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  saleId?: string;
};

export async function POST(request: Request) {
  const brevoMissing = missingBrevoEnv();
  if (brevoMissing.length > 0) {
    return jsonError(503, {
      error:
        "Add BREVO_API_KEY and BREVO_SENDER_EMAIL to .env.local to email quotations.",
      code: "missing_credentials",
      missing: brevoMissing,
    });
  }

  const dbMissing = missingSupabaseEnv();
  if (dbMissing.length > 0) {
    return jsonError(503, {
      error: "Supabase is not configured",
      code: "missing_credentials",
      missing: dbMissing,
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, { error: "Invalid JSON body", code: "send_failed" });
  }

  const saleId = body.saleId?.trim();
  if (!saleId) {
    return jsonError(400, {
      error: "saleId is required",
      code: "send_failed",
    });
  }

  const sale = await getSaleById(saleId);
  if (!sale) {
    return jsonError(404, { error: "Quotation not found", code: "send_failed" });
  }

  const locale = localeFromRequest(request);
  const enriched = enrichSale(sale);

  try {
    const result = await sendSaleQuoteEmail({
      sale: enriched,
      locale,
      relatedInquiryId: sale.inquiryId,
    });

    if (sale.status === "pending") {
      await applyCrmMutation({
        op: "updateSaleStatus",
        id: saleId,
        status: "sent",
      });
    }

    return Response.json({
      ok: true,
      to: result.to,
      subject: result.subject,
      hint: "Quotation emailed with PDF attached. It also appears in Inbox under this client.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not send quotation email";
    return jsonError(502, { error: message, code: "send_failed" });
  }
}
