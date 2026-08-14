"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart, ConversionFunnel, DonutChart } from "@/components/charts";
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
import {
  OWNERS,
  todayIso,
  type FollowUp,
  type FollowUpStatus,
  type InquiryChannel,
  type InquiryStatus,
  type Lead,
  type LeadSource,
  type LeadStatus,
  type SiteInquiry,
} from "@/lib/demo-data";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { followUpTone, inquiryTone, leadTone } from "@/lib/status";
import { useLocale } from "@/lib/i18n";

type HubTab = "leads" | "questions" | "followups" | "insights";
type LeadSort =
  | "newest"
  | "oldest"
  | "value_high"
  | "value_low"
  | "name"
  | "status"
  | "priority"
  | "stale";
type QuestionSort =
  | "newest"
  | "oldest"
  | "status"
  | "channel"
  | "name"
  | "priority";
type FollowSort = "due_soon" | "due_late" | "newest" | "status" | "owner";
type LeadView = "board" | "list" | "table";
type QuickFilter =
  | "all"
  | "hot"
  | "stale"
  | "website"
  | "mine"
  | "needs_followup"
  | "high_value";

const DEMO_TODAY = todayIso();

const pipelineStages: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
];

const sources: LeadSource[] = [
  "website",
  "google",
  "meta",
  "organic",
  "referral",
  "manual",
];

const statusCopy: Record<LeadStatus, { title: string; blurb: string }> = {
  new: {
    title: "New",
    blurb: "Fresh opportunities waiting for first outreach.",
  },
  contacted: {
    title: "Contacted",
    blurb: "Conversation started — nurture toward a decision.",
  },
  qualified: {
    title: "Qualified",
    blurb: "Fit confirmed. Ready for proposal or sale.",
  },
  won: {
    title: "Won",
    blurb: "Closed successfully and handed to sales.",
  },
  lost: {
    title: "Lost",
    blurb: "Did not convert — keep notes for later.",
  },
};

const sourceCopy: Record<LeadSource, string> = {
  website: "yangaa.store form, chat, or product question",
  google: "Google Ads campaign",
  meta: "Meta Ads campaign",
  organic: "Organic / SEO visit",
  referral: "Partner or customer referral",
  manual: "Added manually by the team",
};

const sourceColors: Record<LeadSource, string> = {
  website: "#31595d",
  google: "#624e8a",
  meta: "#e1736c",
  organic: "#65814f",
  referral: "#ecbb5a",
  manual: "#b8b3a8",
};

const channelLabel: Record<InquiryChannel, string> = {
  contact_form: "Contact form",
  yanga_care: "Rider chat",
  product_question: "Product question",
  shipping_help: "Shipping / track",
  wholesale: "Wholesale",
};

