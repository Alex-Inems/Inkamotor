import {
  CRM_LOGIN_EMAIL,
  CRM_LOGIN_PASSWORD,
  CRM_LOGIN_SESSION_SECRET,
} from "@/lib/auth-credentials";

export const SESSION_COOKIE = "inkamoto_crm_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function missingAuthEnv(): string[] {
  // Hardcoded credentials always satisfy auth; optional env overrides remain.
  return [];
}

export function authConfigured() {
  return true;
}

function sessionSecret() {
  return (
    process.env.CRM_SESSION_SECRET?.trim() || CRM_LOGIN_SESSION_SECRET
  );
}

function expectedPassword() {
  return process.env.CRM_ACCESS_PASSWORD?.trim() || CRM_LOGIN_PASSWORD;
}

function expectedEmail() {
  return (
    process.env.CRM_ACCESS_EMAIL?.trim().toLowerCase() ||
    CRM_LOGIN_EMAIL.toLowerCase()
  );
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(sig);
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i]! ^ b[i]!;
  return out === 0;
}

function timingSafeEqualString(a: string, b: string) {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  return timingSafeEqualBytes(aa, bb);
}

export async function createSessionToken(now = Date.now()) {
  const secret = sessionSecret();
  const exp = String(now + SESSION_TTL_MS);
  const payload = `v1.${exp}`;
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null) {
  if (!token) return false;
  const secret = sessionSecret();
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [, exp, sig] = parts;
  if (!exp || !sig) return false;
  const payload = `v1.${exp}`;
  const expected = await hmacSign(secret, payload);
  try {
    const a = fromBase64Url(sig);
    const b = fromBase64Url(expected);
    if (!timingSafeEqualBytes(a, b)) return false;
  } catch {
    return false;
  }
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
  return true;
}

export function credentialsMatch(email: string, password: string) {
  const emailOk = timingSafeEqualString(
    email.trim().toLowerCase(),
    expectedEmail(),
  );
  const passOk = timingSafeEqualString(password, expectedPassword());
  return emailOk && passOk;
}

/** @deprecated use credentialsMatch */
export function passwordMatches(input: string) {
  return timingSafeEqualString(input, expectedPassword());
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export { CRM_LOGIN_EMAIL };
