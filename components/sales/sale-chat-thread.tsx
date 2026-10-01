"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChatterMessage,
  MessageSelectionBar,
  getMessagePlainText,
} from "@/components/inbox/chatter-message";
import {
  MessageCompose,
  type MessageComposePayload,
} from "@/components/inbox/message-compose";
import { FullComposerModal } from "@/components/inbox/full-composer-modal";
import {
  ChatterToolbar,
  type ChatterMode,
} from "@/components/inbox/chatter-toolbar";
import { ScheduleActivityModal } from "@/components/inbox/schedule-activity-modal";
import { EditMessageModal } from "@/components/inbox/edit-message-modal";
import { EmptyHint } from "@/components/ui";
import { btnGhost, inputClass } from "@/components/modal";
import { readApiJson } from "@/lib/api-client";
import { useCrm } from "@/lib/crm-store";
import { useConfirm } from "@/lib/confirm";
import type { DeliveryStatus } from "@/lib/mail/delivery";
import { buildReplyFormData } from "@/lib/mail/compose-attachments";
import {
  displayContactName,
  groupMailRooms,
  type RoomMessage,
} from "@/lib/mail/rooms";
import { useLocale } from "@/lib/i18n";
import type { MailNote } from "@/lib/mail/notes";
import type { MailThreadFile } from "@/lib/mail/thread-files";
import { formatAttachmentBytes } from "@/lib/mail/compose-attachments";

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
  sentByEmail?: string | null;
  sentByName?: string | null;
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

function toWhatsAppUrl(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const q = text?.trim()
    ? `?text=${encodeURIComponent(text.trim())}`
    : "";
  return `https://wa.me/${digits}${q}`;
}

