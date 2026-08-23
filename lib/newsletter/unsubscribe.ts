import { CRM_LOGIN_SESSION_SECRET } from "@/lib/auth-credentials";

function secret() {
  return process.env.CRM_SESSION_SECRET?.trim() || CRM_LOGIN_SESSION_SECRET;
}

function toBase64Url(bytes: ArrayBuffer) {
  const arr = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
}

export async function unsubscribeLink(origin: string, email: string) {
  const clean = email.trim().toLowerCase();
  const sig = await sign(clean);
  const url = new URL("/api/newsletter/unsubscribe", origin);
  url.searchParams.set("email", clean);
  url.searchParams.set("sig", sig);
  return url.toString();
}

export async function verifyUnsubscribeToken(email: string, sig: string) {
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@") || !sig) return false;
  const expected = await sign(clean);
  const a = fromBase64Url(expected);
  const b = fromBase64Url(sig);
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i]! ^ b[i]!;
  return out === 0;
}
