import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { missingEnv } from "@/lib/api";
import { autoSubscribe } from "@/lib/mail/auto-subscribe";
import { isOwnAddress, messageContact } from "@/lib/mail/extract";
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

export async function listMailMessages(limit = 150): Promise<MailMessage[]> {
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

async function findSentMailbox(client: ImapFlow): Promise<string | null> {
  try {
    const boxes = await client.list();
    const special = boxes.find((b) => b.specialUse === "\\Sent");
    if (special?.path) return special.path;
    const named = boxes.find((b) =>
      /(^|[./])(sent|sent items|sent mail)$/i.test(b.path),
    );
    return named?.path ?? null;
  } catch {
    return null;
  }
}

async function fetchFolder(
  client: ImapFlow,
  folder: string,
  user: string,
  limit: number,
  collectSenders: boolean,
): Promise<{ synced: number; senders: { email: string; name?: string | null }[] }> {
  const senders: { email: string; name?: string | null }[] = [];
  let synced = 0;
  const lock = await client.getMailboxLock(folder);
  try {
    const total =
      client.mailbox && typeof client.mailbox === "object"
        ? Number((client.mailbox as { exists?: number }).exists ?? 0)
        : 0;
    if (total === 0) return { synced: 0, senders };

    const start = Math.max(1, total - limit + 1);
    const range = `${start}:*`;
    const supabase = getSupabase();

    for await (const msg of client.fetch(range, {
      uid: true,
      envelope: true,
      source: true,
      flags: true,
    })) {
      const parsed = msg.source ? await simpleParser(msg.source) : null;
      const from = msg.envelope?.from?.[0];
      const to = msg.envelope?.to?.[0];
      const parsedTo = parsed?.to
        ? Array.isArray(parsed.to)
          ? parsed.to[0]
          : parsed.to
        : undefined;
      const fromEmail =
        from?.address ||
        parsed?.from?.value?.[0]?.address ||
        "unknown@unknown";
      const toEmail = to?.address || parsedTo?.value?.[0]?.address || user;
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
        msg.envelope?.messageId || parsed?.messageId || `${folder}-uid-${msg.uid}`;
      const receivedAt = (
        msg.envelope?.date ||
        parsed?.date ||
        new Date()
      ).toISOString();

      const { error } = await supabase.from("mail_messages").upsert(
        {
          message_id: messageId,
          folder,
          from_name: from?.name || parsed?.from?.value?.[0]?.name || null,
          from_email: fromEmail,
          to_email: toEmail,
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

      if (!collectSenders) continue;
      if (isOwnAddress(fromEmail, [user])) continue;
      const contact = messageContact({
        fromEmail,
        fromName: from?.name || parsed?.from?.value?.[0]?.name || null,
        bodyText: text,
        ownAddresses: [user],
      });
      senders.push({ email: contact.email, name: contact.name });
    }
  } finally {
    lock.release();
  }
  return { synced, senders };
}

export async function syncImapInbox(
  limit = 40,
): Promise<{ synced: number; subscribed: number }> {
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
  const senders: { email: string; name?: string | null }[] = [];
  let synced = 0;

  try {
    await client.connect();

    const inbox = await fetchFolder(client, "INBOX", user, limit, true);
    synced += inbox.synced;
    senders.push(...inbox.senders);

    const sentPath = await findSentMailbox(client);
    if (sentPath) {
      try {
        const sent = await fetchFolder(client, sentPath, user, limit, false);
        synced += sent.synced;
      } catch {
        /* Sent folder is optional — inbox still works */
      }
    }

    await client.logout();
    await logSync("ok", synced, null, startedAt);
    const { added } = await autoSubscribe(senders, "inbox");
    return { synced, subscribed: added };
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
