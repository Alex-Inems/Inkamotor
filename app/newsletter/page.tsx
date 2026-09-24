"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  Field,
  inputClass,
  Modal,
} from "@/components/modal";
import { EmailMarketingSubnav } from "@/components/email-marketing/email-marketing-subnav";
import { EmptyHint, FormNotice, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { HtmlEditor } from "@/components/html-editor";
import {
  DAILY_NEWSLETTER_CAP,
  hasScheduledWaves,
  isMultiDaySend,
  waveCount,
} from "@/lib/newsletter/waves";
import { hideCampaignId, hiddenCampaignIds } from "@/lib/newsletter/hidden-campaigns";
import { copyTemplateDisplayName } from "@/lib/newsletter/templates";
import { pushWorkspaceNotice } from "@/lib/workspace-notices";
import type { NewsletterMailing } from "@/lib/newsletter/mailings";

type LiveCampaign = {
  id: string;
  brevoId?: string;
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
  tags?: string[];
};

type Template = {
  id: string;
  name: string;
  subject: string;
  preview: string;
  html: string;
  builtin: boolean;
};

type ApiError = { error: string; missing?: string[] };

type FormFlash = { tone: "success" | "error" | "info"; title: string; body?: string };

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
  if (status === "sending" || status === "scheduled") return "info" as const;
  if (status === "archived") return "neutral" as const;
  return "warning" as const;
}

export default function NewsletterPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("common.loading")}</p>}>
      <NewsletterPageInner />
    </Suspense>
  );
}

