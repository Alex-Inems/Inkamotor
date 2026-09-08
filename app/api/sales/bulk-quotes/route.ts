import { jsonError } from "@/lib/api";
import { missingBrevoEnv } from "@/lib/brevo";
import type { SaleLine } from "@/lib/demo-data";
import { localeFromRequest } from "@/lib/i18n/request-locale";
import {
  createAndSendBulkQuoteBatch,
  findQuoteTemplate,
  previewBulkQuoteRecipients,
} from "@/lib/sales/bulk-quotes";
import { BULK_QUOTE_BATCH } from "@/lib/sales/bulk-quote-constants";
import { SEED_QUOTE_TEMPLATES } from "@/lib/quote-templates";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  action?: "preview" | "send";
  tag?: string;
  leadIds?: string[];
  product?: string;
  amount?: number;
  quoteTemplateName?: string;
  trip?: string;
  voyageLabel?: string;
  lines?: SaleLine[];
  termsHtml?: string;
  paymentTerms?: string;
  validityDate?: string;
  message?: string;
  skipExisting?: boolean;
};

export async function GET() {
  return Response.json({
    templates: SEED_QUOTE_TEMPLATES.map((row) => ({
      id: row.id,
      name: row.name,
      numberOfDays: row.numberOfDays,
    })),
    batchSize: BULK_QUOTE_BATCH,
  });
}

export async function POST(request: Request) {
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
    return jsonError(400, { error: "Invalid JSON", code: "send_failed" });
  }

  const action = body.action === "send" ? "send" : "preview";
  const tag = body.tag?.trim() ?? "";
  if (!tag) {
    return jsonError(400, { error: "tag is required", code: "send_failed" });
  }

  if (action === "preview") {
    try {
      const preview = await previewBulkQuoteRecipients(tag);
      return Response.json({
        ...preview,
        templates: SEED_QUOTE_TEMPLATES.map((row) => ({
          id: row.id,
          name: row.name,
        })),
        defaultTemplate: findQuoteTemplate().name,
        batchSize: BULK_QUOTE_BATCH,
      });
    } catch (err) {
      return jsonError(502, {
        error: err instanceof Error ? err.message : "Could not preview recipients",
        code: "db_error",
      });
    }
  }

  const brevoMissing = missingBrevoEnv();
  if (brevoMissing.length > 0) {
    return jsonError(503, {
      error:
        "Add BREVO_API_KEY and BREVO_SENDER_EMAIL to .env.local to email quotations.",
      code: "missing_credentials",
      missing: brevoMissing,
    });
  }

  const leadIds = [...new Set((body.leadIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (leadIds.length === 0) {
    return jsonError(400, {
      error: "leadIds are required for send",
      code: "send_failed",
    });
  }
  if (leadIds.length > BULK_QUOTE_BATCH) {
    return jsonError(400, {
      error: `Send at most ${BULK_QUOTE_BATCH} quotations per request`,
      code: "send_failed",
    });
  }

  const product = body.product?.trim() ?? "";
  const amount = Number(body.amount);
  const hasLines = Array.isArray(body.lines) && body.lines.length > 0;
  if (!product && !hasLines) {
    return jsonError(400, {
      error: "product or lines are required",
      code: "send_failed",
    });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return jsonError(400, {
      error: "amount must be a number ≥ 0",
      code: "send_failed",
    });
  }

  const locale = localeFromRequest(request);

  try {
    const { results } = await createAndSendBulkQuoteBatch({
      leadIds,
      product: product || "Circuit moto Inkamoto",
      amount,
      quoteTemplateName: body.quoteTemplateName,
      trip: body.trip,
      voyageLabel: body.voyageLabel,
      lines: body.lines,
      termsHtml: body.termsHtml,
      paymentTerms: body.paymentTerms,
      validityDate: body.validityDate,
      message: body.message,
      skipExisting: body.skipExisting !== false,
      locale,
    });
    return Response.json({
      ok: true,
      results,
      sent: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok && !row.skipped).length,
      skipped: results.filter((row) => row.skipped).length,
    });
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Bulk quotation failed",
      code: "send_failed",
    });
  }
}
