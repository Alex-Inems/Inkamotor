import { getSupabase, missingSupabaseEnv } from "@/lib/supabase/server";
import type { SessionClaims } from "@/lib/session";

export type CrmUserRow = {
  email: string;
  name: string;
  picture: string | null;
  password_hash: string | null;
  google: boolean;
};

export function crmUsersReady() {
  return missingSupabaseEnv().length === 0;
}

function asUser(row: CrmUserRow): SessionClaims {
  const picture = row.picture?.trim();
  return picture
    ? { email: row.email, name: row.name || row.email, picture }
    : { email: row.email, name: row.name || row.email };
}

export async function findCrmUser(email: string) {
  const { data, error } = await getSupabase()
    .from("crm_users")
    .select("email, name, picture, password_hash, google")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CrmUserRow | null) ?? null;
}

export async function createCrmUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}) {
  const { data, error } = await getSupabase()
    .from("crm_users")
    .insert({
      email: input.email,
      name: input.name,
      password_hash: input.passwordHash,
      google: false,
      last_login_at: new Date().toISOString(),
    })
    .select("email, name, picture, password_hash, google")
    .single();
  if (error) throw new Error(error.message);
  return asUser(data as CrmUserRow);
}

export async function touchCrmUserLogin(email: string) {
  await getSupabase()
    .from("crm_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("email", email);
}

export async function upsertGoogleCrmUser(claims: SessionClaims) {
  const existing = await findCrmUser(claims.email);
  const row = {
    email: claims.email,
    name: claims.name,
    picture: claims.picture ?? null,
    google: true,
    last_login_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await getSupabase()
      .from("crm_users")
      .update({
        name: row.name,
        picture: row.picture,
        google: true,
        last_login_at: row.last_login_at,
      })
      .eq("email", claims.email);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await getSupabase().from("crm_users").insert({
    ...row,
    password_hash: null,
  });
  if (error) throw new Error(error.message);
}

export function claimsFromCrmUser(row: CrmUserRow): SessionClaims {
  return asUser(row);
}
