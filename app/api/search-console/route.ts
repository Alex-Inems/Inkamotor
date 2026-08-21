import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const { loadSearchConsole, missingGoogleEnv } = await import(
    "@/lib/ads/search-console"
  );
  const missing = missingGoogleEnv();
  if (missing.length > 0) {
    return jsonError(503, {
      error: "Google Search Console is not configured yet.",
      code: "missing_credentials",
      missing,
    });
  }

  try {
    const payload = await loadSearchConsole();
    return Response.json(payload);
  } catch (err) {
    return jsonError(502, {
      error: err instanceof Error ? err.message : "Search Console sync failed",
      code: "sync_failed",
    });
  }
}
