import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { missingEnv } from "@/lib/api";
import { getSupabase } from "@/lib/supabase/server";

const IMAP_KEYS = ["IMAP_HOST", "IMAP_USER", "IMAP_PASSWORD"] as const;

export type MailMessage = {
  id: string;
  messageId: string | null;
  fromName: string | null;
  fromEmail: string;
  toEmail: string | null;
  subject: string;
  preview: string;
  bodyText: string | null;
  receivedAt: string;
  isRead: boolean;
};

export function missingImapEnv(): string[] {
  return missingEnv(IMAP_KEYS);
}

function mapRow(row: Record<string, unknown>): MailMessage {
  return {
    id: String(row.id),
    messageId: (row.message_id as string) || null,
    fromName: (row.from_name as string) || null,
    fromEmail: String(row.from_email),
    toEmail: (row.to_email as string) || null,
    subject: String(row.subject ?? ""),
    preview: String(row.preview ?? ""),
    bodyText: (row.body_text as string) || null,
    receivedAt: String(row.received_at),
    isRead: Boolean(row.is_read),
  };
}

export async function listMailMessages(limit = 50): Promise<MailMessage[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mail_messages")
    .select(
      "id, message_id, from_name, from_email, to_email, subject, preview, body_text, received_at, is_read",
    )
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function syncImapInbox(limit = 40): Promise<{ synced: number }> {
  const host = process.env.IMAP_HOST!.trim();
  const port = Number(process.env.IMAP_PORT?.trim() || "993");
  const user = process.env.IMAP_USER!.trim();
  const pass = process.env.IMAP_PASSWORD!.trim();

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const startedAt = new Date().toISOString();
  let synced = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total = client.mailbox && typeof client.mailbox === "object"
        ? Number((client.mailbox as { exists?: number }).exists ?? 0)
        : 0;
      if (total === 0) {
        await logSync("ok", 0, null, startedAt);
        return { synced: 0 };
      }

      const start = Math.max(1, total - limit + 1);
      const range = `${start}:*`;
      const supabase = getSupabase();

      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        source: true,
        flags: true,
      })) {
        const parsed = msg.source
          ? await simpleParser(msg.source)
          : null;
        const from = msg.envelope?.from?.[0];
        const to = msg.envelope?.to?.[0];
        const fromEmail =
          from?.address ||
          parsed?.from?.value?.[0]?.address ||
          "unknown@unknown";
        const subject =
          msg.envelope?.subject || parsed?.subject || "(no subject)";
        const text =
          typeof parsed?.text === "string"
            ? parsed.text
            : parsed?.textAsHtml
              ? String(parsed.textAsHtml).replace(/<[^>]+>/g, " ")
              : "";
        const preview = text.replace(/\s+/g, " ").trim().slice(0, 240);
        const messageId =
          msg.envelope?.messageId ||
          parsed?.messageId ||
          `uid-${msg.uid}`;
        const receivedAt =
          (msg.envelope?.date || parsed?.date || new Date()).toISOString();

        const { error } = await supabase.from("mail_messages").upsert(
          {
            message_id: messageId,
            folder: "INBOX",
            from_name: from?.name || parsed?.from?.value?.[0]?.name || null,
            from_email: fromEmail,
            to_email: to?.address || user,
            subject,
            preview,
            body_text: text.slice(0, 20000),
            received_at: receivedAt,
            is_read: Boolean(msg.flags?.has("\\Seen")),
            synced_at: new Date().toISOString(),
          },
          { onConflict: "message_id" },
        );
        if (!error) synced += 1;
      }
    } finally {
      lock.release();
    }
    await client.logout();
    await logSync("ok", synced, null, startedAt);
    return { synced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "IMAP sync failed";
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    await logSync("error", synced, message, startedAt);
    throw err;
  }
}

async function logSync(
  status: "ok" | "error",
  rowCount: number,
  error: string | null,
  startedAt: string,
) {
  try {
    const supabase = getSupabase();
    await supabase.from("sync_runs").insert({
      source: "imap",
      status,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      row_count: rowCount,
      error,
    });
  } catch {
    /* ignore logging failure */
  }
}
