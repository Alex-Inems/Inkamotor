import { getFeatureStates } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Client-safe feature flags (no secret values). */
export async function GET() {
  const features = getFeatureStates();
  const byId = Object.fromEntries(features.map((f) => [f.id, f]));

  return Response.json({
    features: byId,
    hiddenNav: ["/ads/meta"],
    hint: "Meta Ads stays paused. Search Console is live once Google env is set.",
  });
}
