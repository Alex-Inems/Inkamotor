import { NextResponse } from "next/server";
import { loadSearchConsole, missingGoogleEnv } from "@/lib/ads/search-console";
import type { ApiErrorBody } from "@/lib/ads/gsc-types";

export const dynamic = "force-dynamic";

export async function POST() {
  const missing = missingGoogleEnv();
  if (missing.length > 0) {
    const body: ApiErrorBody = {
      error:
        "Add Google Search Console tokens to .env.local, then restart the dev server.",
      code: "missing_credentials",
      missing,
    };
    return NextResponse.json(body, { status: 503 });
  }

  try {
    const payload = await loadSearchConsole(true);
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Search Console refresh failed";
    const body: ApiErrorBody = { error: message, code: "sync_failed" };
    return NextResponse.json(body, { status: 502 });
  }
}
