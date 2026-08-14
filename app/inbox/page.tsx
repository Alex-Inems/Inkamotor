"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  inputClass,
  Modal,
} from "@/components/modal";
import { EmptyHint, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import {
  type InquiryChannel,
  type InquiryStatus,
  type SiteInquiry,
} from "@/lib/demo-data";
import { formatDate, formatNumber } from "@/lib/format";
import { inquiryTone } from "@/lib/status";
import { useLocale } from "@/lib/i18n";

const channelLabel: Record<InquiryChannel, string> = {
  contact_form: "Contact form",
  yanga_care: "Rider chat",
  product_question: "Product Q&A",
  shipping_help: "Shipping / track",
  wholesale: "Wholesale",
};

type MailMessage = {
  id: string;
  fromName: string | null;
  fromEmail: string;
  subject: string;
  preview: string;
  bodyText: string | null;
  receivedAt: string;
  isRead: boolean;
};

type MailReply = {
  id: string;
  toName: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  relatedMailId: string | null;
  relatedInquiryId: string | null;
  sentAt: string;
};

type ApiError = { error: string; missing?: string[] };

type ConnBlock = {
  ready: boolean;
  missing: string[];
  role: string;
  host?: string;
  user?: string;
  sender?: string | null;
};

type InboxStatus = {
  namecheap: ConnBlock;
  brevo: ConnBlock;
  supabase: ConnBlock;
};

export default function InboxPage() {
  const {
    siteInquiries,
    updateInquiryStatus,
    convertInquiryToLead,
    addFollowUp,
    addSale,
    pushToast,
  } = useCrm();
  const { t, locale } = useLocale();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InquiryStatus | "all">("all");
  const [selected, setSelected] = useState<SiteInquiry | null>(null);
  const [mail, setMail] = useState<MailMessage[]>([]);
  const [replies, setReplies] = useState<MailReply[]>([]);
  const [selectedReply, setSelectedReply] = useState<MailReply | null>(null);
  const [mailError, setMailError] = useState<ApiError | null>(null);
  const [mailLoading, setMailLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [tab, setTab] = useState<"mail" | "sent" | "forms">("mail");
  const [conn, setConn] = useState<InboxStatus | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const AUTO_SYNC_MS = 60_000;

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/inbox/status");
    if (res.ok) setConn((await res.json()) as InboxStatus);
  }, []);

  const loadMail = useCallback(async () => {
    const res = await fetch("/api/inbox/mail");
    const json = await res.json();
    if (!res.ok) {
      setMailError(json as ApiError);
      setMail([]);
      return;
    }
    setMailError(null);
    setMail((json as { messages: MailMessage[] }).messages ?? []);
  }, []);

  const loadReplies = useCallback(async () => {
    const res = await fetch("/api/inbox/replies");
    const json = await res.json();
    if (!res.ok) {
      // Table may not exist yet — don't block inbox
      setReplies([]);
      return;
    }
    setReplies((json as { replies: MailReply[] }).replies ?? []);
  }, []);

  const syncMail = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      setSyncing(true);
      try {
        const res = await fetch("/api/inbox/mail", { method: "POST" });
        const json = await res.json();
        if (!res.ok) {
          setMailError(json as ApiError);
          if (!silent) {
            pushToast((json as ApiError).error || "Sync failed");
          }
          return;
        }
        const synced = (json as { synced?: number }).synced ?? 0;
        setMailError(null);
        setMail((json as { messages: MailMessage[] }).messages ?? []);
        setLastSyncedAt(new Date().toISOString());
        void loadStatus();
        if (!silent || synced > 0) {
          pushToast(
            synced > 0
              ? `Synced ${synced} new message${synced === 1 ? "" : "s"}`
              : "Mailbox up to date",
          );
        }
      } finally {
        setSyncing(false);
      }
    },
    [loadStatus, pushToast],
  );

  useEffect(() => {
    void loadStatus();
    void loadReplies();
    loadMail().finally(() => setMailLoading(false));
  }, [loadMail, loadReplies, loadStatus]);

  // Auto-refresh inbox on open + every 60s while visible
  useEffect(() => {
    if (!conn?.namecheap.ready) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void syncMail({ silent: true });
    };

    run();
    timer = setInterval(run, AUTO_SYNC_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [conn?.namecheap.ready, syncMail]);

  async function sendReply(input: {
    toEmail: string;
    toName?: string;
    subject: string;
    relatedMailId?: string;
    relatedInquiryId?: string;
  }) {
    if (!replyText.trim()) {
      pushToast("Write a reply first");
      return;
    }
    setReplying(true);
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: input.toEmail,
          toName: input.toName,
          inReplyToSubject: input.subject,
          message: replyText.trim(),
          relatedMailId: input.relatedMailId,
          relatedInquiryId: input.relatedInquiryId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast((json as ApiError).error || "Reply failed");
        return;
      }
      pushToast(`Reply sent to ${input.toEmail}`);
      setReplyText("");
      if ((json as { storeWarning?: string }).storeWarning) {
        pushToast("Reply sent, but it couldn’t be saved to history yet.");
      }
      void loadReplies();
    } finally {
      setReplying(false);
    }
  }

  const threadForMail = useMemo(() => {
    if (!selectedMail) return [];
    return replies.filter(
      (r) =>
        r.relatedMailId === selectedMail.id ||
        r.toEmail.toLowerCase() === selectedMail.fromEmail.toLowerCase(),
    );
  }, [replies, selectedMail]);

  const threadForInquiry = useMemo(() => {
    if (!selected) return [];
    return replies.filter(
      (r) =>
        r.relatedInquiryId === selected.id ||
        r.toEmail.toLowerCase() === selected.email.toLowerCase(),
    );
  }, [replies, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return siteInquiries.filter((inq) => {
      if (status !== "all" && inq.status !== status) return false;
      if (!q) return true;
      return `${inq.name} ${inq.email} ${inq.subject} ${inq.message}`
        .toLowerCase()
        .includes(q);
    });
  }, [siteInquiries, query, status]);

  const open = siteInquiries.filter(
    (i) => i.status === "new" || i.status === "triaged",
  ).length;
  const converted = siteInquiries.filter((i) => i.status === "converted").length;

  return (
    <div>
      <PageHeader
        title={t("pages.inbox.title")}
        description={
          conn?.namecheap.ready
            ? `Inbox refreshes every minute · last update ${
                lastSyncedAt ? formatDate(lastSyncedAt, locale) : "pending"
              }`
            : "Incoming mail, your replies, and website form messages"
        }
        action={
          <button
            type="button"
            className={btnPrimary}
            disabled={syncing || !conn?.namecheap.ready}
            onClick={() => void syncMail({ silent: false })}
            title={
              conn?.namecheap.ready
                ? "Refresh inbox now"
                : "Mailbox not connected yet"
            }
          >
            {syncing ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {conn ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <ConnCard
            title="Incoming mail"
            ready={conn.namecheap.ready}
            detail={
              conn.namecheap.ready
                ? conn.namecheap.user || "Connected"
                : "Not connected yet"
            }
          />
          <ConnCard
            title="Replies"
            ready={conn.brevo.ready}
            detail={
              conn.brevo.ready
                ? `From ${conn.brevo.sender || "your team email"}`
                : "Sending not ready yet"
            }
          />
          <ConnCard
            title="Website forms"
            ready={conn.supabase.ready}
            detail={
              conn.supabase.ready
                ? "Contact form messages saved here"
                : "Not connected yet"
            }
          />
        </div>
      ) : null}

      {mailError ? (
        <div className="mb-4 border border-wine/40 bg-wine/10 px-4 py-3 text-sm">
          <p className="font-semibold text-pink">
            Couldn’t refresh the inbox right now. Try again in a moment.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Inbox"
          value={formatNumber(mail.length, false, locale)}
          hint="Incoming mail"
        />
        <KpiCard
          label="Open forms"
          value={formatNumber(open, false, locale)}
          hint="Website forms"
        />
        <KpiCard
          label={t("pages.inbox.converted")}
          value={formatNumber(converted, false, locale)}
        />
        <KpiCard
          label="Replies"
          value={formatNumber(replies.length, false, locale)}
          hint="Messages you sent"
        />
      </div>

      <div className="-mx-3 mb-4 mt-6 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {(
          [
            { id: "mail" as const, label: "Inbox" },
            { id: "sent" as const, label: `Replies (${replies.length})` },
            { id: "forms" as const, label: "Website forms" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] ${
              tab === item.id
                ? "bg-accent text-white"
                : "border border-line bg-panel text-ink hover:bg-ash"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "mail" ? (
        <Panel title={`${mail.length} messages`}>
          {mailLoading ? (
            <EmptyHint>Loading inbox…</EmptyHint>
          ) : !conn?.namecheap.ready ? (
            <EmptyHint>
              Incoming mail isn’t connected yet. Ask your admin to finish setup
              on the Setup page.
            </EmptyHint>
          ) : mail.length === 0 ? (
            <EmptyHint>
              Inbox is empty. New emails appear here automatically (or click{" "}
              <strong>Refresh</strong>).
            </EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>Subject</th>
                    <th>Preview</th>
                    <th>Received</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {mail.map((m) => (
                    <tr
                      key={m.id}
                      className={m.isRead ? "" : "bg-accent-soft/40"}
                    >
                      <td>
                        <p className="font-medium">
                          {m.fromName || m.fromEmail}
                        </p>
                        <p className="text-xs text-mute">{m.fromEmail}</p>
                      </td>
                      <td className="font-medium">{m.subject}</td>
                      <td className="max-w-xs truncate text-mute">
                        {m.preview}
                      </td>
                      <td className="whitespace-nowrap text-mute">
                        {formatDate(m.receivedAt.slice(0, 10), locale)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => {
                            setReplyText("");
                            setSelectedMail(m);
                          }}
                        >
                          Open / reply
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "sent" ? (
        <Panel title={`${replies.length} replies`}>
          {replies.length === 0 ? (
            <EmptyHint>
              No replies yet. Open a message and send a reply — it will show up
              here.
            </EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Preview</th>
                    <th>Sent</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {replies.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <p className="font-medium">{r.toName || r.toEmail}</p>
                        <p className="text-xs text-mute">{r.toEmail}</p>
                      </td>
                      <td className="font-medium">{r.subject}</td>
                      <td className="max-w-xs truncate text-mute">
                        {r.bodyText}
                      </td>
                      <td className="whitespace-nowrap text-mute">
                        {formatDate(r.sentAt.slice(0, 10), locale)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setSelectedReply(r)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "forms" ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <input
              className={inputClass}
              placeholder={t("pages.inbox.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={inputClass}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as InquiryStatus | "all")
              }
            >
              <option value="all">{t("pages.inbox.allStatuses")}</option>
              <option value="new">{t("status.new")}</option>
              <option value="triaged">{t("status.triaged")}</option>
              <option value="converted">{t("status.converted")}</option>
              <option value="closed">{t("status.closed")}</option>
            </select>
          </div>

          <Panel title={t("pages.inbox.inquiriesFrom", { n: filtered.length })}>
            {filtered.length === 0 ? (
              <EmptyHint>
                No website form messages yet. When someone submits a contact
                form, it will appear here.
              </EmptyHint>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("overview.from")}</th>
                      <th>{t("pages.inbox.channel")}</th>
                      <th>{t("overview.subject")}</th>
                      <th>{t("common.status")}</th>
                      <th>{t("pages.inbox.received")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inq) => (
                      <tr key={inq.id}>
                        <td>
                          <p className="font-medium">{inq.name}</p>
                          <p className="text-xs text-mute">{inq.email}</p>
                        </td>
                        <td className="text-mute">
                          {channelLabel[inq.channel]}
                        </td>
                        <td>
                          <p className="font-medium">{inq.subject}</p>
                          <p className="max-w-xs truncate text-xs text-mute">
                            {inq.page}
                          </p>
                        </td>
                        <td>
                          <StatusBadge tone={inquiryTone(inq.status)}>
                            {t(`status.${inq.status}`)}
                          </StatusBadge>
                        </td>
                        <td className="whitespace-nowrap text-mute">
                          {formatDate(inq.createdAt, locale)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => {
                              setReplyText("");
                              setSelected(inq);
                            }}
                          >
                            Open / reply
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}

      <Modal
        open={!!selectedMail}
        title={selectedMail?.subject ?? "Email"}
        onClose={() => setSelectedMail(null)}
        wide
      >
        {selectedMail ? (
          <div className="space-y-4 text-sm">
            <p>
              <span className="text-mute">From: </span>
              {selectedMail.fromName || selectedMail.fromEmail} &lt;
              {selectedMail.fromEmail}&gt;
            </p>
            <p className="text-mute">
              {formatDate(selectedMail.receivedAt.slice(0, 10), locale)}
            </p>
            <pre className="whitespace-pre-wrap border border-line bg-canvas p-3 text-sm leading-relaxed">
              {selectedMail.bodyText || selectedMail.preview}
            </pre>
            {threadForMail.length > 0 ? (
              <div className="space-y-3 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
                  Your replies ({threadForMail.length})
                </p>
                {threadForMail.map((r) => (
                  <div
                    key={r.id}
                    className="border border-line bg-ash/40 p-3"
                  >
                    <p className="text-xs text-mute">
                      Sent {formatDate(r.sentAt.slice(0, 10), locale)} ·{" "}
                      {r.subject}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {r.bodyText}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}
            <ReplyBox
              disabled={!conn?.brevo.ready || replying}
              value={replyText}
              onChange={setReplyText}
              onSend={() =>
                void sendReply({
                  toEmail: selectedMail.fromEmail,
                  toName: selectedMail.fromName || undefined,
                  subject: selectedMail.subject,
                  relatedMailId: selectedMail.id,
                })
              }
              hint={
                conn?.brevo.ready
                  ? "Sends from contact@inkamototours.com"
                  : "Replies aren’t set up yet — ask your admin"
              }
              sending={replying}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!selectedReply}
        title={selectedReply?.subject ?? "Sent reply"}
        onClose={() => setSelectedReply(null)}
        wide
      >
        {selectedReply ? (
          <div className="space-y-4 text-sm">
            <p>
              <span className="text-mute">To: </span>
              {selectedReply.toName || selectedReply.toEmail} &lt;
              {selectedReply.toEmail}&gt;
            </p>
            <p className="text-mute">
              Sent {formatDate(selectedReply.sentAt.slice(0, 10), locale)}
            </p>
            <StatusBadge tone="success">Sent</StatusBadge>
            <pre className="whitespace-pre-wrap border border-line bg-canvas p-3 text-sm leading-relaxed">
              {selectedReply.bodyText}
            </pre>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!selected}
        title={selected?.subject ?? "Inquiry"}
        onClose={() => setSelected(null)}
        wide
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{selected.name}</p>
                <p className="text-sm text-mute">{selected.email}</p>
                <p className="mt-1 text-xs text-mute">
                  {channelLabel[selected.channel]} · {selected.page}
                </p>
              </div>
              <StatusBadge tone={inquiryTone(selected.status)}>
                {selected.status}
              </StatusBadge>
            </div>
            <p className="text-sm leading-relaxed text-ink">
              {selected.message}
            </p>
            {threadForInquiry.length > 0 ? (
              <div className="space-y-3 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
                  Your replies ({threadForInquiry.length})
                </p>
                {threadForInquiry.map((r) => (
                  <div
                    key={r.id}
                    className="border border-line bg-ash/40 p-3"
                  >
                    <p className="text-xs text-mute">
                      Sent {formatDate(r.sentAt.slice(0, 10), locale)} ·{" "}
                      {r.subject}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {r.bodyText}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}
            <ReplyBox
              disabled={!conn?.brevo.ready || replying}
              value={replyText}
              onChange={setReplyText}
              onSend={() =>
                void sendReply({
                  toEmail: selected.email,
                  toName: selected.name,
                  subject: selected.subject,
                  relatedInquiryId: selected.id,
                })
              }
              hint={
                conn?.brevo.ready
                  ? "Reply to this form contact"
                  : "Replies aren’t set up yet — ask your admin"
              }
              sending={replying}
            />
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {selected.status === "new" ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    void updateInquiryStatus(selected.id, "triaged");
                    setSelected({ ...selected, status: "triaged" });
                  }}
                >
                  Mark triaged
                </button>
              ) : null}
              {!selected.leadId ? (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    void convertInquiryToLead(selected.id);
                    setSelected(null);
                  }}
                >
                  Convert to lead
                </button>
              ) : null}
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  void addFollowUp({
                    title: `Follow up: ${selected.subject}`,
                    relatedTo: selected.name,
                    relatedType: "inquiry",
                    relatedId: selected.id,
                    dueAt: new Date().toISOString().slice(0, 10),
                    owner: selected.owner,
                    notes: `From site ${channelLabel[selected.channel]}`,
                  });
                  setSelected(null);
                }}
              >
                Create follow-up
              </button>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  void addSale({
                    customer: selected.name,
                    email: selected.email,
                    product: selected.subject,
                    amount: selected.channel === "wholesale" ? 1500 : 89,
                    source: "website",
                    inquiryId: selected.id,
                    leadId: selected.leadId,
                    notes: `Sale started from site inquiry ${selected.id}`,
                  });
                  setSelected(null);
                }}
              >
                Create sale
              </button>
              {selected.status !== "closed" ? (
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => {
                    void updateInquiryStatus(selected.id, "closed");
                    setSelected({ ...selected, status: "closed" });
                  }}
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function ConnCard({
  title,
  ready,
  detail,
}: {
  title: string;
  ready: boolean;
  detail: string;
}) {
  return (
    <div className="border border-line bg-panel px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
          {title}
        </p>
        <StatusBadge tone={ready ? "success" : "warning"}>
          {ready ? "Ready" : "Setup needed"}
        </StatusBadge>
      </div>
      <p className="mt-2 truncate text-sm text-ink">{detail}</p>
    </div>
  );
}

function ReplyBox({
  value,
  onChange,
  onSend,
  disabled,
  hint,
  sending,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  hint: string;
  sending?: boolean;
}) {
  return (
    <div className="space-y-2 border border-line bg-ash/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
        Write a reply
      </p>
      <textarea
        className={`${inputClass} min-h-28`}
        placeholder="Write your reply…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mute">{hint}</p>
        <button
          type="button"
          className={btnPrimary}
          disabled={disabled || !value.trim()}
          onClick={onSend}
        >
          {sending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </div>
  );
}
