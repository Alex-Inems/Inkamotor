"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  inputClass,
  Modal,
} from "@/components/modal";
import { PageHeader, StatusBadge } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import { type Lead, type LeadStatus } from "@/lib/demo-data";
import { formatDate } from "@/lib/format";
import { leadTone } from "@/lib/status";

const STAGES: {
  id: LeadStatus;
  title: string;
  bar: string;
  chip: string;
}[] = [
  { id: "new", title: "Need reply", bar: "bg-purple", chip: "bg-purple/30 text-cream" },
  { id: "contacted", title: "Talking", bar: "bg-chat-out", chip: "bg-chat-out/30 text-cream" },
  { id: "qualified", title: "Ready to book", bar: "bg-gold", chip: "bg-gold/20 text-gold" },
  { id: "won", title: "Booked", bar: "bg-green", chip: "bg-green/25 text-sand" },
  { id: "lost", title: "Not booked", bar: "bg-wine", chip: "bg-wine/25 text-pink" },
];

function stageOf(id: LeadStatus) {
  return STAGES.find((s) => s.id === id)!;
}

function initials(name: string, email: string) {
  const base = (name || email.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : base.slice(0, 2);
  return letters.toUpperCase();
}

export default function LeadsPage() {
  const { leads, sales, updateLeadStatus, addSale, ready } = useCrm();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<LeadStatus | "all">("all");
  const [selected, setSelected] = useState<Lead | null>(null);

  const counts = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s.id, 0])) as Record<
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
        return `${lead.name} ${lead.email} ${lead.phone} ${lead.notes}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.lastContact.localeCompare(a.lastContact));
  }, [leads, query, stage]);

  const columns = stage === "all" ? STAGES : STAGES.filter((s) => s.id === stage);

  return (
    <div>
      <PageHeader
        title="Leads"
        action={
          <Link href="/inbox" className={btnSecondary}>
            Inbox
          </Link>
        }
      />

      <div className="flex flex-col gap-3">
        <input
          className={`${inputClass} sm:max-w-md`}
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          <StageChip
            label="All"
            count={leads.length}
            active={stage === "all"}
            onClick={() => setStage("all")}
          />
          {STAGES.map((s) => (
            <StageChip
              key={s.id}
              label={s.title}
              count={counts[s.id]}
              active={stage === s.id}
              tone={s.chip}
              onClick={() => setStage(s.id)}
            />
          ))}
        </div>
      </div>

      {ready ? null : (
        <p className="mt-6 text-sm text-mute">Loading…</p>
      )}

      {ready ? (
        <div
          className={`mt-6 grid gap-3 ${
            stage === "all"
              ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"
              : "grid-cols-1 sm:max-w-sm"
          }`}
        >
          {columns.map((col) => {
            const cards = visible.filter((l) => l.status === col.id);
            return (
              <section
                key={col.id}
                className="flex min-h-64 flex-col overflow-hidden border border-line bg-ash/40 xl:min-h-[min(32rem,calc(100svh-14rem))]"
              >
                <header className="shrink-0 border-b border-line bg-panel">
                  <div className={`h-1 ${col.bar}`} />
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <p className="truncate text-sm font-semibold">{col.title}</p>
                    <span className="flex h-5 min-w-5 items-center justify-center bg-ash px-1.5 text-[11px] font-bold text-mute">
                      {cards.length}
                    </span>
                  </div>
                </header>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {cards.length === 0 ? (
                    <p className="px-2 py-8 text-center text-xs text-mute">
                      {leads.length === 0 ? "Waiting for Inbox" : "None"}
                    </p>
                  ) : (
                    cards.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onOpen={() => setSelected(lead)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      <Modal
        open={!!selected}
        title={selected?.name ?? "Lead"}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <LeadDetail
            lead={selected}
            booked={sales.some(
              (s) =>
                s.leadId === selected.id ||
                s.email.toLowerCase() === selected.email.toLowerCase(),
            )}
            onStatus={(status) => {
              void updateLeadStatus(selected.id, status);
              setSelected({ ...selected, status });
            }}
            onSale={() => {
              void addSale({
                customer: selected.name,
                email: selected.email,
                product: selected.notes.slice(0, 80) || "Tour booking",
                amount: selected.value || 0,
                source: "lead",
                inquiryId: null,
                leadId: selected.id,
                notes: selected.notes,
              });
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function StageChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
        active
          ? "bg-accent text-white"
          : "border border-line bg-panel text-mute hover:text-ink"
      }`}
    >
      {label}
      <span
        className={`min-w-4 text-[10px] ${
          active ? "text-white/80" : tone ?? "text-mute"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function Avatar({ name, email }: { name: string; email: string }) {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white"
    >
      {initials(name, email)}
    </span>
  );
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-2.5 border border-line bg-panel p-2.5 text-left transition-colors hover:border-gold/40 hover:bg-accent-soft/30"
    >
      <Avatar name={lead.name} email={lead.email} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight">
          {lead.name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-mute">
          {lead.email}
        </span>
        <span className="mt-1.5 block text-[10px] text-mute">
          {formatDate(lead.lastContact)}
        </span>
      </span>
    </button>
  );
}

function LeadDetail({
  lead,
  booked,
  onStatus,
  onSale,
}: {
  lead: Lead;
  booked: boolean;
  onStatus: (status: LeadStatus) => void;
  onSale: () => void;
}) {
  const current = stageOf(lead.status);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
          {initials(lead.name, lead.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{lead.name}</p>
          <a
            href={`mailto:${lead.email}`}
            className="block truncate text-sm text-sand hover:text-gold"
          >
            {lead.email}
          </a>
          {lead.phone ? (
            <a href={`tel:${lead.phone}`} className="text-sm text-mute hover:text-ink">
              {lead.phone}
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <StatusBadge tone={leadTone(lead.status)}>{current.title}</StatusBadge>
        <span className="text-xs text-mute">Last {formatDate(lead.lastContact)}</span>
      </div>

      {lead.notes ? (
        <p className="border border-line bg-ash px-3 py-2.5 text-sm leading-relaxed text-mute">
          {lead.notes}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={lead.status === s.id}
            onClick={() => onStatus(s.id)}
            className={
              lead.status === s.id
                ? btnPrimary
                : `${btnGhost} border border-line`
            }
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/inbox?chat=${encodeURIComponent(lead.email)}`}
          className={btnSecondary}
        >
          Open chat
        </Link>
        {!booked ? (
          <button type="button" className={btnPrimary} onClick={onSale}>
            Create sale
          </button>
        ) : null}
      </div>
    </div>
  );
}
