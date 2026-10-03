"use client";

import { useEffect, useId, useMemo, useRef, useState, forwardRef } from "react";
import { HtmlEditor } from "@/components/html-editor";
import {
  Modal,
  btnGhost,
  btnPrimary,
  btnSecondary,
  composeInputClass,
  composeRowClass,
  inputClass,
} from "@/components/modal";
import { EmojiPicker } from "@/components/inbox/emoji-picker";
import { MessageTemplatePicker } from "@/components/inbox/message-template-picker";
import {
  COMPOSE_MAX_FILES,
  formatAttachmentBytes,
  pendingToOutbound,
  resolveMimeType,
  validatePendingAttachments,
  type OutboundAttachment,
  type PendingAttachment,
} from "@/lib/mail/compose-attachments";
import {
  personalizeTemplateBody,
  saveCustomMessageTemplate,
  type MessageTemplateModel,
} from "@/lib/mail/message-templates";
import { useCrm } from "@/lib/crm-store";
import { useLocale } from "@/lib/i18n";
import { loadSettings } from "@/lib/settings/storage";

export type FullComposerResult = {
  toEmail: string;
  toName?: string;
  subject: string;
  message: string;
  messageHtml: string;
  ccEmails: string[];
  attachments: OutboundAttachment[];
};

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ToolChip = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(function ToolChip({ active, children, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
        active
          ? "border-line bg-ash text-ink"
          : "border-line/80 bg-ash/40 text-mute hover:border-mute/40 hover:bg-ash hover:text-ink"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
});

export function FullComposerModal({
  open,
  onClose,
  initialToEmail,
  initialToName,
  initialSubject,
  initialBody,
  initialCc,
  templateModels,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  initialToEmail: string;
  initialToName?: string;
  initialSubject?: string;
  initialBody?: string;
  initialCc?: string[];
  templateModels?: MessageTemplateModel | MessageTemplateModel[];
  onSend: (payload: FullComposerResult) => Promise<void>;
}) {
  const { t } = useLocale();
  const { pushToast } = useCrm();
  const fileInputId = useId();
  const templateBtnRef = useRef<HTMLButtonElement>(null);
  const [toEmail, setToEmail] = useState(initialToEmail);
  const [toName, setToName] = useState(initialToName || "");
  const [subject, setSubject] = useState(initialSubject || "");
  const [html, setHtml] = useState(
    initialBody ? `<p>${initialBody.replace(/\n/g, "<br/>")}</p>` : "<p></p>",
  );
  const [ccInput, setCcInput] = useState("");
  const [ccEmails, setCcEmails] = useState<string[]>(initialCc ?? []);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [editorKey, setEditorKey] = useState("0");

  const hasAiKey = useMemo(() => {
    if (typeof window === "undefined") return false;
    const settings = loadSettings();
    const key = String(settings.openai_api_key ?? "").trim();
    return Boolean(key || process.env.NEXT_PUBLIC_OPENAI_CONFIGURED === "1");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setToEmail(initialToEmail);
    setToName(initialToName || "");
    setSubject(initialSubject || "");
    setHtml(
      initialBody ? `<p>${initialBody.replace(/\n/g, "<br/>")}</p>` : "<p></p>",
    );
    setCcEmails(initialCc ?? []);
    setCcInput("");
    setAttachments([]);
    setAiOpen(false);
    setEditorKey(String(Date.now()));
  }, [open, initialToEmail, initialToName, initialSubject, initialBody, initialCc]);

  function addCc() {
    const email = ccInput.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    setCcEmails((prev) => (prev.includes(email) ? prev : [...prev, email]));
    setCcInput("");
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
    if (next.length) setAttachments((prev) => [...prev, ...next]);
  }

  async function runAi() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;
    setAiBusy(true);
    try {
      const settings = loadSettings();
      const res = await fetch("/api/inbox/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          apiKey: String(settings.openai_api_key ?? "").trim() || undefined,
          context: `Recipient: ${toName || toEmail}. Subject: ${subject}`,
        }),
      });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error || t("pages.inbox.aiFailed"));
      const text = json.text || "";
      setHtml(`<p>${text.replace(/\n/g, "<br/>")}</p>`);
      setEditorKey(String(Date.now()));
      setAiOpen(false);
      setAiPrompt("");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : t("pages.inbox.aiFailed"));
    } finally {
      setAiBusy(false);
    }
  }

  async function handleSend() {
    const err = validatePendingAttachments(attachments, t);
    if (err) {
      pushToast(err);
      return;
    }
    const message = stripHtml(html);
    if (!toEmail.trim() || (!message && attachments.length === 0)) {
      pushToast(t("pages.inbox.sendFailed"));
      return;
    }
    setSending(true);
    try {
      const outbound = await pendingToOutbound(attachments);
      await onSend({
        toEmail: toEmail.trim(),
        toName: toName.trim() || undefined,
        subject: subject.trim() || t("pages.inbox.defaultSubject"),
        message,
        messageHtml: html,
        ccEmails,
        attachments: outbound,
      });
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : t("pages.inbox.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("pages.inbox.fullComposer")}
      subtitle={toName || toEmail || undefined}
      extraWide
      flush
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex flex-wrap items-center gap-1.5">
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
            <label htmlFor={fileInputId}>
              <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line/80 bg-ash/40 px-3 text-xs font-semibold text-mute transition-colors hover:border-mute/40 hover:bg-ash hover:text-ink">
                {t("pages.inbox.attachFiles")}
              </span>
            </label>
            <ToolChip
              ref={templateBtnRef}
              active={templateOpen}
              onClick={() => {
                setEmojiOpen(false);
                setAiOpen(false);
                setTemplateOpen((v) => !v);
              }}
            >
              {t("pages.inbox.messageTemplates")}
            </ToolChip>
            <ToolChip
              active={emojiOpen}
              onClick={() => {
                setTemplateOpen(false);
                setAiOpen(false);
                setEmojiOpen((v) => !v);
              }}
            >
              {t("pages.inbox.emojiPicker")}
            </ToolChip>
            <ToolChip
              active={aiOpen}
              onClick={() => {
                setTemplateOpen(false);
                setEmojiOpen(false);
                setAiOpen(true);
              }}
              title={
                hasAiKey
                  ? t("pages.inbox.aiGenerate")
                  : t("pages.inbox.aiNeedsKey")
              }
            >
              {t("pages.inbox.aiGenerate")}
            </ToolChip>
            <EmojiPicker
              open={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              onPick={(emoji) => {
                setHtml((prev) => `${prev}${emoji}`);
                setEditorKey(String(Date.now()));
                setEmojiOpen(false);
              }}
            />
            <MessageTemplatePicker
              open={templateOpen}
              onClose={() => setTemplateOpen(false)}
              modelHint={templateModels}
              anchorRef={templateBtnRef}
              onPick={(tpl) => {
                const body = personalizeTemplateBody(tpl.body, toName || toEmail);
                setSubject(tpl.subject || subject);
                setHtml(`<p>${body.replace(/\n/g, "<br/>")}</p>`);
                setEditorKey(String(Date.now()));
                setTemplateOpen(false);
              }}
              onSaveAsTemplate={() => {
                const body = stripHtml(html);
                const subj = subject.trim();
                if (!body && !subj) {
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
                    subject: subj,
                    body,
                    model,
                  });
                  pushToast({
                    message: t("pages.inbox.templateSaved"),
                    tone: "success",
                  });
                } catch (err) {
                  pushToast({
                    message:
                      err instanceof Error
                        ? err.message
                        : t("pages.inbox.templateSaveFailed"),
                    tone: "error",
                  });
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={btnSecondary} onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={sending}
              onClick={() => void handleSend()}
            >
              {sending ? "…" : t("pages.inbox.send")}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-col">
        <div className={composeRowClass}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
            {t("pages.inbox.recipients")}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              className={`${composeInputClass} min-w-[10rem] flex-[1.2]`}
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="email@example.com"
            />
            <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
            <input
              className={`${composeInputClass} min-w-[8rem] flex-1`}
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder={t("pages.inbox.recipientName")}
            />
          </div>
        </div>

        <div className={composeRowClass}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
            {t("pages.inbox.cc")}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {ccEmails.map((email) => (
              <span
                key={email}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent-soft/60 px-2.5 py-1 text-[11px] text-ink"
              >
                <span className="truncate">{email}</span>
                <button
                  type="button"
                  className="text-mute hover:text-pink"
                  onClick={() =>
                    setCcEmails((prev) => prev.filter((e) => e !== email))
                  }
                >
                  ×
                </button>
              </span>
            ))}
            <input
              className={`${composeInputClass} min-w-[9rem] flex-1`}
              value={ccInput}
              onChange={(e) => setCcInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addCc();
                }
              }}
              onBlur={addCc}
              placeholder={t("pages.inbox.ccPlaceholder")}
            />
          </div>
        </div>

        <div className={composeRowClass}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
            {t("pages.inbox.templateSubject")}
          </span>
          <input
            className={`${composeInputClass} font-medium`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("pages.inbox.defaultSubject")}
          />
        </div>

        <div className="border-b border-line/60 bg-canvas/30 px-3 py-3 sm:px-4">
          <HtmlEditor
            html={html}
            onChange={setHtml}
            resetKey={editorKey}
            minHeightClass="min-h-56"
          />
        </div>

        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-2 border-b border-line/60 px-4 py-3 sm:px-5">
            {attachments.map((file) => (
              <li
                key={file.id}
                className="flex max-w-full items-center gap-2 rounded-xl border border-line/80 bg-ash/50 px-3 py-2 text-xs"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel text-[10px] font-bold uppercase text-mute">
                  {file.fileName.split(".").pop()?.slice(0, 3) || "file"}
                </span>
                <span className="min-w-0 truncate font-medium text-ink">
                  {file.fileName}
                </span>
                <span className="shrink-0 text-mute">
                  {formatAttachmentBytes(file.byteSize)}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-mute hover:text-pink"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((r) => r.id !== file.id))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {aiOpen ? (
          <div className="mx-4 my-3 space-y-3 rounded-2xl border border-line bg-ash/40 p-4 sm:mx-5">
            <div>
              <p className="font-display text-lg tracking-wide text-ink">
                {t("pages.inbox.aiGenerate")}
              </p>
              <p className="mt-1 text-[12px] text-mute">
                {hasAiKey
                  ? t("pages.inbox.aiPromptPlaceholder")
                  : t("pages.inbox.aiNeedsKey")}
              </p>
            </div>
            <textarea
              rows={3}
              className={`${inputClass} resize-y`}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={t("pages.inbox.aiPromptPlaceholder")}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setAiOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={aiBusy || !aiPrompt.trim()}
                onClick={() => void runAi()}
              >
                {aiBusy ? "…" : t("pages.inbox.aiInsert")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
