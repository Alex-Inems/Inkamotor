import { jsonError } from "@/lib/api";
import { missingBrevoEnv, sendTransactionalEmail } from "@/lib/brevo";
import { missingImapEnv } from "@/lib/mail/imap";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Connection status for Site inbox (no secrets). */
export async function GET() {
  const supabaseMissing = missingSupabaseEnv();
  const imapMissing = missingImapEnv();
  const brevoMissing = missingBrevoEnv();

  return Response.json({
    namecheap: {
      ready: imapMissing.length === 0,
      missing: imapMissing,
      host: process.env.IMAP_HOST?.trim() || "mail.privateemail.com",
      user: process.env.IMAP_USER?.trim() || "contact@inkamototours.com",
      role: "Receive mail (IMAP sync into CRM)",
    },
    brevo: {
      ready: brevoMissing.length === 0,
      missing: brevoMissing,
      sender: process.env.BREVO_SENDER_EMAIL?.trim() || null,
      role: "Send replies & notifications from CRM",
    },
    supabase: {
      ready: supabaseMissing.length === 0,
      missing: supabaseMissing,
      role: "Store synced mail + site form inquiries",
    },
  });
}
