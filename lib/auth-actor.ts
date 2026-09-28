import type { SessionClaims } from "@/lib/session";

/** Fields stamped onto outbound mail / CRM rows for who acted. */
export type ActorAttribution = {
  email: string;
  name: string;
  /** Short label for salesperson fields (e.g. "Jorge"). */
  firstName: string;
};

const GENERIC_NAMES = new Set([
  "",
  "team",
  "jorge",
  "jorge inkamoto",
  "inkamoto",
  "inkamoto team",
  "inkamoto tours",
]);

/** Client-facing brand — never replace this with a personal login name. */
export const COMPANY_BRAND_NAME = "Inkamoto Tours";

export function isGenericActorName(value: string | null | undefined) {
  return GENERIC_NAMES.has((value ?? "").trim().toLowerCase());
}

export function actorFromClaims(
  claims: SessionClaims | null | undefined,
): ActorAttribution | null {
  if (!claims?.email) return null;
  const email = claims.email.trim().toLowerCase();
  if (!email.includes("@")) return null;
  const name = (claims.name.trim() || email).slice(0, 120);
  const firstName = (name.split(/\s+/)[0] || name).slice(0, 80);
  return { email, name, firstName };
}

/** Prefer an explicit value; otherwise use the logged-in user; else fallback. */
export function resolveActorName(
  explicit: string | null | undefined,
  actor: ActorAttribution | null | undefined,
  fallback = "Team",
) {
  if (!isGenericActorName(explicit)) return explicit!.trim();
  if (actor?.name) return actor.name;
  return fallback;
}

/** Salesperson / seller: session first name (e.g. Jorge), not the company brand. */
export function resolveSalespersonName(
  explicit: string | null | undefined,
  actor: ActorAttribution | null | undefined,
  fallback = "Jorge",
) {
  if (!isGenericActorName(explicit)) return explicit!.trim();
  if (actor?.firstName) return actor.firstName;
  if (actor?.name) return actor.name;
  return fallback;
}
