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
  blacklisted: boolean;
  createdAt: string | null;
  modifiedAt: string | null;
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
  const [tab, setTab] = useState<"campaigns" | "subscribers">("campaigns");
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [subsLoading, setSubsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [subQuery, setSubQuery] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [openAddSub, setOpenAddSub] = useState(false);
  const [selected, setSelected] = useState<LiveCampaign | null>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    preview: "",
    html: "",
  });
  const [subForm, setSubForm] = useState({ email: "", name: "" });

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
      setSubscribers([]);
      setSubTotal(0);
      return;
    }
    setSubscribers((json as { subscribers: Subscriber[] }).subscribers ?? []);
    setSubTotal((json as { total?: number }).total ?? 0);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    loadSubscribers().finally(() => setSubsLoading(false));
  }, [load, loadSubscribers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) =>
      `${c.name} ${c.subject} ${c.audience}`.toLowerCase().includes(q),
    );
  }, [campaigns, query]);

  const filteredSubs = useMemo(() => {
    const q = subQuery.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter((s) =>
      `${s.email} ${s.name ?? ""}`.toLowerCase().includes(q),
    );
  }, [subscribers, subQuery]);

  const sent = campaigns.filter((c) => c.status === "sent");
  const avgOpen =
    sent.length === 0
      ? 0
      : sent.reduce((s, c) => s + openRate(c), 0) / sent.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim()) return;
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
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json as ApiError);
        pushToast((json as ApiError).error || "Send failed");
        return;
      }
      pushToast("Campaign sent");
      setOpenAdd(false);
      setForm({ name: "", subject: "", preview: "", html: "" });
      await load();
    } finally {
      setSending(false);
    }
  }

  async function addSubscriber(e: React.FormEvent) {
    e.preventDefault();
    if (!subForm.email.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: subForm.email.trim(),
          name: subForm.name.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast((json as ApiError).error || "Could not add subscriber");
        return;
      }
      pushToast(`Added ${subForm.email.trim()} to the list`);
      setOpenAddSub(false);
      setSubForm({ email: "", name: "" });
      await loadSubscribers();
    } finally {
      setAdding(false);
    }
  }

  function refreshAll() {
    if (tab === "subscribers") {
      setSubsLoading(true);
      void loadSubscribers().finally(() => setSubsLoading(false));
    } else {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }
  }

  return (
    <div>
      <PageHeader
        title={t("pages.newsletter.title")}
        description="Campaigns go to your subscriber list. Anyone who emails the inbox is added automatically."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={refreshAll}>
              Refresh
            </button>
            {tab === "subscribers" ? (
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setOpenAddSub(true)}
              >
                Add subscriber
              </button>
            ) : (
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setOpenAdd(true)}
              >
                {t("pages.newsletter.newCampaign")}
              </button>
            )}
          </div>
        }
      />

      {error ? (
        <div className="mb-4 border border-wine/40 bg-wine/10 px-4 py-3 text-sm">
          <p className="font-semibold text-pink">{error.error}</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Subscribers"
          value={formatNumber(subTotal || subscribers.length, false, locale)}
          hint="On your list"
        />
        <KpiCard
          label="Campaigns"
          value={formatNumber(campaigns.length, false, locale)}
        />
        <KpiCard
          label="Sent"
          value={formatNumber(sent.length, false, locale)}
        />
        <KpiCard
          label="Avg open rate"
          value={formatPercent(avgOpen)}
          hint="From campaign stats"
        />
      </div>

      <div className="-mx-3 mb-4 mt-6 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {(
          [
            { id: "campaigns" as const, label: "Campaigns" },
            {
              id: "subscribers" as const,
              label: `Subscribers (${subTotal || subscribers.length})`,
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

      {tab === "campaigns" ? (
        <>
          <div className="mb-4">
            <input
              className={inputClass}
              placeholder="Search campaigns…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Panel title={`${filtered.length} campaigns`}>
            {loading ? (
              <EmptyHint>Loading campaigns…</EmptyHint>
            ) : filtered.length === 0 ? (
              <EmptyHint>
                No campaigns yet. Create one to email your subscriber list.
              </EmptyHint>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th>Delivered</th>
                      <th>Opens</th>
                      <th>Clicks</th>
                      <th>Sent</th>
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
                          <StatusBadge tone={tone(c.status)}>
                            {c.status}
                          </StatusBadge>
                        </td>
                        <td>{formatNumber(c.recipients, false, locale)}</td>
                        <td>{formatPercent(openRate(c))}</td>
                        <td>{formatPercent(clickRate(c))}</td>
                        <td className="whitespace-nowrap text-mute">
                          {c.sentAt
                            ? formatDate(c.sentAt.slice(0, 10), locale)
                            : "—"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => setSelected(c)}
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
        </>
      ) : (
        <>
          <div className="mb-4">
            <input
              className={inputClass}
              placeholder="Search subscribers…"
              value={subQuery}
              onChange={(e) => setSubQuery(e.target.value)}
            />
          </div>
          <Panel title={`${filteredSubs.length} subscribers`}>
            <p className="mb-3 text-sm text-mute">
              New inbox emails and website form contacts are added to this list
              automatically.
            </p>
            {subsLoading ? (
              <EmptyHint>Loading subscribers…</EmptyHint>
            ) : filteredSubs.length === 0 ? (
              <EmptyHint>
                No subscribers yet. They appear when someone emails the inbox,
                submits a website form, or you add them here.
              </EmptyHint>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Added</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map((s) => (
                      <tr key={s.id || s.email}>
                        <td className="font-medium">{s.name || "—"}</td>
                        <td>{s.email}</td>
                        <td className="whitespace-nowrap text-mute">
                          {s.createdAt
                            ? formatDate(s.createdAt.slice(0, 10), locale)
                            : "—"}
                        </td>
                        <td>
                          <StatusBadge
                            tone={s.blacklisted ? "warning" : "success"}
                          >
                            {s.blacklisted ? "Unsubscribed" : "Subscribed"}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      <Modal
        open={openAdd}
        title="Send newsletter"
        onClose={() => setOpenAdd(false)}
        wide
      >
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="Internal name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="April departures"
            />
          </Field>
          <Field label="Subject">
            <input
              required
              className={inputClass}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </Field>
          <Field label="Preview text">
            <input
              className={inputClass}
              value={form.preview}
              onChange={(e) => setForm({ ...form, preview: e.target.value })}
            />
          </Field>
          <Field label="HTML body (optional — leave blank for a simple template)">
            <textarea
              className={`${inputClass} min-h-32 font-mono text-xs`}
              value={form.html}
              onChange={(e) => setForm({ ...form, html: e.target.value })}
            />
          </Field>
          <p className="text-xs text-mute">
            Sends now to your subscriber list.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={sending}>
              {sending ? "Sending…" : "Send newsletter"}
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setOpenAdd(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openAddSub}
        title="Add subscriber"
        onClose={() => setOpenAddSub(false)}
      >
        <form className="grid gap-3" onSubmit={addSubscriber}>
          <Field label="Email">
            <input
              required
              type="email"
              className={inputClass}
              value={subForm.email}
              onChange={(e) =>
                setSubForm({ ...subForm, email: e.target.value })
              }
            />
          </Field>
          <Field label="Name (optional)">
            <input
              className={inputClass}
              value={subForm.name}
              onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={adding}>
              {adding ? "Adding…" : "Add to list"}
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setOpenAddSub(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selected}
        title={selected?.name ?? "Campaign"}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-mute">Subject: </span>
              {selected.subject}
            </p>
            <p>
              <StatusBadge tone={tone(selected.status)}>
                {selected.status}
              </StatusBadge>
            </p>
            <p>
              Delivered {formatNumber(selected.recipients, false, locale)} ·
              Opens {formatPercent(openRate(selected))} · Clicks{" "}
              {formatPercent(clickRate(selected))}
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
