import { missingEnv } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Shows which live integrations are configured (no secret values). */
export async function GET() {
  const checks = {
    auth: [] as string[],
    supabase: missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]),
    googleSearchConsole: missingEnv([
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REFRESH_TOKEN",
      "GSC_SITE_URL",
    ]),
    brevo: missingEnv([
      "BREVO_API_KEY",
      "BREVO_SENDER_EMAIL",
      "BREVO_SENDER_NAME",
      "BREVO_LIST_ID",
    ]),
    imap: missingEnv([
      "IMAP_HOST",
      "IMAP_PORT",
      "IMAP_USER",
      "IMAP_PASSWORD",
    ]),
    webhook: missingEnv(["WEBHOOK_SECRET"]),
  };

  const status = Object.fromEntries(
    Object.entries(checks).map(([key, missing]) => [
      key,
      { ready: missing.length === 0, missing },
    ]),
  );

  return Response.json({
    status,
    hint: "Login is hardcoded. Fill Supabase + integrations in .env.local, run supabase/schema.sql, restart.",
  });
}
