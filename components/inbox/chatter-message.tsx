"use client";

import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
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

const LONG_PRESS_MS = 420;
const MOVE_CANCEL_PX = 10;

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

export function getMessagePlainText(
  message: RoomMessage,
  showOriginal = false,
) {
  if (showOriginal) return message.raw?.trim() || "";
  const text =
    message.clean.text?.trim() ||
    previewOf(message.clean, message.raw?.trim() || "");
  const parts: string[] = [];
  if (text) parts.push(text);
  for (const file of message.attachments ?? []) {
    parts.push(file.fileName);
  }
  return parts.join("\n");
}

/** Top bar shown while messages are selected (WhatsApp-style). */
export function MessageSelectionBar({
  count,
  copying = false,
  deleting = false,
  canCopy = true,
  canDelete = true,
  onClear,
  onCopy,
  onDelete,
}: {
  count: number;
  copying?: boolean;
  deleting?: boolean;
  canCopy?: boolean;
  canDelete?: boolean;
  onClear: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="wa-sender-bar flex shrink-0 items-center gap-1 px-1 py-1 sm:gap-2 sm:px-3 sm:py-2">
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClear}
        className="flex h-11 w-11 shrink-0 items-center justify-center text-white/90 hover:text-white"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <p className="min-w-0 flex-1 truncate px-1 text-[15px] font-semibold text-white">
        {t("pages.inbox.selectedCount", { n: count })}
      </p>
      {canCopy ? (
        <button
          type="button"
          disabled={copying || count === 0}
          onClick={onCopy}
          className="flex h-11 items-center gap-1.5 px-2.5 text-sm font-semibold text-white/95 hover:text-white disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
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
          {copying ? t("common.copied") : t("common.copy")}
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          disabled={deleting || count === 0}
          onClick={onDelete}
          className="flex h-11 items-center gap-1.5 px-2.5 text-sm font-semibold text-[#ffb4b4] hover:text-white disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
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
  );
}

/** WhatsApp-style chat bubble used on Sales, Contacts, and Inbox. */
export function ChatterMessage({
  message,
  youLabel,
  showOriginal = false,
  selected = false,
  selectionActive = false,
  onToggleSelect,
  onEdit,
  onResend,
  onTranslate,
  resending = false,
}: {
  message: RoomMessage;
  youLabel: string;
  showOriginal?: boolean;
  selected?: boolean;
  selectionActive?: boolean;
  /** Long-press or tap-while-selecting. */
  onToggleSelect?: () => void;
  onEdit?: (message: RoomMessage) => void;
  onResend?: (message: RoomMessage) => void;
  onTranslate?: (message: RoomMessage) => void;
  resending?: boolean;
}) {
  const { t, locale } = useLocale();
  const [showQuoted, setShowQuoted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const didLongPress = useRef(false);
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
    !message.isNote &&
    message.subject.trim() &&
    !/^note$/i.test(message.subject) &&
    !/^update$/i.test(message.subject);
  const timeLabel = formatTime(message.at, locale);
  const selectable = !!onToggleSelect;
  const canResend =
    !!onResend &&
    message.mine &&
    !message.isNote &&
    !!message.editableId &&
    message.editableKind !== "note";
  const canAct = !!(onEdit || onTranslate || canResend);

  function clearPressTimer() {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!selectable || event.button !== 0) return;
    didLongPress.current = false;
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => {
      didLongPress.current = true;
      onToggleSelect?.();
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!pressOrigin.current || pressTimer.current == null) return;
    const dx = event.clientX - pressOrigin.current.x;
    const dy = event.clientY - pressOrigin.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearPressTimer();
  }

  function onPointerUp() {
    clearPressTimer();
    pressOrigin.current = null;
  }

  function onClick(event: MouseEvent<HTMLElement>) {
    if (!selectable) return;
    if (didLongPress.current) {
      didLongPress.current = false;
      event.preventDefault();
      return;
    }
    if (selectionActive) {
      event.preventDefault();
      onToggleSelect?.();
    }
  }

  function onContextMenu(event: MouseEvent<HTMLElement>) {
    if (!selectable) return;
    event.preventDefault();
    onToggleSelect?.();
  }

  return (
    <article
      className={`relative flex w-full gap-2 px-1 py-0.5 transition-colors ${
        message.mine ? "justify-end" : "justify-start"
      } ${selected ? "bg-[#00a884]/22" : selectionActive ? "hover:bg-white/5" : ""}`}
      role="group"
      aria-label={author}
      aria-selected={selected}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ WebkitTouchCallout: "none", userSelect: selectionActive ? "none" : undefined }}
    >
      {selected ? (
        <span
          className={`absolute top-1/2 z-[1] flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#00a884] text-white ${
            message.mine ? "left-1" : "right-1"
          }`}
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
      ) : null}

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
          className={`wa-bubble wa-tail relative w-fit max-w-full text-[13.5px] leading-snug ${
            message.isNote
              ? "border border-dashed border-gold/50 bg-[#3a3428] text-[#f4e5c1]"
              : message.mine
                ? "wa-bubble-out"
                : "wa-bubble-in"
          }`}
        >
          {message.isNote ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gold">
              {t("pages.inbox.internalNote")}
            </p>
          ) : null}
          {canAct ? (
            <div className="absolute right-1 top-1 z-[2]">
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[11px] text-mute/80 hover:bg-black/20 hover:text-ink"
                aria-label={t("pages.inbox.messageActions")}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                ⋮
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
                  {canResend ? (
                    <button
                      type="button"
                      disabled={resending}
                      className="block w-full px-3 py-2 text-left text-xs font-medium text-ink hover:bg-ash disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onResend?.(message);
                      }}
                    >
                      {resending
                        ? t("pages.inbox.resending")
                        : t("pages.inbox.resendMessage")}
                    </button>
                  ) : null}
                  {onEdit && message.editableId ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-ash"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onEdit(message);
                      }}
                    >
                      {t("pages.inbox.editMessage")}
                    </button>
                  ) : null}
                  {onTranslate ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-ash"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onTranslate(message);
                      }}
                    >
                      {t("pages.inbox.translateMessage")}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowQuoted((v) => !v);
                    }}
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
