import { googleHttps } from "@/lib/ads/google-http";
import { exchangeGoogleCode } from "@/lib/ads/google-oauth";
import type { SessionClaims } from "@/lib/session";

export const GOOGLE_LOGIN_STATE_COOKIE = "glogin_oauth_state";
export const GOOGLE_LOGIN_NEXT_COOKIE = "glogin_next";
export const GOOGLE_LOGIN_SCOPE = "openid email profile";

export function googleLoginRedirectUri(origin: string) {
  const explicit = process.env.GOOGLE_LOGIN_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function googleLoginAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_LOGIN_SCOPE,
    state: input.state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function safeNextPath(raw: string | null | undefined) {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/";
  }
  if (raw.startsWith("/login") || raw.startsWith("/api/")) return "/";
  return raw;
}

export async function googleLoginUser(
  code: string,
  redirectUri: string,
): Promise<SessionClaims> {
  const tokens = await exchangeGoogleCode({ code, redirectUri });
  const access = tokens.access_token?.trim();
  if (!access) throw new Error("Google did not return an access token");

  const { status, text } = await googleHttps({
    hostname: "www.googleapis.com",
    path: "/oauth2/v3/userinfo",
    headers: { Authorization: `Bearer ${access}` },
  });

  let json: {
    email?: string;
    name?: string;
    given_name?: string;
    picture?: string;
    error?: string;
  };
  try {
    json = text.trim() ? (JSON.parse(text) as typeof json) : {};
  } catch {
    json = {};
  }

  if (status >= 400 || json.error) {
    throw new Error("Could not read the Google account");
  }

  const email = json.email?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    throw new Error("Google did not share an email address");
  }

  const name = (json.name?.trim() || json.given_name?.trim() || email.split("@")[0] || email).slice(
    0,
    80,
  );
  const picture = json.picture?.trim();
  return picture ? { email, name, picture } : { email, name };
}
