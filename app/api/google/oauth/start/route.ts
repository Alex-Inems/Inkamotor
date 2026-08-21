import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  GSC_OAUTH_STATE_COOKIE,
  googleAuthUrl,
  googleRedirectUri,
  missingGoogleOAuthEnv,
} from "@/lib/ads/google-oauth";

export const dynamic = "force-dynamic";

/** Starts Google OAuth (Search Console read-only) and stores CSRF state. */
export async function GET(request: NextRequest) {
  const missing = missingGoogleOAuthEnv();
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error:
          "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first, then connect Google.",
        code: "missing_credentials",
        missing,
      },
      { status: 400 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = googleRedirectUri(request.nextUrl.origin);
  const url = googleAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirectUri,
    state,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(GSC_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 600,
  });
  return res;
}
