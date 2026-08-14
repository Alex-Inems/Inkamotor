import { getFeatureStates } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Client-safe feature flags (no secret values). */
export async function GET() {
  const features = getFeatureStates();
  const byId = Object.fromEntries(features.map((f) => [f.id, f]));

  return Response.json({
    features: byId,
    /** Always hide Google / Meta routes — no env required for those. */
    hiddenNav: ["/search-console", "/analytics", "/ads/meta"],
    hint: "Google + Meta are paused. Only Supabase / Brevo / IMAP / webhook are checked.",
  });
}
