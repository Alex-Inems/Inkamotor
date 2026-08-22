import { jsonError } from "@/lib/api";
import { localeFromRequest } from "@/lib/i18n/request-locale";
import { listUnreadInbox } from "@/lib/mail/imap";
import { translateTexts } from "@/lib/mail/translate";
import { missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type InboxNotification = {
  id: string;
  fromName: string | null;
  fromEmail: string;
  subject: string;
  preview: string;
  receivedAt: string;
};

export async function GET(req: Request) {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return Response.json({ unread: 0, items: [] as InboxNotification[] });
  }

  try {
    const locale = localeFromRequest(req);
    const { unread, messages } = await listUnreadInbox(12);
    const blobs = messages.flatMap((m) => [m.subject, m.preview]);
    let subjects = messages.map((m) => m.subject);
    let previews = messages.map((m) => m.preview);
    if (blobs.some((text) => text.trim())) {
      try {
        const { values } = await translateTexts(blobs, locale);
        subjects = messages.map((m, i) => values[i * 2] || m.subject);
        previews = messages.map((m, i) => values[i * 2 + 1] || m.preview);
      } catch {
        /* show original copy if translation is down */
      }
    }

    const items: InboxNotification[] = messages.map((m, i) => ({
      id: m.id,
      fromName: m.fromName,
      fromEmail: m.fromEmail,
      subject: subjects[i] ?? m.subject,
      preview: previews[i] ?? m.preview,
      receivedAt: m.receivedAt,
    }));

    return Response.json({ unread, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load notifications";
    return jsonError(500, { error: message, code: "db_error" });
  }
}
