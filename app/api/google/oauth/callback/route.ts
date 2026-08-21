import { NextRequest, NextResponse } from "next/server";
import {
  GSC_OAUTH_STATE_COOKIE,
  exchangeGoogleCode,
  googleRedirectUri,
} from "@/lib/ads/google-oauth";

export const dynamic = "force-dynamic";

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #f4f1ea; color: #1c1916; margin: 0; padding: 2rem 1rem; }
    .card { max-width: 40rem; margin: 0 auto; background: #fff; border: 1px solid #d9d2c5; padding: 1.5rem; }
    h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
    p { color: #5c564c; font-size: 0.95rem; line-height: 1.5; }
    textarea { width: 100%; min-height: 6rem; margin-top: 0.75rem; padding: 0.75rem; font-family: ui-monospace, monospace; font-size: 0.8rem; }
    a { color: #7a1f2b; }
    code { font-size: 0.85em; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Exchanges the Google auth code and shows the refresh token once. */
export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get(GSC_OAUTH_STATE_COOKIE)?.value;

  const fail = (message: string, status = 400) => {
    const res = new NextResponse(
      htmlPage(
        "Google connect failed",
        `<h1>Could not connect Google</h1><p>${escapeHtml(message)}</p><p><a href="/setup">Back to Setup</a></p>`,
      ),
      { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
    res.cookies.delete(GSC_OAUTH_STATE_COOKIE);
    return res;
  };

  if (error) {
    return fail(error);
  }
  if (!code || !state || !expected || state !== expected) {
    return fail("Invalid or expired Google sign-in. Start again from Setup.");
  }

  try {
    const tokens = await exchangeGoogleCode({
      code,
      redirectUri: googleRedirectUri(request.nextUrl.origin),
    });
    const refresh = tokens.refresh_token?.trim();
    if (!refresh) {
      return fail(
        "Google did not return a refresh token. Revoke Inkamoto CRM in Google Account → Security → Third-party access, then connect again.",
      );
    }

    const res = new NextResponse(
      htmlPage(
        "Google connected",
        `<h1>Copy this refresh token</h1>
<p>Paste it into <code>.env.local</code> as <code>GOOGLE_REFRESH_TOKEN</code>, save, then restart the CRM.</p>
<textarea readonly>${escapeHtml(refresh)}</textarea>
<p style="margin-top:1rem"><a href="/search-console">Open Search Console</a> · <a href="/setup">Back to Setup</a></p>`,
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
    res.cookies.delete(GSC_OAUTH_STATE_COOKIE);
    return res;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Google token exchange failed", 502);
  }
}
