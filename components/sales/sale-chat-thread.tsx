"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageAttachments } from "@/components/inbox/message-attachments";
import {
  MessageCompose,
  type MessageComposePayload,
} from "@/components/inbox/message-compose";
import { LinkifiedText } from "@/components/inbox/linkified-text";
import { EmptyHint } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import { previewOf } from "@/lib/mail/clean";
import { displayContactName, groupMailRooms, type RoomMessage } from "@/lib/mail/rooms";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

type MailMessage = {
  id: string;
  fromName: string | null;
  fromEmail: string;
  toEmail: string | null;
  subject: string;
  preview: string;
  bodyText: string | null;
  receivedAt: string;
  isRead: boolean;
};

type MailReply = {
  id: string;
  toName: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  relatedMailId: string | null;
  sentAt: string;
  attachments?: {
    id: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
  }[];
};

function isClientEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  return trimmed.includes("@") && !trimmed.endsWith("@inkamototours.local");
}

function SaleChatBubble({ message }: { message: RoomMessage }) {
  const { t, locale } = useLocale();
  const text =
    message.clean.text?.trim() ||
    previewOf(message.clean, message.raw?.trim() || t("pages.inbox.emptyMessage"));

  return (
    <div
      className={`max-w-[88%] rounded-md px-3 py-2 text-sm ${
        message.mine
          ? "ml-auto bg-accent/15 text-ink"
          : "mr-auto border border-line bg-panel text-ink"
      }`}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-mute">
        {message.mine ? t("pages.inbox.youPrefix").replace(/:\s*$/, "") : message.subject}
        {" · "}
        {formatDate(message.at.slice(0, 10), locale)}
      </p>
      <LinkifiedText
        text={text}
        className="whitespace-pre-wrap wrap-break-word leading-relaxed"
        linkClassName="font-medium underline underline-offset-2"
      />
      {message.attachments?.length ? (
        <MessageAttachments attachments={message.attachments} mine={message.mine} />
      ) : null}
    </div>
  );
}

export function SaleChatPanel({
  email,
  customerName,
  title,
}: {
  email: string;
  customerName: string;
  title?: string;
}) {
  const { t, locale } = useLocale();
  const { pushToast } = useCrm();
  const [loading, setLoading] = useState(false);
  const [mail, setMail] = useState<MailMessage[]>([]);
  const [replies, setReplies] = useState<MailReply[]>([]);
  const [ownAddresses, setOwnAddresses] = useState<(string | null)[]>([]);
  const [brevoReady, setBrevoReady] = useState(false);
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const canLoad = isClientEmail(email);

  const loadConversation = useCallback(async () => {
    if (!canLoad) {
      setMail([]);
      setReplies([]);
      return;
    }

    setLoading(true);
    try {
      const [statusRes, mailRes, repliesRes] = await Promise.all([
        fetch("/api/inbox/status"),
        fetch(`/api/inbox/mail?locale=${locale}`),
        fetch(`/api/inbox/replies?locale=${locale}`),
      ]);

      if (statusRes.ok) {
        const status = (await statusRes.json()) as {
          namecheap?: { user?: string };
          brevo?: { ready?: boolean; sender?: string | null };
        };
        setOwnAddresses([
          status.namecheap?.user ?? null,
          status.brevo?.sender ?? null,
        ]);
        setBrevoReady(!!status.brevo?.ready);
      }

      if (mailRes.ok) {
        const json = (await mailRes.json()) as { messages?: MailMessage[] };
        setMail(json.messages ?? []);
      } else {
        setMail([]);
      }

      if (repliesRes.ok) {
        const json = (await repliesRes.json()) as { replies?: MailReply[] };
        setReplies(json.replies ?? []);
      } else {
        setReplies([]);
      }
    } catch {
      setMail([]);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [canLoad, email, locale]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  const room = useMemo(() => {
    if (!canLoad) return null;
    return groupMailRooms({
      mail,
      replies: replies.map((reply) => ({
        ...reply,
        attachments: reply.attachments ?? [],
      })),
      ownAddresses,
      openedEmails: [email.trim().toLowerCase()],
      youPrefix: t("pages.inbox.youPrefix"),
      emptyPreview: t("pages.inbox.noMessage"),
    }).find((row) => row.email === email.trim().toLowerCase());
  }, [canLoad, email, mail, ownAddresses, replies, t]);

  const messages = room?.messages ?? [];

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, email]);

  async function sendMessage(payload: MessageComposePayload) {
    if ((!payload.message && payload.attachments.length === 0) || !canLoad) return;
    setSending(true);
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: email.trim(),
          toName: customerName.trim() || undefined,
          inReplyToSubject: room?.lastSubject,
          message: payload.message,
          relatedMailId: room?.lastMailId,
          attachments: payload.attachments,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || t("pages.inbox.sendFailed"));
      }
      await loadConversation();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : t("pages.inbox.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  const displayName = displayContactName(customerName, email);

  return (
    <aside className="flex h-full min-h-[420px] min-w-0 flex-col border-l-0 bg-ash/60 lg:min-h-0 lg:border-l lg:border-line">
      <header className="shrink-0 border-b border-line/80 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold/90">
          {title || t("pages.sales.clientMessages")}
        </p>
        {email ? (
          <p className="mt-1 truncate text-xs text-mute">{email}</p>
        ) : null}
      </header>

      <div ref={threadRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4">
        {!canLoad ? (
          <EmptyHint>{t("pages.sales.clientEmailMissing")}</EmptyHint>
        ) : loading ? (
          <p className="text-sm text-mute">{t("common.loading")}</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-panel text-mute">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6.5h16v11H4zM4 7l8 6 8-6"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">
              {t("pages.sales.noClientMessages")}
            </p>
            <p className="mt-1 max-w-[16rem] text-xs text-mute">
              {t("pages.contacts.chatEmptyHint")}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <SaleChatBubble key={message.key} message={message} />
          ))
        )}
      </div>

      <footer className="shrink-0 border-t border-line/80 bg-panel/80 p-3 sm:p-4">
        {canLoad && brevoReady ? (
          <MessageCompose
            placeholder={t("pages.inbox.messagePlaceholder", { name: displayName })}
            sending={sending}
            onSend={sendMessage}
          />
        ) : canLoad ? (
          <p className="text-xs text-gold">{t("pages.inbox.sendingMissing")}</p>
        ) : null}
      </footer>
    </aside>
  );
}

/** Compact embed for legacy modal use — prefer SaleChatPanel on the detail page. */
export function SaleChatThread({ email }: { email: string }) {
  return (
    <div className="min-h-[320px]">
      <SaleChatPanel email={email} customerName="" />
    </div>
  );
}
