import { getFeatureStates } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Client-safe feature flags (no secret values). */
export async function GET() {
  const features = getFeatureStates();
  const byId = Object.fromEntries(features.map((f) => [f.id, f]));

  return Response.json({
    features: byId,
    /** Routes to hide from nav while paused / missing env */
    hiddenNav: [
      ...(byId.googleSearchConsole?.paused
        ? ["/search-console", "/analytics"]
        : []),
      ...(byId.metaAds?.paused ? ["/ads/meta"] : []),
    ],
    hint: "Paused features stay hidden until their env vars are filled.",
  });
}
