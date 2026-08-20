"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { btnPrimary, btnSecondary, inputClass } from "@/components/modal";
import { useCrm } from "@/lib/crm-store";
import { type Lead, type LeadStatus } from "@/lib/demo-data";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import {
  groupMailRooms,
  type MailItem,
  type MailRoom,
  type ReplyItem,
} from "@/lib/mail/rooms";

const STAGES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
];

const AVATAR = [
  "bg-purple/70",
  "bg-green/60",
  "bg-gold/70",
  "bg-wine/60",
  "bg-accent/70",
];

function stageTitle(id: LeadStatus, t: (path: string) => string) {
  return t(`stages.${id}`);
}

function toneFor(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) % 9973;
  }
  return AVATAR[hash % AVATAR.length];
}

function initials(name: string, email: string) {
  const base = (name || email.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : base.slice(0, 2);
  return letters.toUpperCase();
}

function lastMessageFor(lead: Lead, roomsByEmail: Map<string, MailRoom>) {
  const room = roomsByEmail.get(lead.email.toLowerCase());
  if (room?.lastText) return room.lastText;
  return lead.notes;
}

function lastBodyFor(lead: Lead, roomsByEmail: Map<string, MailRoom>) {
  const room = roomsByEmail.get(lead.email.toLowerCase());
  const last = room?.messages[room.messages.length - 1];
  if (last?.clean.text) return last.clean.text;
  if (last?.clean.fields.length) {
    return last.clean.fields.map((f) => `${f.label}: ${f.value}`).join("\n");
  }
  return lastMessageFor(lead, roomsByEmail);
}

function stageClass(status: LeadStatus) {
  switch (status) {
    case "new":
      return "text-cream";
    case "contacted":
      return "text-chat-out-text";
    case "qualified":
      return "text-gold";
    case "won":
      return "text-sand";
    default:
      return "text-pink";
  }
}

export default function LeadsPage() {
  const { leads, sales, updateLeadStatus, addSale, ready } = useCrm();
  const { t, locale } = useLocale();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<LeadStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mail, setMail] = useState<MailItem[]>([]);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [ownAddresses, setOwnAddresses] = useState<(string | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    const q = `locale=${encodeURIComponent(locale)}`;
    void fetch(`/api/inbox/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { namecheap?: { user?: string }; brevo?: { sender?: string | null } } | null) => {
        if (cancelled || !json) return;
        setOwnAddresses([json.namecheap?.user ?? null, json.brevo?.sender ?? null]);
      })
      .catch(() => {
        /* inbox may be unconfigured */
      });
    void fetch(`/api/inbox/mail?${q}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((json: { messages?: MailItem[] }) => {
        if (!cancelled) setMail(json.messages ?? []);
      })
      .catch(() => {
        if (!cancelled) setMail([]);
      });
    void fetch(`/api/inbox/replies?${q}`)
      .then((r) => (r.ok ? r.json() : { replies: [] }))
      .then((json: { replies?: ReplyItem[] }) => {
        if (!cancelled) setReplies(json.replies ?? []);
      })
      .catch(() => {
        if (!cancelled) setReplies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const roomsByEmail = useMemo(() => {
    const rooms = groupMailRooms({
      mail,
      replies,
      ownAddresses,
      youPrefix: t("pages.inbox.youPrefix"),
      emptyPreview: t("pages.inbox.noMessage"),
    });
    return new Map(rooms.map((room) => [room.email.toLowerCase(), room]));
  }, [mail, replies, ownAddresses, t]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((id) => [id, 0])) as Record<
      LeadStatus,
      number
    >;
    for (const lead of leads) map[lead.status] += 1;
    return map;
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((lead) => {
        if (stage !== "all" && lead.status !== stage) return false;
        if (!q) return true;
        return `${lead.name} ${lead.email} ${lead.phone} ${lead.notes} ${lastMessageFor(lead, roomsByEmail)}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.lastContact.localeCompare(a.lastContact));
  }, [leads, query, stage, roomsByEmail]);

  const selected =
    visible.find((l) => l.id === selectedId) ??
    leads.find((l) => l.id === selectedId) ??
    null;

  useEffect(() => {
    if (!ready) return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      return;
    }
    if (selectedId || visible.length === 0) return;
    setSelectedId(visible[0].id);
  }, [ready, selectedId, visible]);

  const selectedRoom = selected
    ? roomsByEmail.get(selected.email.toLowerCase())
    : undefined;
  const selectedBody = selected
    ? lastBodyFor(selected, roomsByEmail)
    : "";

  const booked = selected
    ? sales.some(
        (s) =>
          s.leadId === selected.id ||
          s.email.toLowerCase() === selected.email.toLowerCase(),
      )
    : false;

  return (
    <div className="-mx-3 flex min-h-[calc(100svh-7rem)] flex-col border-y border-line bg-panel sm:-mx-6 sm:min-h-[calc(100svh-8rem)] lg:-mx-8">
      <div className="flex min-h-0 flex-1">
        <aside
          className={`min-w-0 flex-col border-r border-line ${
            selected ? "hidden md:flex md:w-80 lg:w-96" : "flex w-full md:w-80 lg:w-96"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <h1 className="font-display text-lg tracking-wide">{t("pages.leads.title")}</h1>
            <Link
              href="/inbox"
              className="text-xs font-semibold text-sand hover:text-gold"
            >
              {t("pages.leads.fullInbox")}
            </Link>
          </div>

          <div className="px-4 pt-3">
            <input
              className={`${inputClass} rounded-full sm:rounded-none`}
              placeholder={t("pages.leads.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 border-b border-line sm:grid-cols-6">
            <FilterTab
              label={t("common.all")}
              count={leads.length}
              active={stage === "all"}
              onClick={() => setStage("all")}
            />
            {STAGES.map((id) => (
              <FilterTab
                key={id}
                label={t(`stages.${id}`)}
                count={counts[id]}
                active={stage === id}
                onClick={() => setStage(id)}
              />
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!ready ? (
              <p className="px-4 py-8 text-center text-sm text-mute">{t("common.loading")}</p>
            ) : visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-mute">
                {leads.length === 0
                  ? t("pages.leads.noLeads")
                  : t("pages.leads.nothingMatches")}
              </p>
            ) : (
              visible.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                    lead.id === selectedId ? "bg-accent-soft" : "hover:bg-ash/50"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${toneFor(lead.email)}`}
                  >
                    {initials(lead.name, lead.email)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {lead.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-mute">
                        {formatDate(lead.lastContact)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-mute">
                        {lastMessageFor(lead, roomsByEmail) || lead.email}
                      </span>
                      <span
                        className={`shrink-0 text-[11px] font-semibold ${stageClass(lead.status)}`}
                      >
                        {stageTitle(lead.status, t)}
                      </span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section
          className={`min-w-0 flex-1 flex-col bg-canvas ${
            selected ? "flex" : "hidden md:flex"
          }`}
        >
          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-6">
              <p className="text-sm text-mute">{t("pages.leads.selectPerson")}</p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line bg-panel px-3 py-3 sm:px-5">
                <button
                  type="button"
                  aria-label={t("common.back")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center text-mute hover:text-ink md:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path
                      d="M11 4 6 9l5 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${toneFor(selected.email)}`}
                >
                  {initials(selected.name, selected.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{selected.name}</p>
                  <p className={`text-xs font-semibold ${stageClass(selected.status)}`}>
                    {stageTitle(selected.status, t)}
                  </p>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
                <dl className="max-w-lg space-y-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
                      {t("common.email")}
                    </dt>
                    <dd className="mt-1">
                      <a
                        href={`mailto:${selected.email}`}
                        className="text-sand hover:text-gold"
                      >
                        {selected.email}
                      </a>
                    </dd>
                  </div>
                  {selected.phone ? (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
                        {t("common.phone")}
                      </dt>
                      <dd className="mt-1">
                        <a href={`tel:${selected.phone}`} className="hover:text-gold">
                          {selected.phone}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
                      {t("pages.leads.lastContact")}
                    </dt>
                    <dd className="mt-1">{formatDate(selected.lastContact)}</dd>
                  </div>
                </dl>

                {selectedBody || selectedRoom?.lastSubject ? (
                  <div className="mt-6 max-w-lg">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
                      {t("pages.leads.lastMessage")}
                    </p>
                    {selectedRoom?.lastSubject ? (
                      <p className="mt-2 text-sm font-medium">
                        {selectedRoom.lastSubject}
                      </p>
                    ) : null}
                    {selectedBody ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-mute">
                        {selectedBody}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-8 max-w-lg">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
                    {t("pages.leads.stage")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => void updateLeadStatus(selected.id, id)}
                        className={`px-3 py-2 text-xs font-semibold transition-colors ${
                          selected.status === id
                            ? "bg-accent text-white"
                            : "border border-line text-mute hover:text-ink"
                        }`}
                      >
                        {t(`stages.${id}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  <Link
                    href={`/inbox?chat=${encodeURIComponent(selected.email)}`}
                    className={btnSecondary}
                  >
                    {t("pages.leads.openChat")}
                  </Link>
                  {!booked ? (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() =>
                        void addSale({
                          customer: selected.name,
                          email: selected.email,
                          product: selected.notes.slice(0, 80) || t("pages.leads.tourBooking"),
                          amount: selected.value || 0,
                          source: "lead",
                          inquiryId: null,
                          leadId: selected.id,
                          notes: selected.notes,
                        })
                      }
                    >
                      {t("pages.leads.createSale")}
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 px-1 py-2.5 text-[10px] font-semibold leading-tight sm:text-[11px] ${
        active
          ? "border-b-2 border-gold text-ink"
          : "border-b-2 border-transparent text-mute hover:text-ink"
      }`}
    >
      <span className="block truncate">{label}</span>
      {count > 0 ? (
        <span className="mt-0.5 block text-[10px] text-mute">{count}</span>
      ) : (
        <span className="mt-0.5 block h-3" />
      )}
    </button>
  );
}
