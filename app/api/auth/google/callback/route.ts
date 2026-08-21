import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth";
import {
  GOOGLE_LOGIN_NEXT_COOKIE,
  GOOGLE_LOGIN_STATE_COOKIE,
  googleLoginRedirectUri,
  googleLoginUser,
  safeNextPath,
} from "@/lib/auth-google";
import { crmUsersReady, upsertGoogleCrmUser } from "@/lib/crm/users";

export const dynamic = "force-dynamic";

function clearLoginCookies(res: NextResponse) {
  const gone = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  res.cookies.set(GOOGLE_LOGIN_STATE_COOKIE, "", gone);
  res.cookies.set(GOOGLE_LOGIN_NEXT_COOKIE, "", gone);
}

function fail(request: NextRequest, code = "google") {
  const login = new URL("/login", request.nextUrl.origin);
  login.searchParams.set("error", code);
  const res = NextResponse.redirect(login);
  clearLoginCookies(res);
  return res;
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get(GOOGLE_LOGIN_STATE_COOKIE)?.value;
  const next = safeNextPath(request.cookies.get(GOOGLE_LOGIN_NEXT_COOKIE)?.value);

  if (error) return fail(request);
  if (!code || !state || !expected || state !== expected) {
    return fail(request);
  }

  try {
    const claims = await googleLoginUser(
      code,
      googleLoginRedirectUri(request.nextUrl.origin),
    );
    if (crmUsersReady()) {
      try {
        await upsertGoogleCrmUser(claims);
      } catch {
        /* crm_users table may not exist yet */
      }
    }
    const token = await createSessionToken(claims);
    const dest = new URL(next, request.nextUrl.origin);
    const res = NextResponse.redirect(dest);
    const cookie = sessionCookieOptions(token);
    res.cookies.set(cookie.name, cookie.value, cookie);
    clearLoginCookies(res);
    return res;
  } catch {
    return fail(request);
  }
}
