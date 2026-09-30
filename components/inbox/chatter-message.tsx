"use client";

import { useEffect, useRef, useState } from "react";
import { MessageAttachments } from "@/components/inbox/message-attachments";
import { LinkifiedText } from "@/components/inbox/linkified-text";
import type { DeliveryStatus } from "@/lib/mail/delivery";
import { previewOf } from "@/lib/mail/clean";
import type { RoomMessage } from "@/lib/mail/rooms";
import { formatDateTime, formatTime } from "@/lib/format";
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
  if (status === "queued") return t("pages.inbox.deliverySent");
  return t("pages.inbox.deliverySent");
}

/** Strong, distinct colors so status is obvious on the dark CRM chrome. */
function deliveryTone(status: DeliveryStatus | null | undefined): {
  className: string;
  filled: boolean;
} {
  if (status === "opened") {
    return { className: "text-[#6bdc7a]", filled: true };
  }
  if (status === "delivered") {
    return { className: "text-[#3ec4cb]", filled: true };
  }
  if (status === "bounced" || status === "error") {
    return { className: "text-[#f07171]", filled: false };
  }
  return { className: "text-[#a8a39a]", filled: false };
}

export function MailTrackingIcon({
  message,
  showLabel = false,
}: {
  message: Pick<
    RoomMessage,
    "mine" | "deliveryStatus" | "deliveredAt" | "openedAt" | "at"
  >;
  /** When true, show “Sent / Delivered / Opened” next to the icon. */
  showLabel?: boolean;
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

  return (
    <span
      className={`inline-flex items-center gap-1 ${tone.className}`}
      title={title}
      aria-label={label}
      data-delivery-status={status}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className="h-[15px] w-[15px]"
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
            stroke={tone.filled ? "#0f1f1e" : "currentColor"}
            strokeWidth={tone.filled ? "1.75" : "2"}
          />
        </svg>
      </span>
      {showLabel ? (
        <span className="text-[11px] font-semibold leading-none">{label}</span>
      ) : null}
    </span>
  );
}

function messageCopyText(message: RoomMessage, text: string) {
  const parts: string[] = [];
  if (text.trim()) parts.push(text.trim());
  for (const file of message.attachments ?? []) {
    parts.push(file.fileName);
  }
  return parts.join("\n");
}

/** WhatsApp-style chat bubble used on Sales, Contacts, and Inbox. */
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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
  const sentBy = message.mine ? message.sentByName?.trim() : "";
  const showSubject =
    !message.mine &&
    message.subject.trim() &&
    !/^note$/i.test(message.subject) &&
    !/^update$/i.test(message.subject);
  const timeLabel = formatTime(message.at, locale);
  const canCopy = hasText || hasAtt || showOriginal;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function copyMessage() {
    const payload = showOriginal
      ? message.raw
      : messageCopyText(message, text);
    if (!payload.trim()) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      setMenuOpen(false);
    } catch {
      setMenuOpen(false);
    }
  }

  return (
    <article
      className={`flex w-full gap-2 px-1 py-0.5 ${
        message.mine ? "justify-end" : "justify-start"
      }`}
      role="group"
      aria-label={author}
    >
      {!message.mine ? (
        <span
          className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${chatterAvatarTone(author)}`}
          aria-hidden
        >
          {chatterInitials(author)}
        </span>
      ) : null}

      <div
        className={`flex min-w-0 max-w-[min(82%,22rem)] flex-col ${
          message.mine ? "items-end" : "items-start"
        }`}
      >
        {!message.mine ? (
          <header className="mb-0.5 flex max-w-full items-baseline gap-1.5 px-1 leading-none">
            <strong className="truncate text-[12px] font-semibold text-ink">
              {author}
            </strong>
          </header>
        ) : (
          <header className="mb-0.5 flex max-w-full items-baseline gap-1.5 px-1 leading-none">
            <strong className="truncate text-[11px] font-medium text-mute">
              {author}
            </strong>
          </header>
        )}

        <div
          className={`wa-bubble wa-tail group/msg relative w-fit max-w-full text-[13.5px] leading-snug ${
            message.mine ? "wa-bubble-out" : "wa-bubble-in"
          }`}
        >
          {canCopy || onDelete ? (
            <div
              ref={menuRef}
              className={`absolute top-1 z-20 ${
                message.mine ? "left-1" : "right-1"
              }`}
            >
              <button
                type="button"
                aria-label={t("pages.inbox.messageActions")}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                disabled={deleting}
                onClick={() => setMenuOpen((open) => !open)}
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-opacity hover:bg-black/10 ${
                  message.mine ? "text-[#0f1f1e]/55" : "text-white/55"
                } ${
                  menuOpen
                    ? "opacity-100"
                    : "opacity-70 sm:opacity-0 sm:group-hover/msg:opacity-100"
                } ${deleting ? "opacity-40" : ""}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                  aria-hidden
                >
                  <circle cx="12" cy="5" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="12" cy="19" r="1.6" />
                </svg>
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className={`absolute top-7 min-w-[8.5rem] overflow-hidden rounded-md border border-line bg-panel py-1 shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${
                    message.mine ? "left-0" : "right-0"
                  }`}
                >
                  {canCopy ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-ash"
                      onClick={() => void copyMessage()}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5 shrink-0 text-mute"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <rect x="9" y="9" width="11" height="11" rx="1.5" />
                        <path d="M5 15V5h10" />
                      </svg>
                      {copied ? t("common.copied") : t("common.copy")}
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={deleting}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-pink hover:bg-ash disabled:opacity-40"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete();
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M4 7h16" />
                        <path d="M9 7V5h6v2" />
                        <path d="M8 7v12h8V7" />
                      </svg>
                      {deleting ? t("common.deleting") : t("common.delete")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {showOriginal ? (
            <pre
              className={`whitespace-pre-wrap wrap-break-word text-xs ${
                message.mine ? "text-[#0f1f1e]/95" : "text-white/95"
              }`}
            >
              {message.raw}
            </pre>
          ) : (
            <>
              {showSubject ? (
                <p
                  className={`mb-1 text-[12px] font-medium ${
                    message.mine ? "text-[#0f1f1e]/70" : "text-white/70"
                  }`}
                >
                  {t("common.subject")}: {message.subject}
                </p>
              ) : null}

              {hasFields ? (
                <dl
                  className={`mb-1 space-y-0.5 border-l pl-2 text-xs ${
                    message.mine
                      ? "border-[#0f1f1e]/25 text-[#0f1f1e]/80"
                      : "border-white/25 text-white/80"
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

              {hasAtt ? (
                <MessageAttachments
                  attachments={message.attachments!}
                  mine={message.mine}
                  tone={message.mine ? "dark" : "light"}
                />
              ) : null}

              {hasText ? (
                <LinkifiedText
                  text={text}
                  className={`whitespace-pre-wrap wrap-break-word ${
                    hasAtt ? "mt-1.5 " : ""
                  }${message.mine ? "text-[#0f1f1e]" : "text-white"}`}
                  linkClassName="font-medium underline underline-offset-2"
                />
              ) : !hasFields && !hasAtt ? (
                <p
                  className={
                    message.mine ? "text-[#0f1f1e]/80" : "text-white/80"
                  }
                >
                  {t("pages.inbox.emptyMessage")}
                </p>
              ) : null}

              {message.clean.quoted ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowQuoted((v) => !v)}
                    className={`mt-1 text-[11px] font-semibold underline-offset-2 hover:underline ${
                      message.mine ? "text-[#0f1f1e]/70" : "text-white/70"
                    }`}
                  >
                    {showQuoted
                      ? t("pages.inbox.hideQuoted")
                      : t("pages.inbox.showQuoted")}
                  </button>
                  {showQuoted ? (
                    <pre
                      className={`mt-1 max-h-52 overflow-y-auto whitespace-pre-wrap wrap-break-word border-l pl-2 text-xs ${
                        message.mine
                          ? "border-[#0f1f1e]/25 text-[#0f1f1e]/75"
                          : "border-white/25 text-white/75"
                      }`}
                    >
                      {message.clean.quoted}
                    </pre>
                  ) : null}
                </>
              ) : null}
            </>
          )}

          <span
            className={`wa-time ${
              message.mine ? "text-[#0f1f1e]" : "text-white"
            }`}
          >
            <time dateTime={message.at} title={formatDateTime(message.at, locale)}>
              {timeLabel}
            </time>
          </span>
        </div>

        {message.mine ? (
          <div className="mt-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 pr-0.5">
            <MailTrackingIcon message={message} showLabel />
            {sentBy ? (
              <span className="text-[11px] text-mute">
                {t("pages.inbox.sentBy", { name: sentBy })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
