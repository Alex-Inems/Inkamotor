"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  COMPOSE_MAX_FILES,
  formatAttachmentBytes,
  pendingToOutbound,
  resolveMimeType,
  validatePendingAttachments,
  type OutboundAttachment,
  type PendingAttachment,
} from "@/lib/mail/compose-attachments";
import { useCrm } from "@/lib/crm-store";
import { useLocale } from "@/lib/i18n";
import { EmojiPicker } from "@/components/inbox/emoji-picker";
import { MessageTemplatePicker } from "@/components/inbox/message-template-picker";
import { MentionMenu } from "@/components/inbox/mention-menu";
import {
  personalizeTemplateBody,
  saveCustomMessageTemplate,
  type MessageTemplateModel,
} from "@/lib/mail/message-templates";

export type MessageComposePayload = {
  message: string;
  attachments: OutboundAttachment[];
  /** Optional subject when a message template was applied. */
  subject?: string;
  messageHtml?: string;
  ccEmails?: string[];
};

export function MessageCompose({
  placeholder,
  sending,
  disabled,
  variant = "default",
  sendTone = "accent",
  recipientName,
  templateModels,
  mode = "message",
  onOpenFullComposer,
  onSend,
}: {
  placeholder: string;
  sending: boolean;
  disabled?: boolean;
  variant?: "inbox" | "default" | "chatter";
  /** Sale chatter uses brand red; inbox keeps teal. */
  sendTone?: "accent" | "danger";
  /** Used to personalize template greetings (Bonjour …). */
  recipientName?: string;
  /** Prefer templates for these Odoo models when ranking. */
  templateModels?: MessageTemplateModel | MessageTemplateModel[];
  /** message = email send; note = internal log note. */
  mode?: "message" | "note";
  onOpenFullComposer?: () => void;
  onSend: (payload: MessageComposePayload) => Promise<void>;
}) {
  const { t } = useLocale();
  const { pushToast, updateToast, dismissToast, leads, sales } = useCrm();
  const fileInputId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const templateBtnRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  const [templateSubject, setTemplateSubject] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const busy = sending || preparing;
  const canSend =
    !disabled && !busy && (draft.trim().length > 0 || attachments.length > 0);

  const mentionCandidates = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    for (const lead of leads ?? []) {
      const email = String(lead.email ?? "").trim().toLowerCase();
      if (!email) continue;
      map.set(email, {
        id: `lead-${lead.id}`,
        name: String(lead.name ?? ""),
        email,
      });
    }
    for (const sale of sales ?? []) {
      const email = String(sale.email ?? "").trim().toLowerCase();
      if (!email) continue;
      map.set(email, {
        id: `sale-${sale.id}`,
        name: String(sale.customer ?? ""),
        email,
      });
    }
    return [...map.values()];
  }, [leads, sales]);

  function resizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
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
        mimeType: resolveMimeType(file.type, file.name),
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

  function applyTemplate(body: string, subject: string) {
    const next = personalizeTemplateBody(body, recipientName);
    setDraft(next);
    setTemplateSubject(subject.trim() || null);
    setTemplateOpen(false);
    setEmojiOpen(false);
    setLinkOpen(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
      resizeTextarea(el);
    });
  }

  function saveAsTemplate() {
    const body = draft.trim();
    const subject = templateSubject?.trim() || "";
    if (!body && !subject) {
      pushToast({
        message: t("pages.inbox.templateBodyRequired"),
        tone: "info",
      });
      return;
    }
    const name = window.prompt(t("pages.inbox.templateNamePrompt"));
    if (!name?.trim()) return;
    try {
      const model = Array.isArray(templateModels)
        ? templateModels[0]
        : templateModels;
      saveCustomMessageTemplate({
        name: name.trim(),
        subject,
        body,
        model,
      });
      pushToast({ message: t("pages.inbox.templateSaved"), tone: "success" });
    } catch (err) {
      pushToast({
        message:
          err instanceof Error
            ? err.message
            : t("pages.inbox.templateSaveFailed"),
        tone: "error",
      });
    }
  }

  async function handleSend() {
    if (busy) return;
    const error = validatePendingAttachments(attachments, t);
    if (error) {
      pushToast(error);
      return;
    }
    if (!draft.trim() && attachments.length === 0) return;

    // Snapshot now; keep the compose box unchanged until upload + send both succeed.
    const messageText = draft.trim();
    const filesToSend = attachments;
    const needsUpload = filesToSend.length > 0;

    setPreparing(true);
    let progressToastId: number | null = null;
    if (needsUpload) {
      progressToastId = pushToast({
        message: t("pages.inbox.uploadingAttachment"),
        detail: filesToSend[0]?.fileName,
        tone: "info",
        progress: 0,
        sticky: true,
      });
    }

    const finishProgress = (ok: boolean) => {
      if (progressToastId == null) return;
      const id = progressToastId;
      progressToastId = null;
      if (ok) {
        updateToast(id, {
          message: t("common.sending"),
          detail: undefined,
          progress: 100,
        });
      }
      dismissToast(id);
    };

    let outbound;
    try {
      // Stage / compress attachments fully before the reply text is submitted.
      outbound = await pendingToOutbound(
        filesToSend,
        progressToastId == null
          ? undefined
          : (progress) => {
              if (progressToastId == null) return;
              updateToast(progressToastId, {
                message: t("pages.inbox.uploadingAttachment"),
                detail:
                  progress.fileCount > 1
                    ? `${progress.fileName} · ${progress.fileIndex + 1}/${progress.fileCount}`
                    : progress.fileName,
                progress: Math.min(85, progress.percent),
              });
            },
      );
    } catch (err) {
      finishProgress(false);
      pushToast(err instanceof Error ? err.message : t("pages.inbox.sendFailed"));
      setPreparing(false);
      return;
    }

    if (progressToastId != null) {
      updateToast(progressToastId, {
        message: t("common.sending"),
        detail: undefined,
        progress: 90,
      });
    }

    try {
      await onSend({
        message: messageText,
        attachments: outbound,
        subject: templateSubject?.trim() || undefined,
      });
    } catch {
      // Keep draft so the user can retry; caller shows the error toast.
      finishProgress(false);
      setPreparing(false);
      return;
    }

    // Close progress in the same turn the message lands in the thread.
    finishProgress(true);
    setDraft("");
    setTemplateSubject(null);
    setAttachments([]);
    setLinkOpen(false);
    setEmojiOpen(false);
    setTemplateOpen(false);
    setPreparing(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  const toolBtn =
    "flex h-9 w-9 items-center justify-center rounded-lg text-mute transition-colors hover:bg-ash hover:text-ink";
  const sendToneClass =
    sendTone === "danger"
      ? "compose-send-danger bg-sale text-white hover:bg-pink-deep"
      : "compose-send-accent bg-accent text-white hover:bg-accent-deep";

  return (
    <div className="space-y-2">
      {attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((file) => (
            <li
              key={file.id}
              className="flex max-w-full items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs"
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
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-canvas p-2.5">
          <label className="min-w-40 flex-1 text-xs">
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
          <label className="min-w-32 flex-1 text-xs">
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
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                sendTone === "danger"
                  ? "compose-send-danger bg-sale hover:bg-pink-deep"
                  : "compose-send-accent bg-accent hover:bg-accent-deep"
              }`}
            >
              {t("pages.inbox.insertLink")}
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={`relative overflow-hidden rounded-2xl border bg-panel crm-compose-shell focus-within:border-accent/50 ${
          dragOver ? "border-accent bg-accent-soft/40" : "border-line"
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        {templateSubject ? (
          <div className="flex items-start gap-2 border-b border-line/70 bg-ash/40 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">
                {t("pages.inbox.templateSubject")}
              </p>
              <p className="truncate text-sm text-ink">{templateSubject}</p>
            </div>
            <button
              type="button"
              onClick={() => setTemplateSubject(null)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-mute hover:bg-panel hover:text-ink"
              aria-label={t("common.cancel")}
              title={t("common.cancel")}
            >
              ×
            </button>
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          rows={draft.includes("\n") || draft.length > 120 ? 4 : 2}
          value={draft}
          disabled={disabled || busy}
          onChange={(e) => {
            setDraft(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            resizeTextarea(e.target);
          }}
          onSelect={(e) => {
            const el = e.currentTarget;
            setCaret(el.selectionStart ?? el.value.length);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (canSend) void handleSend();
            }
          }}
          placeholder={placeholder}
          className="compose-scroll max-h-60 min-h-14 w-full resize-none border-0 bg-transparent px-3.5 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-mute/70"
        />
        <MentionMenu
          draft={draft}
          caret={caret}
          candidates={mentionCandidates}
          onPick={(insert, range) => {
            const next = `${draft.slice(0, range.start)}${insert} ${draft.slice(range.end)}`;
            setDraft(next);
            const pos = range.start + insert.length + 1;
            setCaret(pos);
            requestAnimationFrame(() => {
              const el = textareaRef.current;
              if (!el) return;
              el.focus();
              el.setSelectionRange(pos, pos);
              resizeTextarea(el);
            });
          }}
        />

        <div className="relative flex items-center gap-1 border-t border-line/70 px-1.5 py-1.5">
          <input
            id={fileInputId}
            type="file"
            multiple
            accept="*/*"
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {mode === "note" ? null : (
            <label
              htmlFor={fileInputId}
              className={toolBtn}
              title={t("pages.inbox.attachFiles")}
              aria-label={t("pages.inbox.attachFiles")}
            >
              <AttachIcon />
            </label>
          )}
          <button
            ref={templateBtnRef}
            type="button"
            onClick={() => {
              setLinkOpen(false);
              setEmojiOpen(false);
              setTemplateOpen((open) => !open);
            }}
            className={`${toolBtn} ${templateOpen ? "bg-ash text-ink" : ""}`}
            title={t("pages.inbox.messageTemplates")}
            aria-label={t("pages.inbox.messageTemplates")}
            aria-expanded={templateOpen}
          >
            <TemplateIcon />
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkOpen(false);
              setTemplateOpen(false);
              setEmojiOpen((open) => !open);
            }}
            className={`${toolBtn} ${emojiOpen ? "bg-ash text-ink" : ""}`}
            title={t("pages.inbox.emojiPicker")}
            aria-label={t("pages.inbox.emojiPicker")}
            aria-expanded={emojiOpen}
          >
            <EmojiIcon />
          </button>
          {variant === "chatter" || mode === "note" ? null : (
            <button
              type="button"
              onClick={() => {
                setEmojiOpen(false);
                setTemplateOpen(false);
                setLinkOpen((open) => !open);
              }}
              className={`${toolBtn} ${linkOpen ? "bg-ash text-ink" : ""}`}
              title={t("pages.inbox.addLink")}
              aria-label={t("pages.inbox.addLink")}
            >
              <LinkIcon />
            </button>
          )}
          {mode === "message" && onOpenFullComposer ? (
            <button
              type="button"
              onClick={onOpenFullComposer}
              className={toolBtn}
              title={t("pages.inbox.openFullComposer")}
              aria-label={t("pages.inbox.openFullComposer")}
            >
              <ExpandIcon />
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-2 pr-0.5">
            <span className="hidden text-[10px] text-mute sm:inline">
              {t("pages.inbox.sendHint")}
            </span>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label={
                mode === "note" ? t("pages.inbox.logNote") : t("pages.inbox.send")
              }
              className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${sendToneClass}`}
            >
              {busy ? (
                "…"
              ) : (
                <>
                  <SendIcon />
                  <span className="hidden sm:inline">
                    {mode === "note"
                      ? t("pages.inbox.logNote")
                      : t("pages.inbox.send")}
                  </span>
                </>
              )}
            </button>
          </div>

          <EmojiPicker
            open={emojiOpen}
            onClose={() => setEmojiOpen(false)}
            onPick={(emoji) => {
              insertAtCursor(emoji);
              setEmojiOpen(false);
            }}
          />
          <MessageTemplatePicker
            open={templateOpen}
            onClose={() => setTemplateOpen(false)}
            modelHint={templateModels}
            anchorRef={templateBtnRef}
            onPick={(tpl) => applyTemplate(tpl.body, tpl.subject)}
            onSaveAsTemplate={saveAsTemplate}
          />
        </div>
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

function EmojiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="6.6" cy="7.6" r="0.9" fill="currentColor" />
      <circle cx="11.4" cy="7.6" r="0.9" fill="currentColor" />
      <path
        d="M6.2 10.4c.8 1.2 1.8 1.8 2.8 1.8s2-.6 2.8-1.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M4.5 3.5h9v11h-9z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 6.5h5M6.5 9h5M6.5 11.5h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M3.5 7V3.5H7M11 3.5h3.5V7M14.5 11v3.5H11M7 14.5H3.5V11"
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
