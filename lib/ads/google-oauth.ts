import { googleHttps } from "@/lib/ads/google-http";
import { missingEnv } from "@/lib/api";

export const GSC_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";
export const GSC_OAUTH_STATE_COOKIE = "gsc_oauth_state";

const OAUTH_CLIENT_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;

export function missingGoogleOAuthEnv(): string[] {
  return missingEnv(OAUTH_CLIENT_KEYS);
}

export function googleRedirectUri(origin: string) {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${origin.replace(/\/$/, "")}/api/google/oauth/callback`;
}

export function googleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GSC_OAUTH_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(input: {
  code: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
  }).toString();

  const { status, text } = await googleHttps({
    hostname: "oauth2.googleapis.com",
    path: "/token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = parseJson(text) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (status >= 400 || json.error) {
    throw new Error(
      json.error_description || json.error || `Google OAuth failed (${status})`,
    );
  }

  return json;
}

function parseJson(text: string): unknown {
  try {
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}