export function SaleChatPanel({
  email,
  customerName,
  title,
  phone,
  relatedType = "sale",
  relatedId,
}: {
  email: string;
  customerName: string;
  title?: string;
  phone?: string;
  relatedType?: "inquiry" | "lead" | "sale";
  relatedId?: string;
}) {
  const { t, locale } = useLocale();
  const { pushToast, followUps, updateFollowUpStatus } = useCrm();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [mail, setMail] = useState<MailMessage[]>([]);
  const [replies, setReplies] = useState<MailReply[]>([]);
  const [notes, setNotes] = useState<MailNote[]>([]);
  const [threadFiles, setThreadFiles] = useState<MailThreadFile[]>([]);
  const [ownAddresses, setOwnAddresses] = useState<(string | null)[]>([]);
  const [brevoReady, setBrevoReady] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [copyFlash, setCopyFlash] = useState(false);
  const [composeMode, setComposeMode] = useState<ChatterMode>("message");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filesOpen, setFilesOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RoomMessage | null>(null);
  const [editText, setEditText] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    setSelectedKeys([]);
    setBrevoReady(null);
    setComposeMode("message");
    setSearchOpen(false);
    setSearchQuery("");
  }, [email]);

  const canLoad = isClientEmail(email);
  const youLabel =
    t("pages.inbox.youPrefix").replace(/:\s*$/, "").trim() || "You";
  const threadKey = email.trim().toLowerCase();

  const loadConversation = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canLoad) {
        setMail([]);
        setReplies([]);
        setNotes([]);
        setThreadFiles([]);
        return;
      }

      const silent = !!opts?.silent;
      if (!silent) setLoading(true);
      try {
        const emailParam = encodeURIComponent(email.trim());
        const [statusRes, mailRes, repliesRes, notesRes, filesRes] =
          await Promise.all([
            fetch("/api/inbox/status"),
            fetch(`/api/inbox/mail?locale=${locale}&email=${emailParam}`),
            fetch(`/api/inbox/replies?locale=${locale}&email=${emailParam}`),
            fetch(`/api/inbox/notes?email=${emailParam}`),
            fetch(`/api/inbox/thread-files?email=${emailParam}`),
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
        } else if (!silent) setMail([]);

        if (repliesRes.ok) {
          const json = (await repliesRes.json()) as { replies?: MailReply[] };
          setReplies(json.replies ?? []);
        } else if (!silent) setReplies([]);

        if (notesRes.ok) {
          const json = (await notesRes.json()) as { notes?: MailNote[] };
          setNotes(json.notes ?? []);
        }
        if (filesRes.ok) {
          const json = (await filesRes.json()) as { files?: MailThreadFile[] };
          setThreadFiles(json.files ?? []);
        }
      } catch {
        if (!silent) {
          setMail([]);
          setReplies([]);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [canLoad, email, locale],
  );

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!canLoad) return;
    const id = window.setInterval(() => {
      void loadConversation({ silent: true });
    }, 15_000);
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
      openedEmails: [threadKey],
      youPrefix: t("pages.inbox.youPrefix"),
      emptyPreview: t("pages.inbox.noMessage"),
    }).find((row) => row.email === threadKey);
  }, [canLoad, mail, ownAddresses, replies, t, threadKey]);

  const messages = useMemo(() => {
    const base = (room?.messages ?? []).map((m) => {
      const replyId = m.key.startsWith("out-") && !m.key.startsWith("out-mail-")
        ? m.key.slice(4)
        : null;
      return {
        ...m,
        editableId: replyId || undefined,
        editableKind: replyId ? ("reply" as const) : undefined,
      };
    });
    const noteMsgs: RoomMessage[] = notes.map((note) => ({
      key: `note-${note.id}`,
      mine: true,
      at: note.createdAt,
      subject: "Note",
      authorName: note.authorName || youLabel,
      clean: { text: note.bodyText, fields: [], quoted: null, isForm: false, trimmed: false },
      raw: note.bodyText,
      sentByName: note.authorName,
      isNote: true,
      editableId: note.id,
      editableKind: "note",
    }));
    return [...base, ...noteMsgs].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  }, [notes, room?.messages, youLabel]);

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      const hay = `${m.clean.text} ${m.subject} ${m.authorName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [messages, searchQuery]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || searchQuery.trim()) return;
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
  }, [messages.length, email, searchQuery]);

  const displayName = displayContactName(customerName, email);
  const whatsappUrl = phone ? toWhatsAppUrl(phone) : null;

  const planned = useMemo(() => {
    if (!followUps) return [];
    return followUps.filter(
      (fu) =>
        fu.status === "open" &&
        (fu.relatedId === relatedId ||
          fu.relatedTo.toLowerCase().includes(threadKey) ||
          fu.relatedTo.toLowerCase().includes(customerName.toLowerCase())),
    );
  }, [customerName, followUps, relatedId, threadKey]);

  async function sendMessage(payload: MessageComposePayload) {
    if ((!payload.message && payload.attachments.length === 0) || !canLoad) {
      return;
    }
    if (composeMode === "note") {
      setSending(true);
      try {
        const res = await fetch("/api/inbox/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadEmail: threadKey,
            bodyText: payload.message,
            relatedSaleId: relatedType === "sale" ? relatedId : undefined,
          }),
        });
        const parsed = await readApiJson<{ note?: MailNote }>(res);
        if (!parsed.ok) throw new Error(parsed.error || t("pages.inbox.sendFailed"));
        if (parsed.data.note) {
          setNotes((prev) => [...prev, parsed.data.note!]);
        }
      } catch (err) {
        pushToast(err instanceof Error ? err.message : t("pages.inbox.sendFailed"));
        throw err;
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      const form = buildReplyFormData({
        toEmail: threadKey,
        toName: customerName.trim() || undefined,
        subject: payload.subject,
        inReplyToSubject: room?.lastSubject,
        message: payload.message,
        messageHtml: payload.messageHtml,
        ccEmails: payload.ccEmails,
        relatedMailId: room?.lastMailId,
        attachments: payload.attachments,
      });
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        body: form,
      });
      const parsed = await readApiJson<{ reply?: MailReply | null }>(res);
      if (!parsed.ok) {
        throw new Error(parsed.error || t("pages.inbox.sendFailed"));
      }
      const saved = parsed.data.reply;
      if (saved) {
        setReplies((prev) =>
          prev.some((row) => row.id === saved.id) ? prev : [saved, ...prev],
        );
      }
      void loadConversation({ silent: true });
    } catch (err) {
      pushToast(err instanceof Error ? err.message : t("pages.inbox.sendFailed"));
      throw err;
    } finally {
      setSending(false);
    }
  }

  async function deleteSelectedMessages() {
    if (selectedKeys.length === 0) return;
    const keys = [...selectedKeys];
    const ok = await confirm({
      title: t("pages.inbox.deleteMessage"),
      message: t("pages.inbox.deleteMessageConfirm"),
      confirmLabel: t("common.delete"),
      danger: true,
      run: async () => {
        for (const key of keys) {
          if (key.startsWith("note-")) {
            const id = key.slice(5);
            const res = await fetch(`/api/inbox/notes?id=${encodeURIComponent(id)}`, {
              method: "DELETE",
            });
            const parsed = await readApiJson(res);
            if (!parsed.ok) throw new Error(parsed.error || t("pages.inbox.deleteFailed"));
            continue;
          }
          const res = await fetch("/api/inbox/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "message", key }),
          });
          const parsed = await readApiJson(res);
          if (!parsed.ok) {
            pushToast(parsed.error || t("pages.inbox.deleteFailed"));
            throw new Error(parsed.error || t("pages.inbox.deleteFailed"));
          }
        }
        setReplies((prev) =>
          prev.filter((row) => !keys.includes(`out-${row.id}`)),
        );
        setMail((prev) =>
          prev.filter(
            (row) =>
              !keys.includes(`in-${row.id}`) &&
              !keys.includes(`out-mail-${row.id}`),
          ),
        );
        setNotes((prev) =>
          prev.filter((n) => !keys.includes(`note-${n.id}`)),
        );
        setSelectedKeys([]);
        pushToast(t("pages.inbox.messageDeleted"));
        void loadConversation({ silent: true });
      },
    });
    if (!ok) return;
  }

  async function copySelectedMessages() {
    if (selectedKeys.length === 0) return;
    const chunks = messages
      .filter((message) => selectedKeys.includes(message.key))
      .map((message) => getMessagePlainText(message))
      .filter(Boolean);
    if (!chunks.length) return;
    try {
      await navigator.clipboard.writeText(chunks.join("\n\n"));
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1200);
      setSelectedKeys([]);
    } catch {
      pushToast(t("pages.inbox.deleteFailed"));
    }
  }

  async function uploadThreadFile(fileList: FileList | null) {
    if (!fileList?.length) return;
    for (const file of Array.from(fileList)) {
      const form = new FormData();
      form.set("threadEmail", threadKey);
      form.append("file", file);
      const res = await fetch("/api/inbox/thread-files", {
        method: "POST",
        body: form,
      });
      const parsed = await readApiJson<{ file?: MailThreadFile }>(res);
      if (!parsed.ok) {
        pushToast(parsed.error || t("pages.inbox.uploadFailed"));
        continue;
      }
      if (parsed.data.file) {
        setThreadFiles((prev) => [parsed.data.file!, ...prev]);
      }
    }
  }

  async function saveEdit() {
    if (!editTarget?.editableId || !editText.trim()) return;
    const kind = editTarget.editableKind;
    try {
      if (kind === "note") {
        const res = await fetch("/api/inbox/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editTarget.editableId, bodyText: editText }),
        });
        const parsed = await readApiJson<{ note?: MailNote }>(res);
        if (!parsed.ok) throw new Error(parsed.error);
        if (parsed.data.note) {
          setNotes((prev) =>
            prev.map((n) => (n.id === parsed.data.note!.id ? parsed.data.note! : n)),
          );
        }
      } else {
        const res = await fetch("/api/inbox/edit-reply", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editTarget.editableId, bodyText: editText }),
        });
        const parsed = await readApiJson<{ reply?: MailReply }>(res);
        if (!parsed.ok) throw new Error(parsed.error);
        if (parsed.data.reply) {
          setReplies((prev) =>
            prev.map((r) =>
              r.id === parsed.data.reply!.id ? { ...r, ...parsed.data.reply! } : r,
            ),
          );
        }
      }
      setEditTarget(null);
      pushToast(t("pages.inbox.messageUpdated"));
    } catch (err) {
      pushToast(err instanceof Error ? err.message : t("pages.inbox.editFailed"));
    }
  }

  async function translateMessage(message: RoomMessage) {
    try {
      const res = await fetch("/api/inbox/translate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: message.clean.text || message.raw,
          locale,
        }),
      });
      const parsed = await readApiJson<{ translated?: string }>(res);
      if (!parsed.ok) throw new Error(parsed.error);
      pushToast(parsed.data.translated || t("pages.inbox.translateMessage"));
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : t("pages.inbox.translateFailed"),
      );
    }
  }

  return (
    <aside className="crm-panel-lift flex h-full min-h-0 min-w-0 flex-col border-l-0 lg:border-l lg:border-line/80">
      {selectedKeys.length > 0 ? (
        <MessageSelectionBar
          count={selectedKeys.length}
          copying={copyFlash}
          onClear={() => setSelectedKeys([])}
          onCopy={() => void copySelectedMessages()}
          onDelete={() => void deleteSelectedMessages()}
        />
      ) : (
        <header className="shrink-0 border-b border-line px-4 py-2.5">
          <p className="text-[13px] font-semibold text-ink">
            {title || t("pages.sales.clientMessages")}
          </p>
          {email ? (
            <p className="mt-0.5 truncate text-xs text-mute">{email}</p>
          ) : null}
        </header>
      )}

      {canLoad && selectedKeys.length === 0 ? (
        <ChatterToolbar
          mode={composeMode}
          onModeChange={setComposeMode}
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((v) => !v)}
          filesOpen={filesOpen}
          onToggleFiles={() => setFilesOpen((v) => !v)}
          onScheduleActivity={() => setActivityOpen(true)}
          whatsappUrl={whatsappUrl}
        />
      ) : null}

      {searchOpen ? (
        <div className="border-b border-line/80 bg-ash/30 px-3 py-3">
          <input
            className={`${inputClass} text-sm`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("pages.inbox.searchMessagesPlaceholder")}
            autoFocus
          />
          {searchQuery.trim() ? (
            <ul className="mt-2.5 max-h-32 space-y-1 overflow-y-auto">
              {filteredMessages.map((m) => (
                <li key={`hit-${m.key}`}>
                  <button
                    type="button"
                    className="w-full truncate rounded-xl border border-transparent px-3 py-2 text-left text-xs text-mute transition-colors hover:border-line/70 hover:bg-panel hover:text-ink"
                    onClick={() => {
                      messageRefs.current.get(m.key)?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }}
                  >
                    <span className="font-semibold text-gold/90">
                      {t("pages.inbox.jump")}
                    </span>
                    <span className="text-mute"> · </span>
                    {m.clean.text.slice(0, 80)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {filesOpen ? (
        <div className="space-y-2.5 border-b border-line/80 bg-ash/30 px-3 py-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
              {t("pages.inbox.files")}
            </p>
            <label className={`${btnGhost} cursor-pointer`}>
              {t("pages.inbox.attachFiles")}
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void uploadThreadFile(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <ul className="space-y-1.5">
            {threadFiles.length === 0 ? (
              <li className="rounded-xl border border-dashed border-line/70 px-3 py-4 text-center text-mute">
                {t("pages.inbox.noFiles")}
              </li>
            ) : (
              threadFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line/60 bg-panel/80 px-3 py-2"
                >
                  <a
                    className="truncate font-medium text-accent hover:underline"
                    href={`/api/inbox/thread-files?download=${file.id}`}
                  >
                    {file.fileName} · {formatAttachmentBytes(file.byteSize)}
                  </a>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-mute transition-colors hover:bg-ash hover:text-pink"
                    onClick={() =>
                      void fetch(`/api/inbox/thread-files?id=${file.id}`, {
                        method: "DELETE",
                      }).then(() =>
                        setThreadFiles((prev) => prev.filter((x) => x.id !== file.id)),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {planned.length > 0 ? (
        <div className="space-y-2 border-b border-line/80 bg-ash/20 px-3 py-3 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
            {t("pages.inbox.plannedActivities")}
          </p>
          {planned.map((fu) => (
            <div
              key={fu.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-line/60 bg-panel/80 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{fu.title}</p>
                <p className="mt-0.5 text-mute">{fu.dueAt}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-line/70 bg-ash/50 px-3 py-1.5 text-[11px] font-semibold text-mute transition-colors hover:border-gold/40 hover:text-ink"
                onClick={() => void updateFollowUpStatus(fu.id, "done")}
              >
                {t("pages.inbox.markDone")}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="crm-chat-stage flex min-h-0 flex-1 flex-col">
        <div
          ref={threadRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3"
        >
        {!canLoad ? (
          <EmptyHint>{t("pages.sales.clientEmailMissing")}</EmptyHint>
        ) : loading ? (
          <p className="px-2 py-4 text-sm text-mute">{t("common.loading")}</p>
        ) : filteredMessages.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-4 text-center">
            <p className="text-sm font-medium text-ink">
              {searchQuery.trim()
                ? t("pages.inbox.nothingMatches")
                : t("pages.sales.noClientMessages")}
            </p>
            {!searchQuery.trim() ? (
              <p className="mt-1 max-w-64 text-xs text-mute">
                {t("pages.contacts.chatEmptyHint")}
              </p>
            ) : null}
          </div>
        ) : (
          filteredMessages.map((message) => (
            <div
              key={message.key}
              ref={(el) => {
                if (el) messageRefs.current.set(message.key, el);
                else messageRefs.current.delete(message.key);
              }}
            >
              <ChatterMessage
                message={message}
                youLabel={youLabel}
                selected={selectedKeys.includes(message.key)}
                selectionActive={selectedKeys.length > 0}
                onToggleSelect={() =>
                  setSelectedKeys((prev) =>
                    prev.includes(message.key)
                      ? prev.filter((row) => row !== message.key)
                      : [...prev, message.key],
                  )
                }
                onEdit={(m) => {
                  setEditTarget(m);
                  setEditText(m.clean.text || m.raw);
                }}
                onTranslate={(m) => void translateMessage(m)}
              />
            </div>
          ))
        )}
      </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-ash/40 p-3 sm:p-4">
        {selectedKeys.length > 0 || !canLoad ? null : composeMode === "note" ||
          brevoReady === true ? (
          <MessageCompose
            placeholder={
              composeMode === "note"
                ? t("pages.inbox.notePlaceholder")
                : t("pages.inbox.messagePlaceholder", { name: displayName })
            }
            sending={sending}
            variant="chatter"
            sendTone="danger"
            mode={composeMode}
            recipientName={displayName}
            templateModels={["sale.order", "res.partner", "crm.lead", "account.move"]}
            onOpenFullComposer={
              composeMode === "message" ? () => setFullOpen(true) : undefined
            }
            onSend={sendMessage}
          />
        ) : brevoReady === false ? (
          <p className="text-xs text-gold">{t("pages.inbox.sendingMissing")}</p>
        ) : null}
      </footer>

      <FullComposerModal
        open={fullOpen}
        onClose={() => setFullOpen(false)}
        initialToEmail={threadKey}
        initialToName={displayName}
        initialSubject={room?.lastSubject}
        templateModels={["sale.order", "res.partner", "crm.lead", "account.move"]}
        onSend={async (payload) => {
          await sendMessage({
            message: payload.message,
            messageHtml: payload.messageHtml,
            subject: payload.subject,
            ccEmails: payload.ccEmails,
            attachments: payload.attachments,
          });
        }}
      />

      <ScheduleActivityModal
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        relatedTo={displayName || email}
        relatedType={relatedType}
        relatedId={relatedId || threadKey}
      />

      <EditMessageModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        value={editText}
        onChange={setEditText}
        onSave={() => void saveEdit()}
        isNote={editTarget?.isNote}
      />
    </aside>
  );
}

/** Compact embed for legacy modal use — prefer SaleChatPanel on the detail page. */
export function SaleChatThread({ email }: { email: string }) {
  return (
    <div className="min-h-80">
      <SaleChatPanel email={email} customerName="" />
    </div>
  );
}
