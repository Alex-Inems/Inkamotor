import { jsonError } from "@/lib/api";
import {
  defaultTrendsBrand,
  loadGoogleTrends,
} from "@/lib/ads/google-trends";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const extra = (url.searchParams.get("q") ?? "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);

  try {
    const payload = await loadGoogleTrends(extra);
    return Response.json(payload);
  } catch (err) {
    return jsonError(502, {
      error:
        err instanceof Error
          ? err.message
          : `Could not load search interest for ${defaultTrendsBrand()}`,
      code: "sync_failed",
    });
  }
}
