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

export function formatLastLogin(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: currentUser.timezone,
  }).format(new Date(iso));
}
