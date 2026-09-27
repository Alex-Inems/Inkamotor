"use client";

import { useState } from "react";
import { MessageAttachments } from "@/components/inbox/message-attachments";
import { LinkifiedText } from "@/components/inbox/linkified-text";
import type { DeliveryStatus } from "@/lib/mail/delivery";
import { previewOf } from "@/lib/mail/clean";
import type { RoomMessage } from "@/lib/mail/rooms";
import { formatDateTime } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

const AVATAR_TONES = [
  "bg-[#714B67]",
  "bg-[#017e84]",
  "bg-[#5a7aa8]",
  "bg-[#c47a3a]",
  "bg-[#6b8f3a]",
  "bg-[#a85a5a]",
];

export function chatterAvatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

export function chatterInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function deliveryLabel(
  status: DeliveryStatus | null | undefined,
  t: (key: string) => string,
) {
  if (status === "opened") return t("pages.inbox.deliveryOpened");
  if (status === "delivered") return t("pages.inbox.deliveryDelivered");
  if (status === "bounced") return t("pages.inbox.deliveryBounced");
  if (status === "error") return t("pages.inbox.deliveryError");
  return t("pages.inbox.deliverySent");
}

function deliveryIconClass(status: DeliveryStatus | null | undefined) {
  if (status === "opened") return "text-[#2f6b3a]";
  if (status === "delivered") return "text-[#017e84]";
  if (status === "bounced" || status === "error") return "text-[#c43c3c]";
  return "text-mute";
}

export function MailTrackingIcon({
  message,
}: {
  message: Pick<
    RoomMessage,
    "mine" | "deliveryStatus" | "deliveredAt" | "openedAt" | "at"
  >;
}) {
  const { t, locale } = useLocale();
  if (!message.mine) return null;
  const status = message.deliveryStatus ?? "sent";
  const tipAt =
    status === "opened"
      ? message.openedAt
      : status === "delivered"
        ? message.deliveredAt
        : message.at;
  const label = deliveryLabel(status, t);
  const title = tipAt
    ? `${label} · ${formatDateTime(tipAt, locale)}`
    : label;

  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${deliveryIconClass(status)}`}
      title={title}
      aria-label={label}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[14px] w-[14px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 7 9-7" />
      </svg>
    </span>
  );
}

/** Odoo-style chatter bubble used on Sales, Contacts, and Inbox. */
export function ChatterMessage({
  message,
  youLabel,
  showOriginal = false,
  deleting = false,
  onDelete,
}: {
  message: RoomMessage;
  youLabel: string;
  showOriginal?: boolean;
  deleting?: boolean;
  onDelete?: () => void;
}) {
  const { t, locale } = useLocale();
  const [showQuoted, setShowQuoted] = useState(false);
  const text =
    message.clean.text?.trim() ||
    previewOf(message.clean, message.raw?.trim() || "");
  const hasText = text.length > 0;
  const hasFields = message.clean.fields.length > 0;
  const hasAtt = (message.attachments?.length ?? 0) > 0;
  if (!hasText && !hasFields && !hasAtt && !showOriginal) return null;

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
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white ${chatterAvatarTone(author)}`}
        aria-hidden
      >
        {chatterInitials(author)}
      </span>
      <div className="min-w-0 flex-1">
        <header className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-none">
          <strong className="text-[13px] font-semibold text-ink">{author}</strong>
          <MailTrackingIcon message={message} />
          <time
            className="text-[11px] text-mute"
            dateTime={message.at}
            title={message.at}
          >
            {formatDateTime(message.at, locale)}
          </time>
        </header>
        <div
          className={`group/msg relative max-w-[min(100%,36rem)] rounded-md rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed ${
            message.mine ? "odoo-mail-bubble-out" : "odoo-mail-bubble-in"
          }`}
        >
          {onDelete ? (
            <button
              type="button"
              aria-label={t("pages.inbox.deleteMessage")}
              disabled={deleting}
              onClick={onDelete}
              className={`absolute top-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[13px] leading-none text-white/50 transition-opacity hover:bg-black/15 hover:text-white sm:opacity-0 sm:group-hover/msg:opacity-100 ${
                deleting ? "opacity-40" : ""
              }`}
            >
              ×
            </button>
          ) : null}

          {showOriginal ? (
            <pre className="whitespace-pre-wrap wrap-break-word text-xs text-white/95">
              {message.raw}
            </pre>
          ) : (
            <>
              {showSubject ? (
                <p className="mb-1.5 text-[12px] font-medium text-white/70">
                  {t("common.subject")}: {message.subject}
                </p>
              ) : null}

              {hasFields ? (
                <dl className="mb-1.5 space-y-0.5 border-l border-white/25 pl-2 text-xs text-white/80">
                  {message.clean.fields.map((f) => (
                    <div key={`${f.label}-${f.value}`} className="flex gap-2">
                      <dt>{f.label}</dt>
                      <dd className="min-w-0 wrap-break-word text-inherit">
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {hasText ? (
                <LinkifiedText
                  text={text}
                  className="whitespace-pre-wrap wrap-break-word text-white"
                  linkClassName="font-medium underline underline-offset-2"
                />
              ) : !hasFields && !hasAtt ? (
                <p className="text-white/80">
                  {t("pages.inbox.emptyMessage")}
                </p>
              ) : null}

              {message.clean.quoted ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowQuoted((v) => !v)}
                    className="mt-1 text-[11px] font-semibold text-white/70 underline-offset-2 hover:underline"
                  >
                    {showQuoted
                      ? t("pages.inbox.hideQuoted")
                      : t("pages.inbox.showQuoted")}
                  </button>
                  {showQuoted ? (
                    <pre className="mt-1 max-h-52 overflow-y-auto whitespace-pre-wrap wrap-break-word border-l border-white/25 pl-2 text-xs text-white/75">
                      {message.clean.quoted}
                    </pre>
                  ) : null}
                </>
              ) : null}

              {hasAtt ? (
                <MessageAttachments
                  attachments={message.attachments!}
                  mine={message.mine}
                  tone="light"
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
