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
  const [mailError, setMailError] = useState<ApiError | null>(null);
  const [mailLoading, setMailLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [tab, setTab] = useState<"mail" | "forms">("mail");
  const [conn, setConn] = useState<InboxStatus | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

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

  useEffect(() => {
    void loadStatus();
    loadMail().finally(() => setMailLoading(false));
  }, [loadMail, loadStatus]);

  async function syncMail() {
    setSyncing(true);
    try {
      const res = await fetch("/api/inbox/mail", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setMailError(json as ApiError);
        pushToast((json as ApiError).error || "Sync failed");
        return;
      }
      setMailError(null);
      setMail((json as { messages: MailMessage[] }).messages ?? []);
      pushToast(`Synced ${(json as { synced?: number }).synced ?? 0} messages`);
      void loadStatus();
    } finally {
      setSyncing(false);
    }
  }

  async function sendReply(input: {
    toEmail: string;
    toName?: string;
    subject: string;
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
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast((json as ApiError).error || "Reply failed");
        return;
      }
      pushToast(`Reply sent via Brevo to ${input.toEmail}`);
      setReplyText("");
    } finally {
      setReplying(false);
    }
  }

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
        description="Namecheap mailbox in · Brevo replies out · site forms in Supabase"
        action={
          <button
            type="button"
            className={btnPrimary}
            disabled={syncing || !conn?.namecheap.ready}
            onClick={() => void syncMail()}
            title={
              conn?.namecheap.ready
                ? "Pull latest mail from Namecheap"
                : "Add IMAP_PASSWORD to .env.local first"
            }
          >
            {syncing ? "Syncing…" : "Sync Namecheap"}
          </button>
        }
      />

      {conn ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <ConnCard
            title="Namecheap (receive)"
            ready={conn.namecheap.ready}
            detail={`${conn.namecheap.user} @ ${conn.namecheap.host}`}
            missing={conn.namecheap.missing}
          />
          <ConnCard
            title="Brevo (send replies)"
            ready={conn.brevo.ready}
            detail={conn.brevo.sender || "Set BREVO_SENDER_EMAIL"}
            missing={conn.brevo.missing}
          />
          <ConnCard
            title="Supabase (store)"
            ready={conn.supabase.ready}
            detail="Mail + site form inquiries"
            missing={conn.supabase.missing}
          />
        </div>
      ) : null}

      {mailError ? (
        <div className="mb-4 border border-wine/40 bg-wine/10 px-4 py-3 text-sm">
          <p className="font-semibold text-pink">{mailError.error}</p>
          {mailError.missing?.length ? (
            <p className="mt-1 text-mute">{mailError.missing.join(", ")}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Mailbox"
          value={formatNumber(mail.length, false, locale)}
          hint="Namecheap IMAP"
        />
        <KpiCard
          label={t("common.open")}
          value={formatNumber(open, false, locale)}
          hint="Site forms"
        />
        <KpiCard
          label={t("pages.inbox.converted")}
          value={formatNumber(converted, false, locale)}
        />
        <KpiCard
          label="Brevo replies"
          value={conn?.brevo.ready ? "On" : "Off"}
          hint={conn?.brevo.sender || "API key needed"}
        />
      </div>

      <div className="-mx-3 mb-4 mt-6 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {(
          [
            { id: "mail" as const, label: "Email (Namecheap)" },
            { id: "forms" as const, label: "Site forms" },
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
        <Panel title={`${mail.length} emails`}>
          {mailLoading ? (
            <EmptyHint>Loading mailbox…</EmptyHint>
          ) : !conn?.namecheap.ready ? (
            <EmptyHint>
              Add <code className="text-sand">IMAP_PASSWORD</code> for{" "}
              {conn?.namecheap.user || "contact@inkamototours.com"} in
              .env.local, restart, then Sync Namecheap.
            </EmptyHint>
          ) : mail.length === 0 ? (
            <EmptyHint>
              Mailbox connected. Click <strong>Sync Namecheap</strong> to pull
              messages into the CRM.
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
                No site forms yet. Connect Webflow with{" "}
                <code className="text-sand">WEBHOOK_SECRET</code> later, or add
                inquiries in the CRM.
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
            <ReplyBox
              disabled={!conn?.brevo.ready || replying}
              value={replyText}
              onChange={setReplyText}
              onSend={() =>
                void sendReply({
                  toEmail: selectedMail.fromEmail,
                  toName: selectedMail.fromName || undefined,
                  subject: selectedMail.subject,
                })
              }
              hint={
                conn?.brevo.ready
                  ? "Sends via Brevo from contact@inkamototours.com"
                  : "Brevo not ready — check API key / sender"
              }
              sending={replying}
            />
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
            <ReplyBox
              disabled={!conn?.brevo.ready || replying}
              value={replyText}
              onChange={setReplyText}
              onSend={() =>
                void sendReply({
                  toEmail: selected.email,
                  toName: selected.name,
                  subject: selected.subject,
                })
              }
              hint={
                conn?.brevo.ready
                  ? "Reply via Brevo to this form contact"
                  : "Brevo not ready — check API key / sender"
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
  missing,
}: {
  title: string;
  ready: boolean;
  detail: string;
  missing: string[];
}) {
  return (
    <div className="border border-line bg-panel px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
          {title}
        </p>
        <StatusBadge tone={ready ? "success" : "warning"}>
          {ready ? "Ready" : "Needs env"}
        </StatusBadge>
      </div>
      <p className="mt-2 truncate text-sm text-ink">{detail}</p>
      {!ready && missing.length > 0 ? (
        <p className="mt-1 font-mono text-xs text-gold">{missing.join(", ")}</p>
      ) : null}
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
        Reply via Brevo
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
