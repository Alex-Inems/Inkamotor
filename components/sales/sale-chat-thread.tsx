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
import { formatDateTime } from "@/lib/format";
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
  attachments?: {
    id: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
  }[];
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

const AVATAR_TONES = [
  "bg-[#714B67]",
  "bg-[#017e84]",
  "bg-[#5a7aa8]",
  "bg-[#c47a3a]",
  "bg-[#6b8f3a]",
  "bg-[#a85a5a]",
];

function avatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function isClientEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  return trimmed.includes("@") && !trimmed.endsWith("@inkamototours.local");
}

function SaleChatBubble({
  message,
  youLabel,
}: {
  message: RoomMessage;
  youLabel: string;
}) {
  const { t, locale } = useLocale();
  const text =
    message.clean.text?.trim() ||
    previewOf(message.clean, message.raw?.trim() || "");
  const hasText = text.length > 0;
  const hasAtt = (message.attachments?.length ?? 0) > 0;
  if (!hasText && !hasAtt) return null;

  const author = message.mine
    ? message.authorName.trim() || youLabel
    : message.authorName.trim() || message.subject || youLabel;
  const showSubject =
    !message.mine &&
    message.subject.trim() &&
    !/^note$/i.test(message.subject) &&
    !/^update$/i.test(message.subject);

  return (
    <article className="flex gap-2.5 px-1 py-1.5" role="group" aria-label={author}>
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white ${avatarTone(author)}`}
        aria-hidden
      >
        {initialsOf(author)}
      </span>
      <div className="min-w-0 flex-1">
        <header className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-none">
          <strong className="text-[13px] font-semibold text-ink">{author}</strong>
          <time
            className="text-[11px] text-mute"
            dateTime={message.at}
            title={message.at}
          >
            {formatDateTime(message.at, locale)}
          </time>
        </header>
        <div
          className={`relative max-w-[min(100%,36rem)] rounded-md rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed ${
            message.mine ? "odoo-mail-bubble-out" : "odoo-mail-bubble-in"
          }`}
        >
          {showSubject ? (
            <p className="mb-1.5 text-[12px] font-medium text-white/70">
              {t("common.subject")}: {message.subject}
            </p>
          ) : null}
          {hasText ? (
            <LinkifiedText
              text={text}
              className="whitespace-pre-wrap wrap-break-word text-white"
              linkClassName="font-medium underline underline-offset-2"
            />
          ) : null}
          {hasAtt ? (
            <MessageAttachments
              attachments={message.attachments!}
              mine={message.mine}
              tone="light"
            />
          ) : null}
        </div>
      </div>
    </article>
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
  const youLabel = t("pages.inbox.youPrefix").replace(/:\s*$/, "").trim() || "You";

  const loadConversation = useCallback(async () => {
    if (!canLoad) {
      setMail([]);
      setReplies([]);
      return;
    }

    setLoading(true);
    try {
      const emailParam = encodeURIComponent(email.trim());
      const [statusRes, mailRes, repliesRes] = await Promise.all([
        fetch("/api/inbox/status"),
        fetch(`/api/inbox/mail?locale=${locale}&email=${emailParam}`),
        fetch(`/api/inbox/replies?locale=${locale}&email=${emailParam}`),
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
    if (!el) return;
    let cancelled = false;
    const stick = () => {
      if (!cancelled) el.scrollTop = el.scrollHeight;
    };
    stick();
    const timers = [400, 1200, 2800].map((ms) => window.setTimeout(stick, ms));
    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
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
    <aside className="flex h-full min-h-0 min-w-0 flex-col border-l-0 bg-panel lg:border-l lg:border-line">
      <header className="shrink-0 border-b border-line px-4 py-2.5">
        <p className="text-[13px] font-semibold text-ink">
          {title || t("pages.sales.clientMessages")}
        </p>
        {email ? (
          <p className="mt-0.5 truncate text-xs text-mute">{email}</p>
        ) : null}
      </header>

      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3"
      >
        {!canLoad ? (
          <EmptyHint>{t("pages.sales.clientEmailMissing")}</EmptyHint>
        ) : loading ? (
          <p className="px-2 py-4 text-sm text-mute">{t("common.loading")}</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-4 text-center">
            <p className="text-sm font-medium text-ink">
              {t("pages.sales.noClientMessages")}
            </p>
            <p className="mt-1 max-w-[16rem] text-xs text-mute">
              {t("pages.contacts.chatEmptyHint")}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <SaleChatBubble
              key={message.key}
              message={message}
              youLabel={youLabel}
            />
          ))
        )}
      </div>

      <footer className="shrink-0 border-t border-line bg-ash/40 p-3 sm:p-4">
        {canLoad && brevoReady ? (
          <MessageCompose
            placeholder={t("pages.inbox.messagePlaceholder", { name: displayName })}
            sending={sending}
            variant="chatter"
            sendTone="danger"
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