function NewsletterPageInner() {
  const { pushToast } = useCrm();
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();
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
  const [recipientTag, setRecipientTag] = useState("all");
  const [audienceTags, setAudienceTags] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [editorKey, setEditorKey] = useState("blank");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduleAt, setScheduleAt] = useState("");
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [duplicatingTemplate, setDuplicatingTemplate] = useState(false);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [composerNotice, setComposerNotice] = useState<FormFlash | null>(null);
  const [subscriberNotice, setSubscriberNotice] = useState<FormFlash | null>(null);
  const [pageNotice, setPageNotice] = useState<FormFlash | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LiveCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<FormFlash | null>(null);
  const [sendDone, setSendDone] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    preview: "",
    html: "",
  });
  const composerNoticeRef = useRef<HTMLDivElement>(null);
  const subscriberNoticeRef = useRef<HTMLDivElement>(null);
  const draftLoadedRef = useRef<string | null>(null);
  const pendingAudienceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!templateDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [templateDirty]);

  const load = useCallback(async () => {
    const res = await fetch("/api/newsletter");
    const json = await res.json();
    if (!res.ok) {
      setError(json as ApiError);
      setCampaigns([]);
      return;
    }
    setError(null);
    const hidden = hiddenCampaignIds();
    setCampaigns(
      ((json as { campaigns: LiveCampaign[] }).campaigns ?? []).filter(
        (c) => !hidden.has(c.id) && !(c.brevoId && hidden.has(c.brevoId)),
      ),
    );
  }, []);

  const loadSubscribers = useCallback(async () => {
    const res = await fetch("/api/newsletter/subscribers");
    const json = await res.json();
    if (!res.ok) {
      const raw = (json as ApiError).error || "";
      setSubscriberError(
        /429|busy|too many/i.test(raw)
          ? t("pages.newsletter.brevoBusy")
          : raw || t("pages.newsletter.loadFailed"),
      );
      setSubscribers([]);
      setAudienceTags([]);
      setSubscriberTotal(0);
      return;
    }
    const data = json as {
      subscribers: Subscriber[];
      tags?: string[];
      total: number;
      autoSubscribe: boolean;
    };
    setSubscriberError(null);
    setSubscribers(data.subscribers ?? []);
    setAudienceTags(data.tags ?? []);
    setSubscriberTotal(data.total ?? 0);
    setAutoSubscribe(Boolean(data.autoSubscribe));
  }, [t]);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/newsletter/templates");
    const json = await res.json();
    if (!res.ok) return;
    setTemplates((json as { templates: Template[] }).templates ?? []);
  }, []);

  useEffect(() => {
    void loadSubscribers();
    void loadTemplates();
    load().finally(() => setLoading(false));
  }, [load, loadSubscribers, loadTemplates]);

  useEffect(() => {
    if (!openAdd) return;
    composerNoticeRef.current?.scrollIntoView({ block: "nearest" });
  }, [openAdd, sending, composerNotice, sendDone]);

  useEffect(() => {
    if (subscriberNotice) {
      subscriberNoticeRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [subscriberNotice]);

  useEffect(() => {
    if (openAdd && subscribers.length === 0) void loadSubscribers();
  }, [openAdd, loadSubscribers, subscribers.length]);

  useEffect(() => {
    const compose = searchParams.get("compose");
    const draftId = searchParams.get("draft")?.trim();
    if (compose !== "1" || !draftId) return;
    if (draftLoadedRef.current === draftId) return;
    draftLoadedRef.current = draftId;

    let cancelled = false;
    void (async () => {
      try {
        if (subscribers.length === 0) await loadSubscribers();
        const res = await fetch(
          `/api/newsletter/mailings?id=${encodeURIComponent(draftId)}`,
        );
        const json = (await res.json()) as {
          mailing?: NewsletterMailing;
          error?: string;
        };
        if (!res.ok || !json.mailing) {
          throw new Error(
            json.error || t("pages.emailMarketing.draftLoadFailed"),
          );
        }
        if (cancelled) return;
        const mailing = json.mailing;
        setForm({
          name: mailing.name,
          subject: mailing.subject,
          preview: mailing.preview,
          html: mailing.html,
        });
        setTemplateId(mailing.templateId ?? "");
        setEditorKey(`draft-${mailing.id}-${Date.now()}`);
        if (mailing.recipientTag) {
          setRecipientTag(mailing.recipientTag);
          pendingAudienceRef.current = mailing.recipientTag;
        }
        const tagParam = searchParams.get("tag")?.trim();
        if (tagParam) {
          setRecipientTag(tagParam);
          pendingAudienceRef.current = tagParam;
        }
        if (mailing.scheduledAt) {
          const d = new Date(mailing.scheduledAt);
          if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
            const pad = (n: number) => String(n).padStart(2, "0");
            setWhen("later");
            setScheduleAt(
              `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
            );
          }
        }
        setOpenAdd(true);
        setTab("campaigns");
        pushToast({
          message: t("pages.emailMarketing.draftLoaded"),
          tone: "success",
        });
      } catch (err) {
        if (!cancelled) {
          pushToast({
            message:
              err instanceof Error
                ? err.message
                : t("pages.emailMarketing.draftLoadFailed"),
            tone: "error",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, loadSubscribers, subscribers.length, pushToast, t]);

  useEffect(() => {
    const tag = pendingAudienceRef.current;
    if (!openAdd || !tag || subscribers.length === 0) return;
    const want = tag.toLowerCase();
    const emails = subscribers
      .filter(
        (s) =>
          !s.blocked &&
          (s.tags ?? []).some((name) => name.toLowerCase() === want),
      )
      .map((s) => s.email);
    setSelectedEmails(emails);
    pendingAudienceRef.current = null;
  }, [openAdd, subscribers]);

  const sendable = useMemo(
    () => subscribers.filter((s) => !s.blocked),
    [subscribers],
  );

  const taggedSendable = useMemo(() => {
    if (recipientTag === "all") return sendable;
    const want = recipientTag.toLowerCase();
    return sendable.filter((s) =>
      (s.tags ?? []).some((tag) => tag.toLowerCase() === want),
    );
  }, [sendable, recipientTag]);

  const visibleRecipients = useMemo(() => {
    const q = recipientQuery.trim().toLowerCase();
    if (!q) return taggedSendable;
    return taggedSendable.filter((s) =>
      `${s.email} ${s.name ?? ""} ${(s.tags ?? []).join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [taggedSendable, recipientQuery]);

  function toggleEmail(email: string) {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  }

  function closeComposer() {
    setOpenAdd(false);
    setRecipientQuery("");
    setRecipientTag("all");
    setSelectedEmails([]);
    setComposerNotice(null);
    setSendDone(false);
  }

  function resetComposerForAnother() {
    setSendDone(false);
    setComposerNotice(null);
    setSelectedEmails([]);
    setRecipientQuery("");
    setRecipientTag("all");
    setForm({ name: "", subject: "", preview: "", html: "" });
    setWhen("now");
    setScheduleAt("");
    setTemplateId("");
    setEditorKey(`blank-${Date.now()}`);
  }

  async function addSubscriber(e: React.FormEvent) {
    e.preventDefault();
    const email = newSubscriber.email.trim();
    if (!email) {
      setSubscriberNotice({
        tone: "error",
        title: t("pages.newsletter.needEmail"),
      });
      return;
    }
    setAddingSubscriber(true);
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: newSubscriber.name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = (json as ApiError).error || t("pages.newsletter.addFailed");
        setSubscriberNotice({ tone: "error", title: message });
        pushToast({ message, tone: "error" });
        return;
      }
      const ok = t("pages.newsletter.addedToList", { email });
      setSubscriberNotice({ tone: "success", title: ok });
      pushToast({ message: ok, tone: "success" });
      setNewSubscriber({ email: "", name: "" });
      await loadSubscribers();
    } finally {
      setAddingSubscriber(false);
    }
  }

  async function setBlocked(email: string, blocked: boolean) {
    setBusyEmail(email);
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, blocked }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = (json as ApiError).error || t("pages.newsletter.updateFailed");
        setSubscriberNotice({ tone: "error", title: message });
        pushToast({ message, tone: "error" });
        return;
      }
      const ok = blocked
        ? t("pages.newsletter.unsubscribedOk", { email })
        : t("pages.newsletter.resubscribedOk", { email });
      setSubscriberNotice({ tone: "success", title: ok });
      pushToast({ message: ok, tone: "success" });
      await loadSubscribers();
    } finally {
      setBusyEmail(null);
    }
  }

  function applyTemplate(id: string) {
    if (
      templateDirty &&
      !window.confirm(t("pages.newsletter.unsavedTemplate"))
    ) {
      return;
    }
    setTemplateId(id);
    const tpl = templates.find((item) => item.id === id);
    if (!tpl) {
      setTemplateDirty(false);
      return;
    }
    setForm({
      name: form.name || tpl.name,
      subject: tpl.subject,
      preview: tpl.preview,
      html: tpl.html,
    });
    setEditorKey(`${id}-${Date.now()}`);
    setTemplateDirty(false);
  }

  async function saveTemplate() {
    if (!form.subject.trim() || !form.html.trim()) {
      setComposerNotice({
        tone: "error",
        title: t("pages.newsletter.templateNeedBody"),
      });
      pushToast({
        message: t("pages.newsletter.templateNeedBody"),
        tone: "error",
      });
      return;
    }
    const current = templates.find((item) => item.id === templateId);
    const updating = Boolean(current && !current.builtin);
    const res = await fetch("/api/newsletter/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(updating ? { id: templateId } : {}),
        name: form.name.trim() || form.subject.trim(),
        subject: form.subject.trim(),
        preview: form.preview.trim(),
        html: form.html,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      const message = (json as ApiError).error || t("pages.newsletter.templateSaveFailed");
      setComposerNotice({ tone: "error", title: message });
      pushToast({ message, tone: "error" });
      return;
    }
    const savedId = (json as { id?: string }).id;
    if (savedId) setTemplateId(savedId);
    setTemplateDirty(false);
    const title = updating
      ? t("pages.newsletter.templateUpdated")
      : t("pages.newsletter.templateSaved");
    setComposerNotice({
      tone: "success",
      title,
    });
    pushToast({
      message: title,
      tone: "success",
    });
    await loadTemplates();
  }

  async function duplicateTemplate() {
    const tpl = templates.find((item) => item.id === templateId);
    const subject = (form.subject.trim() || tpl?.subject || "").trim();
    const html = (form.html.trim() || tpl?.html || "").trim();
    const preview = (form.preview.trim() || tpl?.preview || "").trim();
    if (!subject || !html) {
      setComposerNotice({
        tone: "error",
        title: t("pages.newsletter.templateNeedBody"),
      });
      pushToast({
        message: t("pages.newsletter.templateNeedBody"),
        tone: "error",
      });
      return;
    }
    const suffix = t("pages.emailMarketing.templateCopySuffix");
    const baseName = (tpl?.name || form.name.trim() || subject).trim();
    const name = copyTemplateDisplayName(
      baseName,
      suffix,
      templates.map((item) => item.name),
    );
    setDuplicatingTemplate(true);
    try {
      const res = await fetch("/api/newsletter/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          preview,
          html,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          (json as ApiError).error || t("pages.newsletter.templateSaveFailed");
        setComposerNotice({ tone: "error", title: message });
        pushToast({ message, tone: "error" });
        return;
      }
      const newId = (json as { id?: string }).id;
      if (newId) setTemplateId(newId);
      setForm({
        name,
        subject,
        preview,
        html,
      });
      setTemplateDirty(false);
      setEditorKey(`${newId || "copy"}-${Date.now()}`);
      const detail = t("pages.newsletter.templateDuplicatedDetail").replace(
        "{name}",
        name,
      );
      setComposerNotice({
        tone: "success",
        title: t("pages.newsletter.templateDuplicated"),
        body: detail,
      });
      pushToast({
        message: t("pages.newsletter.templateDuplicated"),
        detail,
        tone: "success",
        ms: 10000,
      });
      await loadTemplates();
    } finally {
      setDuplicatingTemplate(false);
    }
  }

  async function deleteTemplate(id: string) {
    const del = await fetch(`/api/newsletter/templates?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await del.json();
    if (!del.ok) {
      pushToast({
        message:
          (json as ApiError).error || t("pages.newsletter.templateDeleteFailed"),
        tone: "error",
      });
      return;
    }
    if (templateId === id) setTemplateId("");
    await loadTemplates();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) =>
      `${c.name} ${c.subject} ${c.audience}`.toLowerCase().includes(q),
    );
  }, [campaigns, query]);

  const sent = campaigns.filter((c) => c.status === "sent");
  const pendingWaves = hasScheduledWaves(campaigns);
  const selectedCount = selectedEmails.length;
  const daysNeeded = waveCount(selectedCount);
  const multiDay = isMultiDaySend(selectedCount);
  const avgOpen =
    sent.length === 0
      ? 0
      : sent.reduce((s, c) => s + openRate(c), 0) / sent.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sendDone) {
      closeComposer();
      return;
    }
    if (!form.subject.trim()) {
      setComposerNotice({
        tone: "error",
        title: t("pages.newsletter.needSubject"),
      });
      return;
    }
    if (selectedEmails.length === 0) {
      setComposerNotice({
        tone: "error",
        title: t("pages.newsletter.needRecipient"),
      });
      return;
    }
    if (when === "later" && !scheduleAt) {
      setComposerNotice({
        tone: "error",
        title: t("pages.newsletter.needSchedule"),
      });
      return;
    }
    setComposerNotice({
      tone: "info",
      title: t("pages.newsletter.sendingInForm", { n: selectedEmails.length }),
    });
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
          scheduledAt: when === "later" ? scheduleAt : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = (json as ApiError).error || t("pages.newsletter.sendFailed");
        setError(json as ApiError);
        setComposerNotice({ tone: "error", title: message });
        pushToast({ message, tone: "error" });
        return;
      }
      const days = Number((json as { days?: number }).days ?? 1);
      const n = Number(
        (json as { recipients?: number }).recipients ?? selectedEmails.length,
      );
      const scheduled = Boolean((json as { scheduled?: boolean }).scheduled);
      const title =
        days > 1
          ? t("pages.newsletter.queuedInForm", { days })
          : scheduled
            ? t("pages.newsletter.scheduledInForm")
            : t("pages.newsletter.sentInForm", { n });
      const notice: FormFlash = {
        tone: "success",
        title,
        body: t("pages.newsletter.promotionsHint"),
      };
      setComposerNotice(notice);
      setPageNotice(notice);
      setSendDone(true);
      pushWorkspaceNotice({
        kind: "newsletter",
        title,
        body: t("pages.newsletter.promotionsHint"),
        href: "/newsletter",
      });
      pushToast({
        message: title,
        detail: t("pages.newsletter.promotionsHint"),
        tone: "success",
      });
      setTab("campaigns");
      await load();
    } finally {
      setSending(false);
    }
  }

  function campaignApiId(c: LiveCampaign) {
    return c.brevoId && /^\d+$/.test(c.brevoId) ? c.brevoId : c.id;
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteNotice(null);
    try {
      const res = await fetch(
        `/api/newsletter?id=${encodeURIComponent(campaignApiId(pendingDelete))}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as ApiError & { ok?: boolean };
      if (!res.ok) {
        const message = json.error || t("pages.newsletter.deleteFailed");
        setDeleteNotice({ tone: "error", title: message });
        pushToast({ message, tone: "error" });
        return;
      }
      hideCampaignId(pendingDelete.id);
      if (pendingDelete.brevoId) hideCampaignId(pendingDelete.brevoId);
      setCampaigns((prev) =>
        prev.filter(
          (c) =>
            c.id !== pendingDelete.id &&
            c.brevoId !== pendingDelete.id &&
            c.id !== pendingDelete.brevoId,
        ),
      );
      setSelected((current) =>
        current?.id === pendingDelete.id ? null : current,
      );
      setPendingDelete(null);
      setPageNotice({
        tone: "success",
        title: t("pages.newsletter.deletedOk"),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("pages.emailMarketing.tabCampaigns")}
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

      <div className="mt-4">
        <EmailMarketingSubnav />
      </div>

      {error ? (
        <div className="mb-4 border border-wine/40 bg-wine/10 px-4 py-3 text-sm">
          <p className="font-semibold text-pink">{error.error}</p>
          {error.missing?.length ? (
            <p className="mt-1 text-mute">{error.missing.join(", ")}</p>
          ) : null}
        </div>
      ) : null}

      {pageNotice ? (
        <div className="mb-4">
          <FormNotice
            tone={pageNotice.tone}
            title={pageNotice.title}
            onDismiss={() => setPageNotice(null)}
          >
            {pageNotice.body}
          </FormNotice>
        </div>
      ) : (
        <div className="mb-4">
          <FormNotice tone="info">{t("pages.newsletter.promotionsBanner")}</FormNotice>
        </div>
      )}

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
            className={`shrink-0 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] ${tab === item.id
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
          {subscriberNotice ? (
            <div ref={subscriberNoticeRef}>
              <FormNotice
                tone={subscriberNotice.tone}
                title={subscriberNotice.title}
                onDismiss={() => setSubscriberNotice(null)}
              >
                {subscriberNotice.body}
              </FormNotice>
            </div>
          ) : null}
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

          <Panel title={t("pages.newsletter.subscriberCount", { n: subscriberTotal || subscribers.length })}>
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
                      <th />
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
                        <td className="whitespace-nowrap">
                          <button
                            type="button"
                            className={btnGhost}
                            disabled={busyEmail === s.email}
                            onClick={() => void setBlocked(s.email, !s.blocked)}
                          >
                            {s.blocked
                              ? t("pages.newsletter.resubscribe")
                              : t("pages.newsletter.unsubscribe")}
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
                            {c.sentAt
                              ? formatDate(c.sentAt.slice(0, 10), locale)
                              : c.scheduledAt
                                ? formatDate(c.scheduledAt.slice(0, 10), locale)
                                : t("common.dash")}
                          </td>
                          <td className="whitespace-nowrap">
                            <div className="flex flex-wrap justify-end gap-1">
                              <button
                                type="button"
                                className={btnGhost}
                                onClick={() => setSelected(c)}
                              >
                                {t("common.open")}
                              </button>
                              <button
                                type="button"
                                className={`${btnGhost} text-pink`}
                                onClick={() => {
                                  setSelected(null);
                                  setDeleteNotice(null);
                                  setPendingDelete(c);
                                }}
                              >
                                {t("pages.newsletter.deleteCampaign")}
                              </button>
                            </div>
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
          <div ref={composerNoticeRef}>
            {composerNotice ? (
              <FormNotice tone={composerNotice.tone} title={composerNotice.title}>
                {composerNotice.body}
              </FormNotice>
            ) : (
              <FormNotice tone="info">{t("pages.newsletter.promotionsHint")}</FormNotice>
            )}
          </div>
          {sendDone ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className={btnPrimary}>
                {t("common.close")}
              </button>
              <button
                type="button"
                className={btnSecondary}
                onClick={resetComposerForAnother}
              >
                {t("pages.newsletter.sendAnother")}
              </button>
            </div>
          ) : (
            <>
              <Field label={t("pages.newsletter.template")}>
                <div className="flex flex-wrap gap-2">
                  <select
                    className={inputClass}
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">{t("pages.newsletter.pickTemplate")}</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                        {tpl.builtin ? ` · ${t("pages.newsletter.builtin")}` : ""}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={btnGhost} onClick={() => void saveTemplate()}>
                    {templateId &&
                    !templates.find((tpl) => tpl.id === templateId)?.builtin
                      ? t("pages.newsletter.updateTemplate")
                      : t("pages.newsletter.saveTemplate")}
                  </button>
                  {templateId ? (
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={duplicatingTemplate || sending}
                      onClick={() => void duplicateTemplate()}
                    >
                      {duplicatingTemplate
                        ? t("pages.emailMarketing.duplicatingTemplate")
                        : t("pages.newsletter.duplicateTemplate")}
                    </button>
                  ) : null}
                  {templateId && !templates.find((tpl) => tpl.id === templateId)?.builtin ? (
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => void deleteTemplate(templateId)}
                    >
                      {t("pages.newsletter.deleteTemplate")}
                    </button>
                  ) : null}
                </div>
              </Field>
              <Field label={t("pages.newsletter.internalName")}>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => {
                    setTemplateDirty(true);
                    setForm({ ...form, name: e.target.value });
                  }}
                  placeholder={t("pages.newsletter.namePlaceholder")}
                />
              </Field>
              <Field label={t("common.subject")}>
                <input
                  className={inputClass}
                  value={form.subject}
                  onChange={(e) => {
                    setTemplateDirty(true);
                    setForm({ ...form, subject: e.target.value });
                  }}
                />
              </Field>
              <Field label={t("pages.newsletter.previewText")}>
                <input
                  className={inputClass}
                  value={form.preview}
                  onChange={(e) => {
                    setTemplateDirty(true);
                    setForm({ ...form, preview: e.target.value });
                  }}
                />
              </Field>
              <Field label={t("pages.newsletter.body")}>
                <HtmlEditor
                  html={form.html}
                  resetKey={editorKey}
                  onChange={(html) => {
                    setTemplateDirty(true);
                    setForm({ ...form, html });
                  }}
                />
              </Field>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
                  {t("pages.newsletter.when")}
                </legend>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="when"
                      checked={when === "now"}
                      onChange={() => setWhen("now")}
                    />
                    {t("pages.newsletter.sendNowOption")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="when"
                      checked={when === "later"}
                      onChange={() => setWhen("later")}
                    />
                    {t("pages.newsletter.scheduleOption")}
                  </label>
                </div>
                {when === "later" ? (
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={scheduleAt}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                ) : null}
              </fieldset>
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
                {pendingWaves && multiDay ? (
                  <p className="border border-wine/40 bg-wine/10 px-3 py-2.5 text-sm leading-relaxed text-pink">
                    {t("pages.newsletter.wavesInProgress")}
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className={inputClass}
                    value={recipientTag}
                    onChange={(e) => {
                      const next = e.target.value;
                      setRecipientTag(next);
                      if (next === "all") return;
                      const want = next.toLowerCase();
                      const emails = sendable
                        .filter((s) =>
                          (s.tags ?? []).some((tag) => tag.toLowerCase() === want),
                        )
                        .map((s) => s.email);
                      setSelectedEmails(emails);
                    }}
                  >
                    <option value="all">{t("pages.newsletter.allTags")}</option>
                    {audienceTags.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    placeholder={t("pages.newsletter.searchPeople")}
                    value={recipientQuery}
                    onChange={(e) => setRecipientQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() =>
                      setSelectedEmails(taggedSendable.map((s) => s.email))
                    }
                    disabled={taggedSendable.length === 0}
                  >
                    {recipientTag === "all"
                      ? t("pages.newsletter.selectAll")
                      : t("pages.newsletter.selectTag", {
                        tag: recipientTag,
                        n: taggedSendable.length,
                      })}
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
                {sendable.length === 0 ? (
                  <p className="border border-line px-3 py-6 text-center text-sm text-mute">
                    {t("pages.newsletter.noSendable")}
                  </p>
                ) : taggedSendable.length === 0 ? (
                  <p className="border border-line px-3 py-6 text-center text-sm text-mute">
                    {t("pages.newsletter.noTagMatches", { tag: recipientTag })}
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
                              {(s.tags ?? []).length > 0 ? (
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {(s.tags ?? []).map((tag) => (
                                    <span
                                      key={tag}
                                      className="bg-ash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mute"
                                    >
                                      {tag}
                                    </span>
                                  ))}
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
              {multiDay ? (
                <div className="border border-accent/50 bg-accent-soft px-3 py-3 text-sm leading-relaxed">
                  {t("pages.newsletter.multiDayNotice", {
                    n: selectedCount,
                    days: daysNeeded,
                    cap: DAILY_NEWSLETTER_CAP,
                  })}
                </div>
              ) : selectedCount > 0 ? (
                <p className="text-xs text-mute">{t("pages.newsletter.sendsAtPickTime")}</p>
              ) : (
                <p className="text-xs text-mute">
                  {when === "later"
                    ? t("pages.newsletter.sendsLater")
                    : t("pages.newsletter.sendsNow")}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={sending || selectedEmails.length === 0}
                >
                  {sending
                    ? t("common.sending")
                    : when === "later"
                      ? t("pages.newsletter.scheduleSend")
                      : t("pages.newsletter.sendNow")}
                </button>
                {multiDay ? (
                  <span className="text-xs text-mute">
                    {t("pages.newsletter.sendOverDays", { days: daysNeeded })}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={closeComposer}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </>
          )}
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
            {selected.scheduledAt ? (
              <p>
                <span className="text-mute">{t("pages.newsletter.scheduledFor")}: </span>
                {formatDate(selected.scheduledAt.slice(0, 10), locale)}
              </p>
            ) : null}
            {selected.preview ? (
              <p className="text-mute">{selected.preview}</p>
            ) : null}
            <div className="pt-2">
              <button
                type="button"
                className={`${btnGhost} text-pink`}
                onClick={() => {
                  setDeleteNotice(null);
                  setPendingDelete(selected);
                  setSelected(null);
                }}
              >
                {t("pages.newsletter.deleteCampaign")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!pendingDelete}
        title={t("pages.newsletter.deleteTitle")}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
      >
        {pendingDelete ? (
          <div className="space-y-3">
            {deleteNotice ? (
              <FormNotice tone={deleteNotice.tone} title={deleteNotice.title} />
            ) : (
              <FormNotice tone="info" title={pendingDelete.name}>
                {t("pages.newsletter.deleteConfirm")}
                {pendingDelete.status === "scheduled"
                  ? ` ${t("pages.newsletter.deleteConfirmScheduled")}`
                  : ""}
              </FormNotice>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${btnPrimary} bg-wine hover:bg-wine/90`}
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting
                  ? t("common.deleting")
                  : t("pages.newsletter.deleteCampaign")}
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
