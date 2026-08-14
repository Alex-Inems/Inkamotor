import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/lib/ads/gsc-types";

export const dynamic = "force-dynamic";

/**
 * Google Search Console sync — PAUSED.
 * Does not read GOOGLE_* env.
 */
export async function POST() {
  // const { loadSearchConsole, missingGoogleEnv } = await import("@/lib/ads/search-console");
  // const missing = missingGoogleEnv();
  // if (missing.length > 0) { ... }
  // const payload = await loadSearchConsole(true);
  // return NextResponse.json(payload);

  const body: ApiErrorBody = {
    error: "Google Search Console is paused (no Google env required).",
    code: "missing_credentials",
    missing: [],
  };
  return NextResponse.json(body, { status: 503 });
}