const channelSlaHours: Record<InquiryChannel, number> = {
  shipping_help: 8,
  yanga_care: 12,
  product_question: 24,
  contact_form: 24,
  wholesale: 48,
};

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  source: "website" as LeadSource,
  status: "new" as LeadStatus,
  value: "",
  currency: "USD" as const,
  owner: OWNERS[0] as string,
  notes: "",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function daysBetween(from: string, to = DEMO_TODAY) {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(
    0,
    Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function leadPriority(
  lead: Lead,
  questions: SiteInquiry[],
  tasks: FollowUp[],
): number {
  let score = 40;
  score += Math.min(35, Math.round(lead.value / 500));
  if (lead.source === "website") score += 10;
  if (lead.status === "qualified") score += 18;
  if (lead.status === "new") score += 12;
  if (lead.status === "contacted") score += 8;
  if (lead.status === "won" || lead.status === "lost") score -= 25;
  const stale = daysBetween(lead.lastContact);
  if (stale >= 5 && !["won", "lost"].includes(lead.status)) score += 15;
  if (stale >= 8 && !["won", "lost"].includes(lead.status)) score += 10;
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  score += openTasks * 6;
  score += Math.min(12, questions.length * 4);
  if (tasks.some((t) => t.status === "overdue")) score += 14;
  return Math.max(0, Math.min(99, score));
}

function questionPriority(inq: SiteInquiry) {
  let score = 35;
  if (inq.status === "new") score += 25;
  if (inq.status === "triaged") score += 12;
  if (inq.channel === "wholesale") score += 22;
  if (inq.channel === "product_question") score += 14;
  if (inq.channel === "shipping_help") score += 18;
  if (inq.channel === "yanga_care") score += 10;
  const age = daysBetween(inq.createdAt);
  score += Math.min(20, age * 8);
  if (inq.leadId) score -= 15;
  if (inq.status === "closed" || inq.status === "converted") score -= 30;
  return Math.max(0, Math.min(99, score));
}

function priorityTone(score: number): "danger" | "warning" | "info" | "neutral" {
  if (score >= 80) return "danger";
  if (score >= 65) return "warning";
  if (score >= 45) return "info";
  return "neutral";
}

function priorityLabel(score: number) {
  if (score >= 80) return "Critical";
  if (score >= 65) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function sortLeads(
  list: Lead[],
  sort: LeadSort,
  scoreOf: (lead: Lead) => number,
) {
  const next = [...list];
  next.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "value_high":
        return b.value - a.value;
      case "value_low":
        return a.value - b.value;
      case "name":
        return a.name.localeCompare(b.name);
      case "status":
        return (
          pipelineStages.indexOf(a.status) - pipelineStages.indexOf(b.status) ||
          b.createdAt.localeCompare(a.createdAt)
        );
      case "priority":
        return scoreOf(b) - scoreOf(a);
      case "stale":
        return (
          daysBetween(b.lastContact) - daysBetween(a.lastContact) ||
          b.value - a.value
        );
      case "newest":
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
  return next;
}

function sortQuestions(list: SiteInquiry[], sort: QuestionSort) {
  const next = [...list];
  const order: InquiryStatus[] = ["new", "triaged", "converted", "closed"];
  next.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "status":
        return order.indexOf(a.status) - order.indexOf(b.status);
      case "channel":
        return a.channel.localeCompare(b.channel);
      case "name":
        return a.name.localeCompare(b.name);
      case "priority":
        return questionPriority(b) - questionPriority(a);
      case "newest":
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
  return next;
}

function sortFollowUps(list: FollowUp[], sort: FollowSort) {
  const next = [...list];
  const order: FollowUpStatus[] = ["overdue", "open", "done"];
  next.sort((a, b) => {
    switch (sort) {
      case "due_late":
        return b.dueAt.localeCompare(a.dueAt);
      case "newest":
        return b.createdAt.localeCompare(a.createdAt);
      case "status":
        return order.indexOf(a.status) - order.indexOf(b.status);
      case "owner":
        return a.owner.localeCompare(b.owner);
      case "due_soon":
      default:
        return a.dueAt.localeCompare(b.dueAt);
    }
  });
  return next;
}

function dueBucket(dueAt: string): "overdue" | "today" | "week" | "later" {
  if (dueAt < DEMO_TODAY) return "overdue";
  if (dueAt === DEMO_TODAY) return "today";
  const days = daysBetween(DEMO_TODAY, dueAt);
  if (days <= 7) return "week";
  return "later";
}

export default function LeadsPage() {
  const {
    leads,
    siteInquiries,
    followUps,
    sales,
    addLead,
    updateLeadStatus,
    addFollowUp,
    addSale,
    convertInquiryToLead,
    updateInquiryStatus,
    updateFollowUpStatus,
  } = useCrm();
  const { t } = useLocale();

  const [tab, setTab] = useState<HubTab>("leads");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [source, setSource] = useState<LeadSource | "all">("all");
  const [owner, setOwner] = useState<string | "all">("all");
  const [leadSort, setLeadSort] = useState<LeadSort>("priority");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [questionStatus, setQuestionStatus] = useState<InquiryStatus | "all">(
    "all",
  );
  const [questionChannel, setQuestionChannel] = useState<
    InquiryChannel | "all"
  >("all");
  const [questionSort, setQuestionSort] = useState<QuestionSort>("priority");
  const [followStatus, setFollowStatus] = useState<FollowUpStatus | "all">(
    "all",
  );
  const [followOwner, setFollowOwner] = useState<string | "all">("all");
  const [followSort, setFollowSort] = useState<FollowSort>("due_soon");
  const [view, setView] = useState<LeadView>("board");
  const [openAdd, setOpenAdd] = useState(false);
  const [openQuickFollow, setOpenQuickFollow] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<SiteInquiry | null>(
    null,
  );
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(
    null,
  );
  const [form, setForm] = useState(emptyForm);
  const [followForm, setFollowForm] = useState({
    title: "",
    relatedTo: "",
    dueAt: DEMO_TODAY,
    owner: OWNERS[0] as string,
    notes: "",
  });

  function relatedForLead(lead: Lead) {
    const questions = siteInquiries.filter(
      (i) => i.leadId === lead.id || i.email === lead.email,
    );
    const tasks = followUps.filter(
      (f) =>
        (f.relatedType === "lead" && f.relatedId === lead.id) ||
        f.relatedTo.includes(lead.name),
    );
    return { questions, tasks };
  }

  function scoreFor(lead: Lead) {
    const related = relatedForLead(lead);
    return leadPriority(lead, related.questions, related.tasks);
  }

  const openQuestions = siteInquiries.filter(
    (i) => i.status === "new" || i.status === "triaged",
  ).length;
  const openFollowUps = followUps.filter(
    (f) => f.status === "open" || f.status === "overdue",
  ).length;
  const overdueFollowUps = followUps.filter((f) => f.status === "overdue");
  const websiteLeads = leads.filter((l) => l.source === "website").length;
  const openPipelineValue = leads
    .filter((l) => ["new", "contacted", "qualified"].includes(l.status))
    .reduce((sum, l) => sum + l.value, 0);
  const wonValue = leads
    .filter((l) => l.status === "won")
    .reduce((sum, l) => sum + l.value, 0);
  const closedLeads = leads.filter((l) =>
    ["won", "lost"].includes(l.status),
  ).length;
  const winRate = closedLeads
    ? (leads.filter((l) => l.status === "won").length / closedLeads) * 100
    : 0;
  const avgDeal =
    leads.length === 0
      ? 0
      : leads.reduce((sum, l) => sum + l.value, 0) / leads.length;
  const questionToLeadRate = siteInquiries.length
    ? (siteInquiries.filter((i) => i.leadId).length / siteInquiries.length) *
      100
    : 0;
  const staleLeads = leads.filter(
    (l) =>
      !["won", "lost"].includes(l.status) && daysBetween(l.lastContact) >= 5,
  );
  const hotLeads = [...leads]
    .filter((l) => !["won", "lost"].includes(l.status))
    .map((l) => ({ lead: l, score: scoreFor(l) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const byStatus = useMemo(() => {
    return pipelineStages.reduce(
      (acc, s) => {
        const list = leads.filter((l) => l.status === s);
        acc[s] = {
          count: list.length,
          value: list.reduce((sum, l) => sum + l.value, 0),
        };
        return acc;
      },
      {} as Record<LeadStatus, { count: number; value: number }>,
    );
  }, [leads]);

  const sourceMix = useMemo(() => {
    return sources
      .map((s) => ({
        label: s,
        value: leads.filter((l) => l.source === s).length,
        color: sourceColors[s],
      }))
      .filter((s) => s.value > 0);
  }, [leads]);

  const ownerWorkload = useMemo(() => {
    return OWNERS.map((o) => {
      const ownerLeads = leads.filter(
        (l) => l.owner === o && !["won", "lost"].includes(l.status),
      );
      const ownerFollows = followUps.filter(
        (f) => f.owner === o && f.status !== "done",
      );
      const ownerQuestions = siteInquiries.filter(
        (i) =>
          i.owner === o && (i.status === "new" || i.status === "triaged"),
      );
      return {
        label: o.split(" ")[0],
        value:
          ownerLeads.reduce((sum, l) => sum + l.value, 0) +
          ownerQuestions.length * 400 +
          ownerFollows.length * 250,
        leads: ownerLeads.length,
        follows: ownerFollows.length,
        questions: ownerQuestions.length,
      };
    });
  }, [leads, followUps, siteInquiries]);

  const activityFeed = useMemo(() => {
    const items: {
      id: string;
      when: string;
      kind: string;
      title: string;
      detail: string;
      tone: "info" | "warning" | "success" | "danger" | "neutral";
    }[] = [];

    for (const l of leads) {
      items.push({
        id: `lead-${l.id}`,
        when: l.lastContact,
        kind: "Lead",
        title: `${l.name} · ${statusCopy[l.status].title}`,
        detail: `${l.company} · ${formatMoney(l.value, "USD", true)} · ${l.owner}`,
        tone: leadTone(l.status),
      });
    }
    for (const q of siteInquiries) {
      items.push({
        id: `inq-${q.id}`,
        when: q.createdAt,
        kind: "Question",
        title: q.subject,
        detail: `${channelLabel[q.channel]} · ${q.name} · ${q.status}`,
        tone: inquiryTone(q.status),
      });
    }
    for (const f of followUps) {
      items.push({
        id: `fu-${f.id}`,
        when: f.dueAt,
        kind: "Follow-up",
        title: f.title,
        detail: `${f.relatedTo} · ${f.status} · ${f.owner}`,
        tone: followUpTone(f.status),
      });
    }
    for (const s of sales.slice(0, 6)) {
      items.push({
        id: `sale-${s.id}`,
        when: s.createdAt,
        kind: "Sale",
        title: `${s.customer} · ${s.number}`,
        detail: `${s.product} · ${formatMoney(s.amount, "USD", true)}`,
        tone: "success",
      });
    }

    return items
      .sort((a, b) => b.when.localeCompare(a.when) || a.title.localeCompare(b.title))
      .slice(0, 12);
  }, [leads, siteInquiries, followUps, sales]);

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    const myOwner = "Daniel C.";
    const list = leads.filter((lead) => {
      if (status !== "all" && lead.status !== status) return false;
      if (source !== "all" && lead.source !== source) return false;
      if (owner !== "all" && lead.owner !== owner) return false;

      const related = relatedForLead(lead);
      const score = leadPriority(lead, related.questions, related.tasks);
      const stale = daysBetween(lead.lastContact) >= 5;
      const openTasks = related.tasks.filter((t) => t.status !== "done");

      if (quickFilter === "hot" && score < 65) return false;
      if (
        quickFilter === "stale" &&
        (!stale || ["won", "lost"].includes(lead.status))
      )
        return false;
      if (quickFilter === "website" && lead.source !== "website") return false;
      if (quickFilter === "mine" && lead.owner !== myOwner) return false;
      if (quickFilter === "needs_followup" && openTasks.length === 0)
        return false;
      if (quickFilter === "high_value" && lead.value < 5000) return false;

      if (!q) return true;
      return [
        lead.name,
        lead.email,
        lead.company,
        lead.owner,
        lead.notes,
        ...related.questions.map((i) => `${i.subject} ${i.message}`),
        ...related.tasks.map((f) => f.title),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    return sortLeads(list, leadSort, scoreFor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    leads,
    query,
    status,
    source,
    owner,
    leadSort,
    quickFilter,
    siteInquiries,
    followUps,
  ]);

  const filteredQuestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = siteInquiries.filter((inq) => {
      if (questionStatus !== "all" && inq.status !== questionStatus)
        return false;
      if (questionChannel !== "all" && inq.channel !== questionChannel)
        return false;
      if (!q) return true;
      return `${inq.name} ${inq.email} ${inq.subject} ${inq.message} ${inq.page}`
        .toLowerCase()
        .includes(q);
    });
    return sortQuestions(list, questionSort);
  }, [siteInquiries, query, questionStatus, questionChannel, questionSort]);

  const filteredFollowUps = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = followUps.filter((f) => {
      if (followStatus !== "all" && f.status !== followStatus) return false;
      if (followOwner !== "all" && f.owner !== followOwner) return false;
      if (!q) return true;
      return `${f.title} ${f.relatedTo} ${f.notes} ${f.owner}`
        .toLowerCase()
        .includes(q);
    });
    return sortFollowUps(list, followSort);
  }, [followUps, query, followStatus, followOwner, followSort]);

  const followBuckets = useMemo(() => {
    const groups: Record<
      "overdue" | "today" | "week" | "later",
      FollowUp[]
    > = { overdue: [], today: [], week: [], later: [] };
    for (const f of filteredFollowUps) {
      if (f.status === "done") continue;
      groups[dueBucket(f.dueAt)].push(f);
    }
    return groups;
  }, [filteredFollowUps]);

  function submitLead(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(form.value);
    if (!form.name.trim() || !form.email.trim() || !form.company.trim()) return;
    if (!Number.isFinite(value) || value < 0) return;

    addLead({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || "—",
      company: form.company.trim(),
      source: form.source,
      status: form.status,
      value,
      currency: form.currency,
      owner: form.owner,
      notes:
        form.notes.trim() ||
        "Manually added to the yangaa.store opportunity pipeline.",
    });
    setForm(emptyForm);
    setOpenAdd(false);
  }

  function submitQuickFollow(e: React.FormEvent) {
    e.preventDefault();
    if (!followForm.title.trim() || !followForm.relatedTo.trim()) return;
    addFollowUp({
      title: followForm.title.trim(),
      relatedTo: followForm.relatedTo.trim(),
      relatedType: "lead",
      relatedId: leads[0]?.id ?? "ld_manual",
      dueAt: followForm.dueAt,
      owner: followForm.owner,
      notes: followForm.notes.trim() || "Created from leads hub.",
    });
    setFollowForm({
      title: "",
      relatedTo: "",
      dueAt: DEMO_TODAY,
      owner: OWNERS[0],
      notes: "",
    });
    setOpenQuickFollow(false);
    setTab("followups");
  }

  return (
    <div>
      <PageHeader
        title={t("pages.leads.title")}
        description={t("pages.leads.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/inbox" className={btnSecondary}>
              {t("pages.leads.fullInbox")}
            </Link>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setOpenQuickFollow(true)}
            >
              {t("pages.leads.logFollowUp")}
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setOpenAdd(true)}
            >
              {t("pages.leads.addLead")}
            </button>
          </div>
        }
      />

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <div className="border border-line bg-panel p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sand">
            {t("pages.leads.workflow")}
          </p>
          <h2 className="mt-2 font-display text-xl font-bold tracking-tight sm:text-2xl">
            {t("pages.leads.workflowTitle")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute sm:text-base">
            {t("pages.leads.workflowBody")}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: t("pages.leads.step1"),
                text: t("pages.leads.step1text"),
              },
              {
                step: "02",
                title: t("pages.leads.step2"),
                text: t("pages.leads.step2text"),
              },
              {
                step: "03",
                title: t("pages.leads.step3"),
                text: t("pages.leads.step3text"),
              },
              {
                step: "04",
                title: t("pages.leads.step4"),
                text: t("pages.leads.step4text"),
              },
            ].map((item) => (
              <div key={item.step} className="border border-line bg-ash/70 p-3">
                <p className="text-[11px] font-bold tracking-[0.16em] text-sand">
                  {item.step}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-mute">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-line bg-[linear-gradient(160deg,#31595d_0%,#624e8a_48%,#9f2627_100%)] p-5 text-white sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
            Today’s queue · {formatDate(DEMO_TODAY)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/10 p-3">
              <p className="text-white/70">Open questions</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {formatNumber(openQuestions)}
              </p>
            </div>
            <div className="bg-white/10 p-3">
              <p className="text-white/70">Overdue tasks</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {formatNumber(overdueFollowUps.length)}
              </p>
            </div>
            <div className="bg-white/10 p-3">
              <p className="text-white/70">Stale leads</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {formatNumber(staleLeads.length)}
              </p>
            </div>
            <div className="bg-white/10 p-3">
              <p className="text-white/70">Open pipeline</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {formatMoney(openPipelineValue, "USD", true)}
              </p>
            </div>
          </div>
        </div>

        <div className="border border-line bg-panel p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">
            Conversion health
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-mute">Win rate</dt>
              <dd className="font-semibold">{formatPercent(winRate)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-mute">Avg deal size</dt>
              <dd className="font-semibold">
                {formatMoney(avgDeal, "USD", true)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-mute">Question → lead</dt>
              <dd className="font-semibold">
                {formatPercent(questionToLeadRate)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-mute">Won pipeline</dt>
              <dd className="font-semibold">
                {formatMoney(wonValue, "USD", true)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-mute">Website leads</dt>
              <dd className="font-semibold">{formatNumber(websiteLeads)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Needs attention"
          action={
            <button
              type="button"
              className="text-xs font-semibold text-sand"
              onClick={() => {
                setTab("leads");
                setQuickFilter("hot");
                setLeadSort("priority");
              }}
            >
              Open hot queue
            </button>
          }
        >
          <ul className="divide-y divide-line">
            {overdueFollowUps.slice(0, 3).map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-ash/50 sm:px-5"
                  onClick={() => {
                    setTab("followups");
                    setSelectedFollowUp(f);
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="mt-0.5 text-xs text-mute">
                      Overdue · {f.relatedTo} · {f.owner}
                    </p>
                  </div>
                  <StatusBadge tone="danger">overdue</StatusBadge>
                </button>
              </li>
            ))}
            {staleLeads.slice(0, 2).map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-ash/50 sm:px-5"
                  onClick={() => setSelectedLead(l)}
                >
                  <div>
                    <p className="text-sm font-semibold">{l.name}</p>
                    <p className="mt-0.5 text-xs text-mute">
                      Stale {daysBetween(l.lastContact)}d · {l.company} ·{" "}
                      {formatMoney(l.value, "USD", true)}
                    </p>
                  </div>
                  <StatusBadge tone="warning">stale</StatusBadge>
                </button>
              </li>
            ))}
            {siteInquiries
              .filter((i) => i.status === "new")
              .slice(0, 2)
              .map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-ash/50 sm:px-5"
                    onClick={() => {
                      setTab("questions");
                      setSelectedQuestion(i);
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold">{i.subject}</p>
                      <p className="mt-0.5 text-xs text-mute">
                        {channelLabel[i.channel]} · SLA{" "}
                        {channelSlaHours[i.channel]}h · {i.name}
                      </p>
                    </div>
                    <StatusBadge tone="info">new</StatusBadge>
                  </button>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel title="Priority leaderboard">
          <ul className="divide-y divide-line">
            {hotLeads.map(({ lead, score }, index) => (
              <li key={lead.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ash/50 sm:px-5"
                  onClick={() => setSelectedLead(lead)}
                >
                  <span className="flex h-8 w-8 items-center justify-center bg-accent text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{lead.name}</p>
                    <p className="truncate text-xs text-mute">
                      {lead.company} · {statusCopy[lead.status].title} ·{" "}
                      {formatMoney(lead.value, "USD", true)}
                    </p>
                  </div>
                  <StatusBadge tone={priorityTone(score)}>
                    {score} · {priorityLabel(score)}
                  </StatusBadge>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="-mx-3 mb-4 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex w-max min-w-full gap-1 border border-line bg-panel p-1 sm:w-fit sm:flex-wrap">
        {(
          [
            { id: "leads" as const, label: `Leads (${leads.length})` },
            {
              id: "questions" as const,
              label: `Questions (${siteInquiries.length})`,
            },
            {
              id: "followups" as const,
              label: `Follow-ups (${followUps.length})`,
            },
            { id: "insights" as const, label: "Insights" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setQuery("");
            }}
            className={`shrink-0 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === item.id
                ? "bg-accent text-white"
                : "text-mute hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
        </div>
      </div>

      {tab !== "insights" ? (
        <div className="mb-4">
          <input
            className={inputClass}
            placeholder={
              tab === "leads"
                ? "Search leads, notes, linked questions, follow-ups…"
                : tab === "questions"
                  ? "Search store questions, email, subject, page…"
                  : "Search follow-ups, owners, notes, related contacts…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : null}

      {tab === "leads" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label="New"
              value={formatNumber(byStatus.new.count)}
              hint={`${formatMoney(byStatus.new.value, "USD", true)} awaiting contact`}
            />
            <KpiCard
              label="Contacted"
              value={formatNumber(byStatus.contacted.count)}
              hint={`${formatMoney(byStatus.contacted.value, "USD", true)} in conversation`}
            />
            <KpiCard
              label="Qualified"
              value={formatNumber(byStatus.qualified.count)}
              hint={`${formatMoney(byStatus.qualified.value, "USD", true)} ready to close`}
            />
            <KpiCard
              label="Won"
              value={formatNumber(byStatus.won.count)}
              hint={`${formatMoney(byStatus.won.value, "USD", true)} converted`}
            />
            <KpiCard
              label="Open follow-ups"
              value={formatNumber(openFollowUps)}
              hint={`${formatNumber(overdueFollowUps.length)} overdue across pipeline`}
            />
          </div>

          <div className="-mx-3 mt-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {(
              [
                { id: "all", label: "All" },
                { id: "hot", label: "Hot (≥65)" },
                { id: "stale", label: "Stale 5d+" },
                { id: "website", label: "Website" },
                { id: "mine", label: "My queue" },
                { id: "needs_followup", label: "Needs follow-up" },
                { id: "high_value", label: "High value $5k+" },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setQuickFilter(chip.id)}
                className={`shrink-0 border px-3 py-2 text-xs font-semibold ${
                  quickFilter === chip.id
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-panel text-mute hover:text-ink"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              <select
                className={inputClass}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as LeadStatus | "all")
                }
              >
                <option value="all">All stages</option>
                {pipelineStages.map((s) => (
                  <option key={s} value={s}>
                    {statusCopy[s].title}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={source}
                onChange={(e) =>
                  setSource(e.target.value as LeadSource | "all")
                }
              >
                <option value="all">All sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={leadSort}
                onChange={(e) => setLeadSort(e.target.value as LeadSort)}
              >
                <option value="priority">Sort: priority score</option>
                <option value="newest">Sort: newest</option>
                <option value="oldest">Sort: oldest</option>
                <option value="value_high">Sort: value high → low</option>
                <option value="value_low">Sort: value low → high</option>
                <option value="stale">Sort: staleness</option>
                <option value="name">Sort: name A–Z</option>
                <option value="status">Sort: pipeline stage</option>
              </select>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <select
                className={inputClass}
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="all">All owners</option>
                {OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <div className="flex border border-line bg-panel p-1">
                {(["board", "list", "table"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setView(mode)}
                    className={`min-h-11 flex-1 px-3 py-1.5 text-xs font-semibold capitalize sm:flex-none ${
                      view === mode
                        ? "bg-accent text-white"
                        : "text-mute hover:text-ink"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm text-mute">
            Showing{" "}
            <span className="font-semibold text-ink">{filteredLeads.length}</span>{" "}
            sorted leads
            {status !== "all" ? ` in ${statusCopy[status].title}` : ""}
            {quickFilter !== "all" ? ` · filter “${quickFilter}”` : ""}.
          </p>

          {filteredLeads.length === 0 ? (
            <div className="mt-4 border border-line bg-panel">
              <EmptyHint>No leads match these filters or sort.</EmptyHint>
            </div>
          ) : view === "board" ? (
            <div className="-mx-3 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
              {(status === "all" ? pipelineStages : [status]).map((stage) => {
                const cards = filteredLeads.filter((l) => l.status === stage);
                return (
                  <div
                    key={stage}
                    className="w-[min(18rem,calc(100vw-2.5rem))] shrink-0 snap-start border border-line bg-ash/50 sm:w-72"
                  >
                    <div className="border-b border-line bg-panel px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-display text-sm font-bold">
                          {statusCopy[stage].title}
                        </p>
                        <StatusBadge tone={leadTone(stage)}>
                          {cards.length}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-mute">
                        {statusCopy[stage].blurb}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-ink">
                        {formatMoney(
                          cards.reduce((sum, l) => sum + l.value, 0),
                          "USD",
                          true,
                        )}
                      </p>
                    </div>
                    <div className="space-y-3 p-3">
                      {cards.map((lead) => {
                        const related = relatedForLead(lead);
                        const score = leadPriority(
                          lead,
                          related.questions,
                          related.tasks,
                        );
                        const staleDays = daysBetween(lead.lastContact);
                        return (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => setSelectedLead(lead)}
                            className="w-full border border-line bg-panel p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
                          >
                            <div className="flex items-start gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-accent text-xs font-bold text-white">
                                {initials(lead.name)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate font-semibold">
                                    {lead.name}
                                  </p>
                                  <StatusBadge tone={priorityTone(score)}>
                                    {score}
                                  </StatusBadge>
                                </div>
                                <p className="truncate text-xs text-mute">
                                  {lead.company}
                                </p>
                              </div>
                            </div>
                            <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-mute">
                              {lead.notes}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                              <span className="rounded-full bg-ash px-2 py-0.5 font-semibold capitalize text-mute">
                                {lead.source}
                              </span>
                              {staleDays >= 5 &&
                              !["won", "lost"].includes(lead.status) ? (
                                <span className="rounded-none bg-gold/20 px-2 py-0.5 font-semibold text-gold">
                                  {staleDays}d stale
                                </span>
                              ) : null}
                              {related.questions.length > 0 ? (
                                <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-sand">
                                  {related.questions.length} Q
                                </span>
                              ) : null}
                              {related.tasks.filter((t) => t.status !== "done")
                                .length > 0 ? (
                                <span className="rounded-full bg-pink/10 px-2 py-0.5 font-semibold text-pink">
                                  {
                                    related.tasks.filter(
                                      (t) => t.status !== "done",
                                    ).length
                                  }{" "}
                                  FU
                                </span>
                              ) : null}
                              <span className="ml-auto text-sm font-bold text-ink">
                                {formatMoney(lead.value, "USD", true)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : view === "list" ? (
            <div className="mt-4 space-y-3">
              {filteredLeads.map((lead) => {
                const related = relatedForLead(lead);
                const score = leadPriority(
                  lead,
                  related.questions,
                  related.tasks,
                );
                return (
                  <article
                    key={lead.id}
                    className="border border-line bg-panel p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                      <div className="flex gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-accent text-sm font-bold text-white">
                          {initials(lead.name)}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-bold">
                              {lead.name}
                            </h3>
                            <StatusBadge tone={leadTone(lead.status)}>
                              {lead.status}
                            </StatusBadge>
                            <StatusBadge tone={priorityTone(score)}>
                              P{score} {priorityLabel(score)}
                            </StatusBadge>
                          </div>
                          <p className="text-sm text-mute">
                            {lead.company} · {lead.email} · Owner {lead.owner}
                          </p>
                          <p className="mt-3 max-w-3xl text-sm leading-relaxed">
                            {lead.notes}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-mute">
                            <span className="capitalize">
                              Source: {lead.source} — {sourceCopy[lead.source]}
                            </span>
                            <span>·</span>
                            <span>
                              Last contact {formatDate(lead.lastContact)} (
                              {daysBetween(lead.lastContact)}d)
                            </span>
                            <span>·</span>
                            <span>
                              {related.questions.length} questions ·{" "}
                              {
                                related.tasks.filter((t) => t.status !== "done")
                                  .length
                              }{" "}
                              open follow-ups
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end">
                        <p className="font-display text-xl font-bold">
                          {formatMoney(lead.value, "USD")}
                        </p>
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => setSelectedLead(lead)}
                        >
                          Open workspace
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto border border-line bg-panel">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-line bg-ash/60 text-xs uppercase tracking-[0.12em] text-mute">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Lead</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">Owner</th>
                    <th className="px-4 py-3 font-semibold">Q / FU</th>
                    <th className="px-4 py-3 font-semibold">Age</th>
                    <th className="px-4 py-3 font-semibold text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const related = relatedForLead(lead);
                    const score = leadPriority(
                      lead,
                      related.questions,
                      related.tasks,
                    );
                    return (
                      <tr
                        key={lead.id}
                        className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/30"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold">{lead.name}</p>
                          <p className="text-xs text-mute">{lead.company}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={leadTone(lead.status)}>
                            {lead.status}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={priorityTone(score)}>
                            {score}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 capitalize">{lead.source}</td>
                        <td className="px-4 py-3">{lead.owner}</td>
                        <td className="px-4 py-3 text-mute">
                          {related.questions.length} /{" "}
                          {
                            related.tasks.filter((t) => t.status !== "done")
                              .length
                          }
                        </td>
                        <td className="px-4 py-3 text-mute">
                          {daysBetween(lead.lastContact)}d
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatMoney(lead.value, "USD", true)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {tab === "questions" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Open" value={formatNumber(openQuestions)} />
            <KpiCard
              label="Converted"
              value={formatNumber(
                siteInquiries.filter((i) => i.status === "converted").length,
              )}
            />
            <KpiCard
              label="Rider chat"
              value={formatNumber(
                siteInquiries.filter((i) => i.channel === "yanga_care").length,
              )}
            />
            <KpiCard
              label="Wholesale"
              value={formatNumber(
                siteInquiries.filter((i) => i.channel === "wholesale").length,
              )}
            />
            <KpiCard
              label="Product Qs"
              value={formatNumber(
                siteInquiries.filter((i) => i.channel === "product_question")
                  .length,
              )}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="border border-line bg-panel p-4 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
                Channel SLA targets
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(Object.keys(channelLabel) as InquiryChannel[]).map((c) => (
                  <div
                    key={c}
                    className="flex items-center justify-between border border-line bg-ash/50 px-3 py-2 text-sm"
                  >
                    <span>{channelLabel[c]}</span>
                    <span className="font-semibold">{channelSlaHours[c]}h</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-line bg-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
                Conversion snapshot
              </p>
              <p className="mt-3 font-display text-3xl font-bold">
                {formatPercent(questionToLeadRate)}
              </p>
              <p className="mt-1 text-sm text-mute">
                of store questions already linked to a lead
              </p>
              <p className="mt-4 text-sm text-mute">
                {formatNumber(
                  siteInquiries.filter((i) => !i.leadId && i.status !== "closed")
                    .length,
                )}{" "}
                still eligible to convert
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select
              className={inputClass}
              value={questionStatus}
              onChange={(e) =>
                setQuestionStatus(e.target.value as InquiryStatus | "all")
              }
            >
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="triaged">Triaged</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
            </select>
            <select
              className={inputClass}
              value={questionChannel}
              onChange={(e) =>
                setQuestionChannel(e.target.value as InquiryChannel | "all")
              }
            >
              <option value="all">All channels</option>
              {(Object.keys(channelLabel) as InquiryChannel[]).map((c) => (
                <option key={c} value={c}>
                  {channelLabel[c]}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={questionSort}
              onChange={(e) =>
                setQuestionSort(e.target.value as QuestionSort)
              }
            >
              <option value="priority">Sort: priority</option>
              <option value="newest">Sort: newest</option>
              <option value="oldest">Sort: oldest</option>
              <option value="status">Sort: status</option>
              <option value="channel">Sort: channel</option>
              <option value="name">Sort: name A–Z</option>
            </select>
          </div>

          <p className="mt-3 text-sm text-mute">
            Showing{" "}
            <span className="font-semibold text-ink">
              {filteredQuestions.length}
            </span>{" "}
            store questions — sort by priority, convert to leads, or create
            follow-ups.
          </p>

          <div className="mt-4 space-y-3">
            {filteredQuestions.length === 0 ? (
              <div className="border border-line bg-panel">
                <EmptyHint>No questions match these filters.</EmptyHint>
              </div>
            ) : (
              filteredQuestions.map((inq) => {
                const score = questionPriority(inq);
                const age = daysBetween(inq.createdAt);
                const sla = channelSlaHours[inq.channel];
                const slaRisk =
                  (inq.status === "new" || inq.status === "triaged") &&
                  age * 24 >= sla * 0.75;
                return (
                  <article
                    key={inq.id}
                    className="border border-line bg-panel p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg font-bold">
                            {inq.subject}
                          </h3>
                          <StatusBadge tone={inquiryTone(inq.status)}>
                            {inq.status}
                          </StatusBadge>
                          <StatusBadge tone={priorityTone(score)}>
                            P{score}
                          </StatusBadge>
                          <span className="rounded-full bg-ash px-2 py-0.5 text-xs font-semibold text-mute">
                            {channelLabel[inq.channel]}
                          </span>
                          {slaRisk ? (
                            <StatusBadge tone="warning">SLA risk</StatusBadge>
                          ) : null}
                          {inq.leadId ? (
                            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-sand">
                              Linked lead
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-mute">
                          {inq.name} · {inq.email} · {formatDate(inq.createdAt)}{" "}
                          · Owner {inq.owner} · Target {sla}h
                        </p>
                        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink">
                          {inq.message}
                        </p>
                        <p className="mt-2 text-xs text-mute">{inq.page}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:flex-col">
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => setSelectedQuestion(inq)}
                        >
                          Manage
                        </button>
                        {!inq.leadId && inq.status !== "closed" ? (
                          <button
                            type="button"
                            className={btnPrimary}
                            onClick={() => {
                              convertInquiryToLead(inq.id);
                              setTab("leads");
                            }}
                          >
                            Convert
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </>
      ) : null}

      {tab === "followups" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Open"
              value={formatNumber(
                followUps.filter((f) => f.status === "open").length,
              )}
            />
            <KpiCard
              label="Overdue"
              value={formatNumber(overdueFollowUps.length)}
              hint="Breach SLA — clear first"
            />
            <KpiCard
              label="Due today"
              value={formatNumber(followBuckets.today.length)}
            />
            <KpiCard
              label="Done"
              value={formatNumber(
                followUps.filter((f) => f.status === "done").length,
              )}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { key: "overdue" as const, title: "Overdue", tone: "danger" as const },
                { key: "today" as const, title: "Due today", tone: "warning" as const },
                { key: "week" as const, title: "This week", tone: "info" as const },
                { key: "later" as const, title: "Later", tone: "neutral" as const },
              ] as const
            ).map((bucket) => (
              <div key={bucket.key} className="border border-line bg-panel p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{bucket.title}</p>
                  <StatusBadge tone={bucket.tone}>
                    {followBuckets[bucket.key].length}
                  </StatusBadge>
                </div>
                <ul className="mt-3 space-y-2">
                  {followBuckets[bucket.key].slice(0, 3).map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className="w-full text-left text-xs leading-relaxed text-mute hover:text-ink"
                        onClick={() => setSelectedFollowUp(f)}
                      >
                        <span className="font-semibold text-ink">{f.title}</span>
                        <br />
                        {f.owner} · {formatDate(f.dueAt)}
                      </button>
                    </li>
                  ))}
                  {followBuckets[bucket.key].length === 0 ? (
                    <li className="text-xs text-mute">None in this bucket</li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select
              className={inputClass}
              value={followStatus}
              onChange={(e) =>
                setFollowStatus(e.target.value as FollowUpStatus | "all")
              }
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="overdue">Overdue</option>
              <option value="done">Done</option>
            </select>
            <select
              className={inputClass}
              value={followOwner}
              onChange={(e) => setFollowOwner(e.target.value)}
            >
              <option value="all">All owners</option>
              {OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={followSort}
              onChange={(e) => setFollowSort(e.target.value as FollowSort)}
            >
              <option value="due_soon">Sort: due soonest</option>
              <option value="due_late">Sort: due latest</option>
              <option value="newest">Sort: newest created</option>
              <option value="status">Sort: status</option>
              <option value="owner">Sort: owner</option>
            </select>
          </div>

          <p className="mt-3 text-sm text-mute">
            Showing{" "}
            <span className="font-semibold text-ink">
              {filteredFollowUps.length}
            </span>{" "}
            follow-ups linked to questions, leads, and sales.
          </p>

          <div className="mt-4 space-y-3">
            {filteredFollowUps.length === 0 ? (
              <div className="border border-line bg-panel">
                <EmptyHint>No follow-ups match these filters.</EmptyHint>
              </div>
            ) : (
              filteredFollowUps.map((f) => (
                <article
                  key={f.id}
                  className="border border-line bg-panel p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-bold">
                          {f.title}
                        </h3>
                        <StatusBadge tone={followUpTone(f.status)}>
                          {f.status}
                        </StatusBadge>
                        <span className="rounded-full bg-ash px-2 py-0.5 text-xs font-semibold capitalize text-mute">
                          {f.relatedType}
                        </span>
                        <span className="rounded-full bg-ash px-2 py-0.5 text-xs font-semibold text-mute">
                          {dueBucket(f.dueAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-mute">
                        {f.relatedTo} · Due {formatDate(f.dueAt)} · Created{" "}
                        {formatDate(f.createdAt)} · {f.owner}
                      </p>
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed">
                        {f.notes}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {f.status !== "done" ? (
                        <button
                          type="button"
                          className={btnPrimary}
                          onClick={() => updateFollowUpStatus(f.id, "done")}
                        >
                          Mark done
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => setSelectedFollowUp(f)}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      ) : null}

      {tab === "insights" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Pipeline value"
              value={formatMoney(openPipelineValue, "USD", true)}
              hint="New + contacted + qualified"
            />
            <KpiCard
              label="Win rate"
              value={formatPercent(winRate)}
              hint={`${formatNumber(closedLeads)} closed opportunities`}
            />
            <KpiCard
              label="Question → lead"
              value={formatPercent(questionToLeadRate)}
              hint={`${formatNumber(siteInquiries.filter((i) => i.leadId).length)} linked`}
            />
            <KpiCard
              label="Team open tasks"
              value={formatNumber(openFollowUps)}
              hint={`${formatNumber(overdueFollowUps.length)} overdue`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ConversionFunnel
              title="Store → CRM funnel"
              impressions={siteInquiries.length}
              clicks={
                siteInquiries.filter((i) => i.status !== "closed").length +
                leads.filter((l) => l.source === "website").length
              }
              conversions={
                leads.filter((l) => l.status === "won").length +
                sales.filter((s) => s.source === "website" || s.source === "lead")
                  .length
              }
            />
            <DonutChart
              title="Lead source mix"
              segments={sourceMix}
              centerLabel={formatNumber(leads.length)}
              centerHint="leads"
            />
            <BarChart
              title="Owner workload (weighted)"
              points={ownerWorkload.map((o) => ({
                label: `${o.label} · ${o.leads}L/${o.questions}Q/${o.follows}F`,
                value: o.value,
              }))}
              formatValue={(n) => formatMoney(n, "USD", true)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BarChart
              title="Pipeline by stage value"
              points={pipelineStages.map((s) => ({
                label: statusCopy[s].title,
                value: byStatus[s].value,
              }))}
            />
            <Panel title="Recent activity across hub">
              <ul className="divide-y divide-line">
                {activityFeed.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-sand">
                          {item.kind}
                        </span>
                        <StatusBadge tone={item.tone}>{item.when}</StatusBadge>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-xs text-mute">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel title="Playbook notes for the demo">
            <div className="grid gap-4 p-4 text-sm leading-relaxed text-mute sm:grid-cols-3 sm:px-5">
              <div>
                <p className="font-semibold text-ink">Inbound questions</p>
                <p className="mt-1">
                  Shipping and Care questions clear first on SLA. Wholesale and
                  high-intent PDP questions convert into scored leads.
                </p>
              </div>
              <div>
                <p className="font-semibold text-ink">Follow-up discipline</p>
                <p className="mt-1">
                  Overdue buckets surface in Needs attention. Owners clear
                  today before touching later-week tasks.
                </p>
              </div>
              <div>
                <p className="font-semibold text-ink">Pipeline sorting</p>
                <p className="mt-1">
                  Default sort is priority score. Use stale / high-value chips
                  when reviewing Daniel’s growth queue with the client.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      <Modal open={openAdd} title="Add lead" onClose={() => setOpenAdd(false)} wide>
        <p className="mb-4 text-sm text-mute">
          Prefer converting a store question from the Questions tab when the
          contact started on yangaa.store.
        </p>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitLead}>
          <Field label="Full name">
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Company">
            <input
              required
              className={inputClass}
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Source">
            <select
              className={inputClass}
              value={form.source}
              onChange={(e) =>
                setForm({ ...form, source: e.target.value as LeadSource })
              }
            >
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stage">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as LeadStatus })
              }
            >
              {pipelineStages.map((s) => (
                <option key={s} value={s}>
                  {statusCopy[s].title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deal value (USD)">
            <input
              required
              type="number"
              min="0"
              className={inputClass}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </Field>
          <Field label="Owner">
            <select
              className={inputClass}
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
            >
              {OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                className={`${inputClass} min-h-24`}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className={btnPrimary}>
              Save lead
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
        open={openQuickFollow}
        title="Log follow-up"
        onClose={() => setOpenQuickFollow(false)}
      >
        <form className="grid gap-3" onSubmit={submitQuickFollow}>
          <Field label="Title">
            <input
              required
              className={inputClass}
              value={followForm.title}
              onChange={(e) =>
                setFollowForm({ ...followForm, title: e.target.value })
              }
            />
          </Field>
          <Field label="Related to">
            <input
              required
              className={inputClass}
              placeholder="Contact or company"
              value={followForm.relatedTo}
              onChange={(e) =>
                setFollowForm({ ...followForm, relatedTo: e.target.value })
              }
            />
          </Field>
          <Field label="Due date">
            <input
              required
              type="date"
              className={inputClass}
              value={followForm.dueAt}
              onChange={(e) =>
                setFollowForm({ ...followForm, dueAt: e.target.value })
              }
            />
          </Field>
          <Field label="Owner">
            <select
              className={inputClass}
              value={followForm.owner}
              onChange={(e) =>
                setFollowForm({ ...followForm, owner: e.target.value })
              }
            >
              {OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              className={`${inputClass} min-h-20`}
              value={followForm.notes}
              onChange={(e) =>
                setFollowForm({ ...followForm, notes: e.target.value })
              }
            />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary}>
              Save follow-up
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setOpenQuickFollow(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selectedLead}
        title={selectedLead?.name ?? "Lead"}
        onClose={() => setSelectedLead(null)}
        wide
      >
        {selectedLead ? (
          <LeadDetail
            lead={selectedLead}
            score={scoreFor(selectedLead)}
            questions={relatedForLead(selectedLead).questions}
            tasks={relatedForLead(selectedLead).tasks}
            onStatus={(s) => {
              updateLeadStatus(selectedLead.id, s);
              setSelectedLead({ ...selectedLead, status: s });
            }}
            onFollowUp={() => {
              addFollowUp({
                title: `Follow up with ${selectedLead.name}`,
                relatedTo: `${selectedLead.name} · ${selectedLead.company}`,
                relatedType: "lead",
                relatedId: selectedLead.id,
                dueAt: DEMO_TODAY,
                owner: selectedLead.owner,
                notes: selectedLead.notes,
              });
              setSelectedLead(null);
              setTab("followups");
            }}
            onSale={() => {
              addSale({
                customer: selectedLead.name,
                email: selectedLead.email,
                product: `${selectedLead.company} opportunity`,
                amount: selectedLead.value,
                source:
                  selectedLead.source === "website" ? "website" : "lead",
                inquiryId: null,
                leadId: selectedLead.id,
                notes: `Sale created from lead ${selectedLead.id}`,
              });
              updateLeadStatus(selectedLead.id, "won");
              setSelectedLead(null);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={!!selectedQuestion}
        title={selectedQuestion?.subject ?? "Question"}
        onClose={() => setSelectedQuestion(null)}
        wide
      >
        {selectedQuestion ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={inquiryTone(selectedQuestion.status)}>
                {selectedQuestion.status}
              </StatusBadge>
              <StatusBadge
                tone={priorityTone(questionPriority(selectedQuestion))}
              >
                P{questionPriority(selectedQuestion)}{" "}
                {priorityLabel(questionPriority(selectedQuestion))}
              </StatusBadge>
              <span className="text-sm text-mute">
                {channelLabel[selectedQuestion.channel]} · SLA{" "}
                {channelSlaHours[selectedQuestion.channel]}h
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border border-line bg-ash/60 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-mute">
                  Contact
                </p>
                <p className="mt-1 font-medium">{selectedQuestion.name}</p>
                <p className="text-mute">{selectedQuestion.email}</p>
              </div>
              <div className="border border-line bg-ash/60 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-mute">
                  Owner
                </p>
                <p className="mt-1 font-medium">{selectedQuestion.owner}</p>
                <p className="text-mute">
                  {formatDate(selectedQuestion.createdAt)}
                </p>
              </div>
              <div className="border border-line bg-ash/60 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-mute">
                  Linked lead
                </p>
                <p className="mt-1 font-medium">
                  {selectedQuestion.leadId ?? "Not converted"}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{selectedQuestion.message}</p>
            <p className="text-xs text-mute">{selectedQuestion.page}</p>
            <div className="flex flex-wrap gap-2">
              {!selectedQuestion.leadId ? (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    convertInquiryToLead(selectedQuestion.id);
                    setSelectedQuestion(null);
                    setTab("leads");
                  }}
                >
                  Convert to lead
                </button>
              ) : null}
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  addFollowUp({
                    title: `Reply: ${selectedQuestion.subject}`,
                    relatedTo: selectedQuestion.name,
                    relatedType: "inquiry",
                    relatedId: selectedQuestion.id,
                    dueAt: DEMO_TODAY,
                    owner: selectedQuestion.owner,
                    notes: selectedQuestion.message,
                  });
                  setSelectedQuestion(null);
                  setTab("followups");
                }}
              >
                Create follow-up
              </button>
              {selectedQuestion.status === "new" ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    updateInquiryStatus(selectedQuestion.id, "triaged");
                    setSelectedQuestion({
                      ...selectedQuestion,
                      status: "triaged",
                    });
                  }}
                >
                  Mark triaged
                </button>
              ) : null}
              {selectedQuestion.status !== "closed" ? (
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => {
                    updateInquiryStatus(selectedQuestion.id, "closed");
                    setSelectedQuestion({
                      ...selectedQuestion,
                      status: "closed",
                    });
                  }}
                >
                  Close question
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!selectedFollowUp}
        title={selectedFollowUp?.title ?? "Follow-up"}
        onClose={() => setSelectedFollowUp(null)}
      >
        {selectedFollowUp ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={followUpTone(selectedFollowUp.status)}>
                {selectedFollowUp.status}
              </StatusBadge>
              <span className="rounded-full bg-ash px-2 py-0.5 text-xs font-semibold capitalize text-mute">
                {selectedFollowUp.relatedType}
              </span>
              <span className="rounded-full bg-ash px-2 py-0.5 text-xs font-semibold text-mute">
                {dueBucket(selectedFollowUp.dueAt)}
              </span>
            </div>
            <p className="text-sm text-mute">{selectedFollowUp.relatedTo}</p>
            <p className="text-sm leading-relaxed">{selectedFollowUp.notes}</p>
            <p className="text-xs text-mute">
              Due {formatDate(selectedFollowUp.dueAt)} · Created{" "}
              {formatDate(selectedFollowUp.createdAt)} · {selectedFollowUp.owner}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedFollowUp.status !== "done" ? (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    updateFollowUpStatus(selectedFollowUp.id, "done");
                    setSelectedFollowUp({
                      ...selectedFollowUp,
                      status: "done",
                    });
                  }}
                >
                  Mark done
                </button>
              ) : null}
              {selectedFollowUp.status === "open" ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    updateFollowUpStatus(selectedFollowUp.id, "overdue");
                    setSelectedFollowUp({
                      ...selectedFollowUp,
                      status: "overdue",
                    });
                  }}
                >
                  Mark overdue
                </button>
              ) : null}
              {selectedFollowUp.status === "overdue" ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    updateFollowUpStatus(selectedFollowUp.id, "open");
                    setSelectedFollowUp({
                      ...selectedFollowUp,
                      status: "open",
                    });
                  }}
                >
                  Reopen as open
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function LeadDetail({
  lead,
  score,
  questions,
  tasks,
  onStatus,
  onFollowUp,
  onSale,
}: {
  lead: Lead;
  score: number;
  questions: SiteInquiry[];
  tasks: FollowUp[];
  onStatus: (s: LeadStatus) => void;
  onFollowUp: () => void;
  onSale: () => void;
}) {
  const staleDays = daysBetween(lead.lastContact);
  const timeline = [
    {
      when: lead.createdAt,
      label: "Lead created",
      detail: `Source ${lead.source} · ${formatMoney(lead.value, "USD", true)}`,
    },
    ...questions.map((q) => ({
      when: q.createdAt,
      label: `Store question · ${q.subject}`,
      detail: `${channelLabel[q.channel]} · ${q.status}`,
    })),
    ...tasks.map((t) => ({
      when: t.dueAt,
      label: `Follow-up · ${t.title}`,
      detail: `${t.status} · ${t.owner}`,
    })),
    {
      when: lead.lastContact,
      label: "Last contact logged",
      detail: `${staleDays} day${staleDays === 1 ? "" : "s"} ago`,
    },
  ].sort((a, b) => b.when.localeCompare(a.when));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4 border-b border-line pb-5">
        <span className="flex h-14 w-14 items-center justify-center bg-accent text-lg font-bold text-white">
          {initials(lead.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={leadTone(lead.status)}>{lead.status}</StatusBadge>
            <StatusBadge tone={priorityTone(score)}>
              P{score} {priorityLabel(score)}
            </StatusBadge>
            <span className="rounded-full bg-ash px-2 py-0.5 text-xs font-semibold capitalize text-mute">
              {lead.source}
            </span>
            {staleDays >= 5 && !["won", "lost"].includes(lead.status) ? (
              <StatusBadge tone="warning">{staleDays}d stale</StatusBadge>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-mute">
            {lead.company} · {lead.owner}
          </p>
          <p className="mt-1 text-sm text-mute">{sourceCopy[lead.source]}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.12em] text-mute">
            Deal value
          </p>
          <p className="font-display text-2xl font-bold">
            {formatMoney(lead.value, "USD")}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="border border-line bg-ash/60 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-mute">Email</p>
          <p className="mt-1 break-all font-medium">{lead.email}</p>
        </div>
        <div className="border border-line bg-ash/60 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-mute">Phone</p>
          <p className="mt-1 font-medium">{lead.phone}</p>
        </div>
        <div className="border border-line bg-ash/60 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-mute">Created</p>
          <p className="mt-1 font-medium">{formatDate(lead.createdAt)}</p>
        </div>
        <div className="border border-line bg-ash/60 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-mute">
            Last contact
          </p>
          <p className="mt-1 font-medium">{formatDate(lead.lastContact)}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
          Opportunity notes
        </p>
        <p className="mt-2 text-sm leading-relaxed">{lead.notes}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
            Linked store questions ({questions.length})
          </p>
          {questions.length === 0 ? (
            <p className="mt-2 text-sm text-mute">No linked questions yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="border border-line bg-ash/50 p-3 text-sm"
                >
                  <p className="font-medium">{q.subject}</p>
                  <p className="mt-1 text-xs text-mute">
                    {channelLabel[q.channel]} · {formatDate(q.createdAt)} ·{" "}
                    {q.status}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-mute">
                    {q.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
            Linked follow-ups ({tasks.length})
          </p>
          {tasks.length === 0 ? (
            <p className="mt-2 text-sm text-mute">No follow-ups yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 border border-line bg-ash/50 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="mt-1 text-xs text-mute">
                      Due {formatDate(t.dueAt)} · {t.owner}
                    </p>
                  </div>
                  <StatusBadge tone={followUpTone(t.status)}>
                    {t.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-mute">
          Activity timeline
        </p>
        <ol className="space-y-2 border border-line bg-ash/40 p-3">
          {timeline.map((item, i) => (
            <li key={`${item.when}-${item.label}-${i}`} className="text-sm">
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-mute">
                {formatDate(item.when)} · {item.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-mute">
          Move stage
        </p>
        <div className="flex flex-wrap gap-2">
          {pipelineStages.map((s) => (
            <button
              key={s}
              type="button"
              className={lead.status === s ? btnPrimary : btnSecondary}
              onClick={() => onStatus(s)}
            >
              {statusCopy[s].title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="button" className={btnPrimary} onClick={onFollowUp}>
          Create follow-up
        </button>
        <button type="button" className={btnSecondary} onClick={onSale}>
          Create sale
        </button>
      </div>
    </div>
  );
}
