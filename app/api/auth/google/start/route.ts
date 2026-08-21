import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { missingGoogleOAuthEnv } from "@/lib/ads/google-oauth";
import {
  GOOGLE_LOGIN_NEXT_COOKIE,
  GOOGLE_LOGIN_STATE_COOKIE,
  googleLoginAuthUrl,
  googleLoginRedirectUri,
  safeNextPath,
} from "@/lib/auth-google";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const login = new URL("/login", request.nextUrl.origin);
  if (missingGoogleOAuthEnv().length > 0) {
    login.searchParams.set("error", "google_setup");
    return NextResponse.redirect(login);
  }

  const state = randomBytes(16).toString("hex");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const redirectUri = googleLoginRedirectUri(request.nextUrl.origin);
  const url = googleLoginAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirectUri,
    state,
  });

  const secure = request.nextUrl.protocol === "https:";
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_LOGIN_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  res.cookies.set(GOOGLE_LOGIN_NEXT_COOKIE, next, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  return res;
}
