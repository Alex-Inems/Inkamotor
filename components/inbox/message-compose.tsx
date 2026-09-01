"use client";

import { useId, useRef, useState } from "react";
import {
  COMPOSE_MAX_FILES,
  formatAttachmentBytes,
  pendingToOutbound,
  validatePendingAttachments,
  type OutboundAttachment,
  type PendingAttachment,
} from "@/lib/mail/compose-attachments";
import { useCrm } from "@/lib/crm-store";
import { useLocale } from "@/lib/i18n";

export type MessageComposePayload = {
  message: string;
  attachments: OutboundAttachment[];
};

export function MessageCompose({
  placeholder,
  sending,
  disabled,
  variant = "default",
  onSend,
}: {
  placeholder: string;
  sending: boolean;
  disabled?: boolean;
  variant?: "inbox" | "default";
  onSend: (payload: MessageComposePayload) => Promise<void>;
}) {
  const { t } = useLocale();
  const { pushToast } = useCrm();
  const fileInputId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const canSend =
    !disabled && !sending && (draft.trim().length > 0 || attachments.length > 0);

  function resizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function insertAtCursor(snippet: string) {
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => (prev ? `${prev}\n${snippet}` : snippet));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = `${el.value.slice(0, start)}${snippet}${el.value.slice(end)}`;
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
      resizeTextarea(el);
    });
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next: PendingAttachment[] = [];
    for (const file of Array.from(fileList)) {
      if (attachments.length + next.length >= COMPOSE_MAX_FILES) break;
      next.push({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
      });
    }
    if (next.length) {
      setAttachments((prev) => [...prev, ...next]);
    }
  }

  function insertLink() {
    const url = linkUrl.trim();
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const label = linkLabel.trim() || href;
    insertAtCursor(`[${label}](${href})`);
    setLinkUrl("");
    setLinkLabel("");
    setLinkOpen(false);
  }

  async function handleSend() {
    const error = validatePendingAttachments(attachments, t);
    if (error) {
      pushToast(error);
      return;
    }
    if (!draft.trim() && attachments.length === 0) return;

    const outbound = await pendingToOutbound(attachments);
    await onSend({
      message: draft.trim(),
      attachments: outbound,
    });
    setDraft("");
    setAttachments([]);
    setLinkOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  const textareaClass =
    variant === "inbox"
      ? "max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-line bg-ash px-3.5 py-2.5 text-sm leading-snug outline-none placeholder:text-mute/70 focus:border-gold sm:rounded-none"
      : "min-h-11 flex-1 resize-none border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-mute/70 focus:border-gold";

  const sendButtonClass =
    variant === "inbox"
      ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-chat-out text-chat-out-text transition-colors hover:bg-accent-deep disabled:opacity-40 sm:w-auto sm:rounded-none sm:bg-accent sm:px-4 sm:text-sm sm:font-semibold sm:text-cream"
      : "inline-flex min-h-11 shrink-0 items-center justify-center bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50";

  return (
    <div className="space-y-2">
      {attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((file) => (
            <li
              key={file.id}
              className="flex max-w-full items-center gap-2 border border-line bg-canvas px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0 truncate font-medium text-ink">
                {file.fileName}
              </span>
              <span className="shrink-0 text-mute">
                {formatAttachmentBytes(file.byteSize)}
              </span>
              <button
                type="button"
                aria-label={t("pages.inbox.removeAttachment")}
                onClick={() =>
                  setAttachments((prev) => prev.filter((row) => row.id !== file.id))
                }
                className="shrink-0 text-mute hover:text-pink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {linkOpen ? (
        <div className="flex flex-wrap items-end gap-2 border border-line bg-canvas p-2.5">
          <label className="min-w-[10rem] flex-1 text-xs">
            <span className="mb-1 block font-semibold uppercase tracking-wide text-mute">
              {t("pages.inbox.linkUrl")}
            </span>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://inkamototours.com/..."
              className="w-full border border-line bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-gold"
            />
          </label>
          <label className="min-w-[8rem] flex-1 text-xs">
            <span className="mb-1 block font-semibold uppercase tracking-wide text-mute">
              {t("pages.inbox.linkLabel")}
            </span>
            <input
              type="text"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder={t("pages.inbox.linkLabelPlaceholder")}
              className="w-full border border-line bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-gold"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLinkOpen(false)}
              className="border border-line px-3 py-1.5 text-xs font-semibold text-mute hover:text-ink"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={insertLink}
              disabled={!linkUrl.trim()}
              className="bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {t("pages.inbox.insertLink")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <div className="flex shrink-0 items-center gap-0.5 self-end pb-0.5">
          <input
            id={fileInputId}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={fileInputId}
            className="flex h-10 w-10 cursor-pointer items-center justify-center text-mute transition-colors hover:bg-panel hover:text-ink"
            title={t("pages.inbox.attachFiles")}
            aria-label={t("pages.inbox.attachFiles")}
          >
            <AttachIcon />
          </label>
          <button
            type="button"
            onClick={() => setLinkOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center text-mute transition-colors hover:bg-panel hover:text-ink"
            title={t("pages.inbox.addLink")}
            aria-label={t("pages.inbox.addLink")}
          >
            <LinkIcon />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          rows={variant === "inbox" ? 1 : 2}
          value={draft}
          disabled={disabled || sending}
          onChange={(e) => {
            setDraft(e.target.value);
            resizeTextarea(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) void handleSend();
            }
          }}
          placeholder={placeholder}
          className={textareaClass}
        />

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label={t("pages.inbox.send")}
          className={sendButtonClass}
        >
          {variant === "inbox" ? (
            <>
              <span className="sm:hidden">{sending ? "…" : <SendIcon />}</span>
              <span className="hidden sm:inline">
                {sending ? "…" : t("pages.inbox.send")}
              </span>
            </>
          ) : (
            (sending ? "…" : t("pages.inbox.send"))
          )}
        </button>
      </div>
    </div>
  );
}

function AttachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M12.2 4.8 6.9 10.1a2.2 2.2 0 1 1-3.1-3.1l6.2-6.2a3.6 3.6 0 1 1 5.1 5.1l-7.4 7.4a5.1 5.1 0 0 1-7.2-7.2l6.8-6.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M7.2 10.8 10.8 7.2M8.4 12.6l-1.5 1.5a2.4 2.4 0 0 1-3.4-3.4l3.4-3.4a2.4 2.4 0 0 1 3.4 3.4l-.9.9M9.6 5.4l1.5-1.5a2.4 2.4 0 0 1 3.4 3.4l-3.4 3.4a2.4 2.4 0 0 1-3.4-3.4l.9-.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m4 12 16-7-7 16-2-7-7-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
