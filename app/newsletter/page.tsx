"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  Field,
  inputClass,
  Modal,
} from "@/components/modal";
import { EmptyHint, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

type LiveCampaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  audience: string;
  recipients: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  scheduledAt: string | null;
  sentAt: string | null;
  preview: string;
};

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  blocked: boolean;
  addedAt: string | null;
};

type ApiError = { error: string; missing?: string[] };

function openRate(c: LiveCampaign) {
  if (!c.recipients) return 0;
  return (c.opens / c.recipients) * 100;
}

function clickRate(c: LiveCampaign) {
  if (!c.recipients) return 0;
  return (c.clicks / c.recipients) * 100;
}

function tone(status: string) {
  if (status === "sent") return "success" as const;
  if (status === "scheduled") return "info" as const;
  if (status === "archived") return "neutral" as const;
  return "warning" as const;
}

export default function NewsletterPage() {
  const { pushToast } = useCrm();
  const { t, locale } = useLocale();
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [selected, setSelected] = useState<LiveCampaign | null>(null);
  const [tab, setTab] = useState<"campaigns" | "subscribers">("campaigns");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscriberTotal, setSubscriberTotal] = useState(0);
  const [autoSubscribe, setAutoSubscribe] = useState(false);
  const [subscriberError, setSubscriberError] = useState<string | null>(null);
  const [newSubscriber, setNewSubscriber] = useState({ email: "", name: "" });
  const [addingSubscriber, setAddingSubscriber] = useState(false);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    preview: "",
    html: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/newsletter");
    const json = await res.json();
    if (!res.ok) {
      setError(json as ApiError);
      setCampaigns([]);
      return;
    }
    setError(null);
    setCampaigns((json as { campaigns: LiveCampaign[] }).campaigns ?? []);
  }, []);

  const loadSubscribers = useCallback(async () => {
    const res = await fetch("/api/newsletter/subscribers");
    const json = await res.json();
    if (!res.ok) {
      setSubscriberError((json as ApiError).error || t("pages.newsletter.loadFailed"));
      setSubscribers([]);
      setSubscriberTotal(0);
      return;
    }
    const data = json as {
      subscribers: Subscriber[];
      total: number;
      autoSubscribe: boolean;
    };
    setSubscriberError(null);
    setSubscribers(data.subscribers ?? []);
    setSubscriberTotal(data.total ?? 0);
    setAutoSubscribe(Boolean(data.autoSubscribe));
  }, [t]);

  useEffect(() => {
    void loadSubscribers();
    load().finally(() => setLoading(false));
  }, [load, loadSubscribers]);

  useEffect(() => {
    if (openAdd) void loadSubscribers();
  }, [openAdd, loadSubscribers]);

  const sendable = useMemo(
    () => subscribers.filter((s) => !s.blocked),
    [subscribers],
  );

  const visibleRecipients = useMemo(() => {
    const q = recipientQuery.trim().toLowerCase();
    if (!q) return sendable;
    return sendable.filter((s) =>
      `${s.email} ${s.name ?? ""}`.toLowerCase().includes(q),
    );
  }, [sendable, recipientQuery]);

  function toggleEmail(email: string) {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  }

  function closeComposer() {
    setOpenAdd(false);
    setRecipientQuery("");
    setSelectedEmails([]);
  }

  async function addSubscriber(e: React.FormEvent) {
    e.preventDefault();
    const email = newSubscriber.email.trim();
    if (!email) return;
    setAddingSubscriber(true);
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: newSubscriber.name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast((json as ApiError).error || t("pages.newsletter.addFailed"));
        return;
      }
      pushToast(t("pages.newsletter.addedToList", { email }));
      setNewSubscriber({ email: "", name: "" });
      await loadSubscribers();
    } finally {
      setAddingSubscriber(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) =>
      `${c.name} ${c.subject} ${c.audience}`.toLowerCase().includes(q),
    );
  }, [campaigns, query]);

  const sent = campaigns.filter((c) => c.status === "sent");
  const avgOpen =
    sent.length === 0
      ? 0
      : sent.reduce((s, c) => s + openRate(c), 0) / sent.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim()) return;
    if (selectedEmails.length === 0) {
      pushToast(t("pages.newsletter.needRecipient"));
      return;
    }
    setSending(true);
    try {
      const html =
        form.html.trim() ||
        `<div style="font-family:Georgia,serif"><h1>${form.subject}</h1><p>${form.preview || ""}</p></div>`;
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || form.subject.trim(),
          subject: form.subject.trim(),
          previewText: form.preview.trim(),
          htmlContent: html,
          emails: selectedEmails,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json as ApiError);
        pushToast((json as ApiError).error || t("pages.newsletter.sendFailed"));
        return;
      }
      pushToast(t("pages.newsletter.campaignSent"));
      closeComposer();
      setForm({ name: "", subject: "", preview: "", html: "" });
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("pages.newsletter.title")}
        description={t("pages.newsletter.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                void load();
                void loadSubscribers();
              }}
            >
              {t("pages.newsletter.refresh")}
            </button>
            <button type="button" className={btnPrimary} onClick={() => setOpenAdd(true)}>
              {t("pages.newsletter.newCampaign")}
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 border border-wine/40 bg-wine/10 px-4 py-3 text-sm">
          <p className="font-semibold text-pink">{error.error}</p>
          {error.missing?.length ? (
            <p className="mt-1 text-mute">{error.missing.join(", ")}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("common.subscribers")}
          value={formatNumber(subscriberTotal, false, locale)}
          hint={autoSubscribe ? t("pages.newsletter.autoFromEmail") : t("pages.newsletter.manualOnly")}
        />
        <KpiCard label={t("common.campaigns")} value={formatNumber(campaigns.length, false, locale)} />
        <KpiCard label={t("pages.newsletter.sent")} value={formatNumber(sent.length, false, locale)} />
        <KpiCard
          label={t("pages.newsletter.avgOpen")}
          value={formatPercent(avgOpen)}
          hint={t("pages.newsletter.fromStats")}
        />
      </div>

      <div className="-mx-3 mb-4 mt-6 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {(
          [
            { id: "campaigns" as const, label: t("pages.newsletter.tabCampaigns") },
            {
              id: "subscribers" as const,
              label: t("pages.newsletter.tabSubscribers", { n: subscriberTotal }),
            },
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

      {tab === "subscribers" ? (
        <div className="space-y-4">
          <Panel title={t("pages.newsletter.addSubscriber")}>
            <form className="grid gap-3 sm:grid-cols-[2fr_2fr_auto]" onSubmit={addSubscriber}>
              <input
                className={inputClass}
                type="email"
                placeholder={t("pages.newsletter.emailPlaceholder")}
                value={newSubscriber.email}
                onChange={(e) =>
                  setNewSubscriber({ ...newSubscriber, email: e.target.value })
                }
              />
              <input
                className={inputClass}
                placeholder={t("pages.newsletter.nameOptional")}
                value={newSubscriber.name}
                onChange={(e) =>
                  setNewSubscriber({ ...newSubscriber, name: e.target.value })
                }
              />
              <button
                type="submit"
                className={btnPrimary}
                disabled={addingSubscriber || !newSubscriber.email.trim()}
              >
                {addingSubscriber ? t("common.adding") : t("common.add")}
              </button>
            </form>
            <p className="mt-3 text-xs text-mute">
              {autoSubscribe
                ? t("pages.newsletter.autoOn")
                : t("pages.newsletter.autoOff")}
            </p>
          </Panel>

          <Panel title={t("pages.newsletter.subscriberCount", { n: subscribers.length })}>
            {subscriberError ? (
              <EmptyHint>{subscriberError}</EmptyHint>
            ) : subscribers.length === 0 ? (
              <EmptyHint>
                {t("pages.newsletter.noSubscribers")}
              </EmptyHint>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("common.email")}</th>
                      <th>{t("common.name")}</th>
                      <th>{t("common.source")}</th>
                      <th>{t("common.status")}</th>
                      <th>{t("common.added")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s) => (
                      <tr key={s.id}>
                        <td className="font-medium">{s.email}</td>
                        <td className="text-mute">{s.name || t("common.dash")}</td>
                        <td className="text-mute">
                          {s.source === "inbox"
                            ? t("sources.inbox")
                            : s.source === "website_form"
                              ? t("sources.website_form")
                              : s.source === "manual"
                                ? t("sources.manual")
                                : t("common.dash")}
                        </td>
                        <td>
                          <StatusBadge tone={s.blocked ? "warning" : "success"}>
                            {s.blocked
                              ? t("pages.newsletter.unsubscribed")
                              : t("pages.newsletter.subscribed")}
                          </StatusBadge>
                        </td>
                        <td className="whitespace-nowrap text-mute">
                          {s.addedAt
                            ? formatDate(s.addedAt.slice(0, 10), locale)
                            : t("common.dash")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === "campaigns" ? (
      <>
      <div className="mt-6">
        <input
          className={inputClass}
          placeholder={t("pages.newsletter.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <Panel title={t("pages.newsletter.campaignCount", { n: filtered.length })}>
          {loading ? (
            <EmptyHint>{t("pages.newsletter.loading")}</EmptyHint>
          ) : filtered.length === 0 ? (
            <EmptyHint>
              {t("pages.newsletter.noCampaigns")}
            </EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("pages.newsletter.campaign")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("common.delivered")}</th>
                    <th>{t("common.opens")}</th>
                    <th>{t("common.clicks")}</th>
                    <th>{t("common.sent")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-mute">{c.subject}</p>
                      </td>
                      <td>
                        <StatusBadge tone={tone(c.status)}>{t(`status.${c.status}`)}</StatusBadge>
                      </td>
                      <td>{formatNumber(c.recipients, false, locale)}</td>
                      <td>{formatPercent(openRate(c))}</td>
                      <td>{formatPercent(clickRate(c))}</td>
                      <td className="whitespace-nowrap text-mute">
                        {c.sentAt ? formatDate(c.sentAt.slice(0, 10), locale) : t("common.dash")}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setSelected(c)}
                        >
                          {t("common.open")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
      </>
      ) : null}

      <Modal open={openAdd} title={t("pages.newsletter.sendTitle")} onClose={closeComposer} wide>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label={t("pages.newsletter.internalName")}>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("pages.newsletter.namePlaceholder")}
            />
          </Field>
          <Field label={t("common.subject")}>
            <input
              required
              className={inputClass}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </Field>
          <Field label={t("pages.newsletter.previewText")}>
            <input
              className={inputClass}
              value={form.preview}
              onChange={(e) => setForm({ ...form, preview: e.target.value })}
            />
          </Field>
          <Field label={t("pages.newsletter.htmlBody")}>
            <textarea
              className={`${inputClass} min-h-32 font-mono text-xs`}
              value={form.html}
              onChange={(e) => setForm({ ...form, html: e.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
                {t("pages.newsletter.recipients")}
              </p>
              <p className="text-xs text-mute">
                {t("pages.newsletter.selectedCount", { n: selectedEmails.length })}
              </p>
            </div>
            <p className="text-xs text-mute">{t("pages.newsletter.pickRecipients")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setSelectedEmails(sendable.map((s) => s.email))}
                disabled={sendable.length === 0}
              >
                {t("pages.newsletter.selectAll")}
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setSelectedEmails([])}
                disabled={selectedEmails.length === 0}
              >
                {t("pages.newsletter.selectNone")}
              </button>
            </div>
            <input
              className={inputClass}
              placeholder={t("pages.newsletter.searchPeople")}
              value={recipientQuery}
              onChange={(e) => setRecipientQuery(e.target.value)}
            />
            {sendable.length === 0 ? (
              <p className="border border-line px-3 py-6 text-center text-sm text-mute">
                {t("pages.newsletter.noSendable")}
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto border border-line">
                {visibleRecipients.map((s) => {
                  const checked = selectedEmails.includes(s.email);
                  return (
                    <li key={s.id} className="border-b border-line last:border-b-0">
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-ash/50">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleEmail(s.email)}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {s.name || s.email}
                          </span>
                          {s.name ? (
                            <span className="block truncate text-xs text-mute">
                              {s.email}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-mute">
            {t("pages.newsletter.sendsNow")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={btnPrimary}
              disabled={sending || selectedEmails.length === 0}
            >
              {sending ? t("common.sending") : t("pages.newsletter.sendNow")}
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={closeComposer}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selected}
        title={selected?.name ?? t("pages.newsletter.campaign")}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-mute">{t("common.subject")}: </span>
              {selected.subject}
            </p>
            <p>
              <StatusBadge tone={tone(selected.status)}>{t(`status.${selected.status}`)}</StatusBadge>
            </p>
            <p>
              {t("pages.newsletter.statsLine", {
                delivered: formatNumber(selected.recipients, false, locale),
                opens: formatPercent(openRate(selected)),
                clicks: formatPercent(clickRate(selected)),
              })}
            </p>
            {selected.preview ? (
              <p className="text-mute">{selected.preview}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
