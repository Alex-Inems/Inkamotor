import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function missingSupabaseEnv(): string[] {
  return (["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const).filter(
    (key) => !process.env[key]?.trim(),
  );
}

export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
