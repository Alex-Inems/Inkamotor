import { localeMeta, type Locale } from "@/lib/i18n/config";

export type SessionClaims = {
  email: string;
  name: string;
  picture?: string;
};

export type SessionUser = {
  id: string;
  name: string;
  firstName: string;
  email: string;
  role: string;
  title: string;
  initials: string;
  avatarHue: string;
  timezone: string;
  lastLoginAt: string;
  picture?: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan: "Starter" | "Growth" | "Scale";
  region: string;
};

/** Hardcoded workspace identity */
export const currentUser: SessionUser = {
  id: "usr_inkamoto",
  name: "Inkamoto Team",
  firstName: "Inkamoto",
  email: "contact@inkamototours.com",
  role: "Admin",
  title: "Reservations & operations",
  initials: "IT",
  avatarHue: "#624e8a",
  timezone: "Europe/Brussels",
  lastLoginAt: new Date().toISOString(),
};

export const currentWorkspace: Workspace = {
  id: "ws_inkamoto_01",
  name: "Inkamoto Tours",
  slug: "inkamototours.com",
  plan: "Growth",
  region: "PE · Lima / BE · Brussels",
};

export const notifications: {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}[] = [];

function initialsFrom(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase() || "IT";
}

export function userFromClaims(claims: SessionClaims | null): SessionUser {
  if (!claims) return currentUser;
  const name = claims.name.trim() || claims.email;
  const firstName = name.split(/\s+/)[0] || name;
  return {
    ...currentUser,
    id: `usr_${claims.email}`,
    name,
    firstName,
    email: claims.email,
    initials: initialsFrom(name, claims.email),
    lastLoginAt: new Date().toISOString(),
    picture: claims.picture,
  };
}

export function formatLastLogin(iso: string, locale: Locale = "en") {
  return new Intl.DateTimeFormat(localeMeta[locale].bcp47, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: currentUser.timezone,
  }).format(new Date(iso));
}
