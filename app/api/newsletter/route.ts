import { jsonError } from "@/lib/api";
import { listBrevoCampaigns, mapBrevoCampaign, missingBrevoEnv } from "@/lib/brevo";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = missingBrevoEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Add BREVO_API_KEY and BREVO_SENDER_EMAIL to .env.local, then restart.",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const campaigns = await listBrevoCampaigns();
    return Response.json({
      campaigns: campaigns.map(mapBrevoCampaign),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load campaigns";
    return jsonError(502, { error: message, code: "sync_failed" });
  }
}
