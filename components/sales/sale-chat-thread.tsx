"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatterMessage } from "@/components/inbox/chatter-message";
import {
  MessageCompose,
  type MessageComposePayload,
} from "@/components/inbox/message-compose";
import { EmptyHint } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import type { DeliveryStatus } from "@/lib/mail/delivery";
import { displayContactName, groupMailRooms } from "@/lib/mail/rooms";
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
  deliveryStatus?: DeliveryStatus | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
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
  deliveryStatus?: DeliveryStatus | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
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

  const loadConversation = useCallback(async (opts?: { silent?: boolean }) => {
    if (!canLoad) {
      setMail([]);
      setReplies([]);
      return;
    }

    const silent = !!opts?.silent;
    if (!silent) setLoading(true);
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
      } else if (!silent) {
        setMail([]);
      }

      if (repliesRes.ok) {
        const json = (await repliesRes.json()) as { replies?: MailReply[] };
        setReplies(json.replies ?? []);
      } else if (!silent) {
        setReplies([]);
      }
    } catch {
      if (!silent) {
        setMail([]);
        setReplies([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [canLoad, email, locale]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  // Quietly refresh delivery status — never flip back to the loading skeleton.
  useEffect(() => {
    if (!canLoad) return;
    const id = window.setInterval(() => {
      void loadConversation({ silent: true });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [canLoad, loadConversation]);

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
          toEmail: email.trim().toLowerCase(),
          toName: customerName.trim() || undefined,
          inReplyToSubject: room?.lastSubject,
          message: payload.message,
          relatedMailId: room?.lastMailId,
          attachments:
        payload.attachments.length > 0 ? payload.attachments : undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        reply?: MailReply | null;
      };
      if (!res.ok) {
        throw new Error(json.error || t("pages.inbox.sendFailed"));
      }
      const saved = json.reply;
      if (saved) {
        setReplies((prev) =>
          prev.some((row) => row.id === saved.id) ? prev : [saved, ...prev],
        );
      }
      await loadConversation({ silent: true });
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
            <ChatterMessage
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
