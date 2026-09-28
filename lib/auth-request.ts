import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth";
import type { SessionClaims } from "@/lib/session";

/** Read the signed session claims for the current request (API routes / RSC). */
export async function getSessionClaims(): Promise<SessionClaims | null> {
  try {
    const jar = await cookies();
    return readSessionToken(jar.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}
