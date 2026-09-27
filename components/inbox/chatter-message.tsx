"use client";

import { useState } from "react";
import { MessageAttachments } from "@/components/inbox/message-attachments";
import { LinkifiedText } from "@/components/inbox/linkified-text";
import type { DeliveryStatus } from "@/lib/mail/delivery";
import { previewOf } from "@/lib/mail/clean";
import type { RoomMessage } from "@/lib/mail/rooms";
import { formatDateTime } from "@/lib/format";
import { localeMeta, useLocale, type Locale } from "@/lib/i18n";

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
  if (status === "queued") return t("pages.inbox.deliverySent");
  return t("pages.inbox.deliverySent");
}

function deliveryTone(status: DeliveryStatus | null | undefined): {
  className: string;
  filled: boolean;
} {
  if (status === "opened") {
    return { className: "text-[#1b7a3d]", filled: true };
  }
  if (status === "delivered") {
    return { className: "text-[#017e84]", filled: true };
  }
  if (status === "bounced" || status === "error") {
    return { className: "text-[#c0392b]", filled: false };
  }
  return { className: "text-black/45", filled: false };
}

function formatBubbleTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(localeMeta[locale].bcp47, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function MailTrackingIcon({
  message,
  showLabel = false,
  compact = false,
}: {
  message: Pick<
    RoomMessage,
    "mine" | "deliveryStatus" | "deliveredAt" | "openedAt" | "at"
  >;
  /** When true, show “Sent / Delivered / Opened” next to the icon. */
  showLabel?: boolean;
  /** Smaller icon for inside WhatsApp-style bubbles. */
  compact?: boolean;
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
  const tone = deliveryTone(status);
  const size = compact ? "h-[13px] w-[13px]" : "h-[15px] w-[15px]";

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${tone.className}`}
      title={title}
      aria-label={label}
      data-delivery-status={status}
    >
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className={size}
          fill={tone.filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={tone.filled ? "1.5" : "2"}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path
            d="m3 7 9 7 9-7"
            fill="none"
            stroke={tone.filled ? "#7eb8b4" : "currentColor"}
            strokeWidth={tone.filled ? "1.75" : "2"}
          />
        </svg>
      </span>
      {showLabel ? (
        <span className="text-[10px] font-semibold leading-none">{label}</span>
      ) : null}
    </span>
  );
}

/** WhatsApp-style compact chat bubble (Sales, Contacts, Inbox). */
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
  const mine = message.mine;
  const bubbleTone = mine ? "light" : "dark";

  return (
    <article
      className={`flex w-full px-1 py-0.5 ${mine ? "justify-end" : "justify-start"}`}
      role="group"
      aria-label={author}
    >
      <div
        className={`group/msg wa-bubble wa-tail relative w-fit max-w-[min(78%,22rem)] text-[13.5px] leading-[1.35] ${
          mine ? "wa-bubble-out" : "wa-bubble-in"
        }`}
      >
        {onDelete ? (
          <button
            type="button"
            aria-label={t("pages.inbox.deleteMessage")}
            disabled={deleting}
            onClick={onDelete}
            className={`absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[12px] leading-none opacity-0 transition-opacity group-hover/msg:opacity-100 ${
              mine
                ? "text-chat-out-text/50 hover:bg-black/10 hover:text-chat-out-text"
                : "text-ink/40 hover:bg-black/20 hover:text-ink"
            } ${deleting ? "opacity-40" : ""}`}
          >
            ×
          </button>
        ) : null}

        {!mine ? (
          <p className="mb-0.5 truncate pr-4 text-[11px] font-semibold text-[#6bdc7a]">
            {author}
          </p>
        ) : null}

        {showOriginal ? (
          <pre
            className={`whitespace-pre-wrap wrap-break-word text-xs ${
              mine ? "text-chat-out-text" : "text-ink"
            }`}
          >
            {message.raw}
          </pre>
        ) : (
          <>
            {showSubject ? (
              <p
                className={`mb-1 text-[11px] font-medium ${
                  mine ? "text-chat-out-text/70" : "text-ink/65"
                }`}
              >
                {t("common.subject")}: {message.subject}
              </p>
            ) : null}

            {hasFields ? (
              <dl
                className={`mb-1 space-y-0.5 border-l pl-2 text-[11px] ${
                  mine
                    ? "border-chat-out-text/30 text-chat-out-text/80"
                    : "border-ink/25 text-ink/80"
                }`}
              >
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
                className={`whitespace-pre-wrap wrap-break-word ${
                  mine ? "text-chat-out-text" : "text-ink"
                }`}
                linkClassName="font-medium underline underline-offset-2"
              />
            ) : !hasFields && !hasAtt ? (
              <p className={mine ? "text-chat-out-text/80" : "text-ink/80"}>
                {t("pages.inbox.emptyMessage")}
              </p>
            ) : null}

            {message.clean.quoted ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowQuoted((v) => !v)}
                  className={`mt-0.5 text-[11px] font-semibold underline-offset-2 hover:underline ${
                    mine ? "text-chat-out-text/70" : "text-ink/65"
                  }`}
                >
                  {showQuoted
                    ? t("pages.inbox.hideQuoted")
                    : t("pages.inbox.showQuoted")}
                </button>
                {showQuoted ? (
                  <pre
                    className={`mt-0.5 max-h-40 overflow-y-auto whitespace-pre-wrap wrap-break-word border-l pl-2 text-[11px] ${
                      mine
                        ? "border-chat-out-text/30 text-chat-out-text/75"
                        : "border-ink/25 text-ink/70"
                    }`}
                  >
                    {message.clean.quoted}
                  </pre>
                ) : null}
              </>
            ) : null}

            {hasAtt ? (
              <MessageAttachments
                attachments={message.attachments!}
                mine={mine}
                tone={bubbleTone}
              />
            ) : null}
          </>
        )}

        <span
          className={`wa-time ${mine ? "text-chat-out-text" : "text-ink"}`}
        >
          <time dateTime={message.at} title={formatDateTime(message.at, locale)}>
            {formatBubbleTime(message.at, locale)}
          </time>
          {mine ? <MailTrackingIcon message={message} compact /> : null}
        </span>
      </div>
    </article>
  );
}
