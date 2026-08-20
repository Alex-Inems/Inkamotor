"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCrm } from "@/lib/crm-store";
import {
  cleanBody,
  contactFromFields,
  isBulkMail,
  previewOf,
  type CleanBody,
  type FormField,
} from "@/lib/mail/clean";
import { messageContact } from "@/lib/mail/extract";
import { currentUser } from "@/lib/session";

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

type Message = {
  key: string;
  mine: boolean;
  at: string;
  subject: string;
  clean: CleanBody;
  raw: string;
  mailId?: string;
};

type Group = { key: string; mine: boolean; at: string; items: Message[] };

type Room = {
  email: string;
  name: string | null;
  messages: Message[];
  lastAt: string;
  lastText: string;
  unread: number;
  bulk: boolean;
  lastSubject: string;
  lastMailId?: string;
  fields: FormField[];
};

type Filter = "inbox" | "unread" | "starred" | "promos";

const AUTO_SYNC_MS = 60_000;
const GROUP_WINDOW_MS = 5 * 60_000;
const STAR_KEY = "inbox.starred";

const AVATAR_TONES = [
  "bg-purple/70",
  "bg-green/60",
  "bg-gold/70",
  "bg-wine/60",
  "bg-accent/70",
];

function toneFor(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) % 9973;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function initialsOf(name: string | null, email: string) {
  const base = (name || email.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : base.slice(0, 2);
  return letters.toUpperCase();
}

function displayName(name: string | null, email: string) {
  if (name?.trim()) return name.trim();
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function stamp(iso: string) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const now = new Date();
  if (then.toDateString() === now.toDateString()) {
    return then.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const days = (now.getTime() - then.getTime()) / 86_400_000;
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "short" });
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function clockTime(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayLabel(iso: string) {
  const then = new Date(iso);
  const now = new Date();
  if (then.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (then.toDateString() === yesterday.toDateString()) return "Yesterday";
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: then.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export default function InboxPage() {
  const { addLead, addFollowUp, addSale, pushToast } = useCrm();
  const [mail, setMail] = useState<MailMessage[]>([]);
  const [replies, setReplies] = useState<MailReply[]>([]);
  const [conn, setConn] = useState<InboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("inbox");
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [starred, setStarred] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [opened, setOpened] = useState<string[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STAR_KEY);
      if (saved) setStarred(JSON.parse(saved) as string[]);
    } catch {
      /* first run */
    }
  }, []);

  const toggleStar = useCallback((email: string) => {
    setStarred((prev) => {
      const next = prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email];
      try {
        window.localStorage.setItem(STAR_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/inbox/status");
    if (res.ok) setConn((await res.json()) as InboxStatus);
  }, []);

  const loadMail = useCallback(async () => {
    const res = await fetch("/api/inbox/mail");
    const json = await res.json();
    if (!res.ok) {
      setMail([]);
      return;
    }
    setMail((json as { messages: MailMessage[] }).messages ?? []);
  }, []);

  const loadReplies = useCallback(async () => {
    const res = await fetch("/api/inbox/replies");
    if (!res.ok) {
      setReplies([]);
      return;
    }
    const json = await res.json();
    setReplies((json as { replies: MailReply[] }).replies ?? []);
  }, []);

  const sync = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      setSyncing(true);
      try {
        const res = await fetch("/api/inbox/mail", { method: "POST" });
        const json = await res.json();
        if (!res.ok) {
          if (!silent) pushToast((json as ApiError).error || "Sync failed");
          return;
        }
        setMail((json as { messages: MailMessage[] }).messages ?? []);
        setSyncedAt(new Date().toISOString());
        void loadStatus();
        if (!silent && ((json as { synced?: number }).synced ?? 0) === 0) {
          pushToast("No new messages");
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
    loadMail().finally(() => setLoading(false));
  }, [loadMail, loadReplies, loadStatus]);

  useEffect(() => {
    if (!conn?.namecheap.ready) return;
    let cancelled = false;
    const run = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void sync({ silent: true });
    };
    run();
    const timer = setInterval(run, AUTO_SYNC_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [conn?.namecheap.ready, sync]);

  const ownAddresses = useMemo(
    () => [conn?.namecheap.user, conn?.brevo.sender],
    [conn?.namecheap.user, conn?.brevo.sender],
  );

  /** One room per person, merging inbound mail with the replies you sent. */
  const rooms = useMemo(() => {
    const byEmail = new Map<string, Room>();

    const ensure = (email: string, name: string | null) => {
      const key = email.toLowerCase();
      const existing = byEmail.get(key);
      if (existing) {
        if (!existing.name && name) existing.name = name;
        return existing;
      }
      const fresh: Room = {
        email: key,
        name,
        messages: [],
        lastAt: "",
        lastText: "",
        unread: 0,
        bulk: false,
        lastSubject: "",
        fields: [],
      };
      byEmail.set(key, fresh);
      return fresh;
    };

    for (const m of mail) {
      const raw = m.bodyText || m.preview || "";
      const clean = cleanBody(raw, m.subject);
      const contact = messageContact({
        fromEmail: m.fromEmail,
        fromName: m.fromName,
        bodyText: raw,
        ownAddresses,
      });
      // A form robot's display name must never label the visitor's room
      const fromForm = clean.isForm || contact.fromForm;
      const formContact = clean.isForm
        ? contactFromFields(clean.fields)
        : { name: null, email: null };
      const room = ensure(
        formContact.email ?? contact.email,
        formContact.name ?? (fromForm ? contact.name : m.fromName),
      );
      room.messages.push({
        key: `in-${m.id}`,
        mine: false,
        at: m.receivedAt,
        subject: m.subject,
        clean,
        raw,
        mailId: m.id,
      });
      if (clean.fields.length > 0) room.fields = clean.fields;
      if (!m.isRead && !opened.includes(room.email)) room.unread += 1;
      if (isBulkMail({ fromEmail: m.fromEmail, isForm: clean.isForm, raw })) {
        room.bulk = true;
      }
    }

    for (const r of replies) {
      const room = ensure(r.toEmail, r.toName);
      room.messages.push({
        key: `out-${r.id}`,
        mine: true,
        at: r.sentAt,
        subject: r.subject,
        clean: cleanBody(r.bodyText, r.subject),
        raw: r.bodyText,
      });
    }

    const list = [...byEmail.values()];
    for (const room of list) {
      room.messages.sort((a, b) => a.at.localeCompare(b.at));
      const last = room.messages[room.messages.length - 1];
      room.lastAt = last?.at ?? "";
      room.lastText = last
        ? `${last.mine ? "You: " : ""}${previewOf(last.clean, "(no message)")}`
        : "";
      const lastIn = [...room.messages].reverse().find((m) => !m.mine);
      room.lastSubject = lastIn?.subject ?? last?.subject ?? "";
      room.lastMailId = lastIn?.mailId;
    }
    return list.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [mail, replies, ownAddresses, opened]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (filter === "promos" ? !room.bulk : room.bulk) return false;
      if (filter === "unread" && room.unread === 0) return false;
      if (filter === "starred" && !starred.includes(room.email)) return false;
      if (!q) return true;
      return `${room.name ?? ""} ${room.email} ${room.lastText} ${room.lastSubject}`
        .toLowerCase()
        .includes(q);
    });
  }, [rooms, query, filter, starred]);

  const active = rooms.find((r) => r.email === activeEmail) ?? null;

  // Land in a conversation instead of an empty pane
  useEffect(() => {
    if (activeEmail || visible.length === 0) return;
    const first = visible[0].email;
    setActiveEmail(first);
    setOpened((prev) => (prev.includes(first) ? prev : [...prev, first]));
  }, [activeEmail, visible]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.email, active?.messages.length]);

  const groups = useMemo<Group[]>(() => {
    if (!active) return [];
    const out: Group[] = [];
    for (const m of active.messages) {
      const last = out[out.length - 1];
      const prev = last?.items[last.items.length - 1];
      const close =
        last &&
        prev &&
        last.mine === m.mine &&
        dayLabel(prev.at) === dayLabel(m.at) &&
        new Date(m.at).getTime() - new Date(prev.at).getTime() <
          GROUP_WINDOW_MS;
      if (close) last.items.push(m);
      else out.push({ key: m.key, mine: m.mine, at: m.at, items: [m] });
    }
    return out;
  }, [active]);

  const unreadTotal = rooms.reduce(
    (n, r) => n + (r.bulk ? 0 : r.unread),
    0,
  );

  function openRoom(email: string) {
    setActiveEmail(email);
    setDraft("");
    setShowOriginal(false);
    setOpened((prev) => (prev.includes(email) ? prev : [...prev, email]));
  }

  async function send() {
    if (!active || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: active.email,
          toName: active.name || undefined,
          inReplyToSubject: active.lastSubject,
          message: draft.trim(),
          relatedMailId: active.lastMailId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast((json as ApiError).error || "Could not send");
        return;
      }
      setDraft("");
      if ((json as { storeWarning?: string }).storeWarning) {
        pushToast("Sent, but not saved to history yet");
      }
      await loadReplies();
    } finally {
      setSending(false);
    }
  }

  const activeName = active ? displayName(active.name, active.email) : "";

  return (
    <div className="flex h-full min-h-0">
      {/* Rooms */}
      <aside
        className={`min-w-0 flex-col border-r border-line bg-panel ${
          !active
            ? "flex w-full"
            : detailsOpen
              ? // Details takes this slot until there's room for all three panes
                "hidden xl:flex xl:w-80"
              : "hidden md:flex md:w-72 lg:w-80"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <h1 className="font-display text-lg tracking-wide">Messages</h1>
          {unreadTotal > 0 ? (
            <span className="bg-accent px-2 py-0.5 text-xs font-bold text-white">
              {unreadTotal}
            </span>
          ) : null}
        </div>

        <div className="px-4 pt-3">
          <input
            className="w-full border border-line bg-ash px-3 py-2 text-sm outline-none placeholder:text-mute/70 focus:border-gold"
            placeholder="Search messages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-1 px-4 py-3">
          {(
            [
              { id: "inbox" as const, label: "All" },
              { id: "unread" as const, label: "Unread" },
              { id: "starred" as const, label: "Starred" },
              { id: "promos" as const, label: "Promos" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === tab.id
                  ? "bg-accent text-white"
                  : "text-mute hover:bg-ash hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {conn && !conn.namecheap.ready ? (
          <p className="border-y border-line bg-gold/10 px-4 py-2 text-xs text-gold">
            Mailbox not connected yet — finish Setup to receive messages.
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-mute">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-mute">
              {query
                ? "Nothing matches that search."
                : filter === "unread"
                  ? "Nothing unread."
                  : filter === "starred"
                    ? "No starred conversations yet."
                    : "No messages here."}
            </p>
          ) : (
            visible.map((room) => (
              <RoomRow
                key={room.email}
                room={room}
                active={room.email === activeEmail}
                starred={starred.includes(room.email)}
                onOpen={() => openRoom(room.email)}
                onStar={() => toggleStar(room.email)}
              />
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => void sync({ silent: false })}
          disabled={syncing || !conn?.namecheap.ready}
          className="border-t border-line px-4 py-2.5 text-left text-[11px] text-mute transition-colors hover:text-ink disabled:opacity-60"
        >
          {syncing
            ? "Checking for new messages…"
            : syncedAt
              ? `Updated ${clockTime(syncedAt)} · check now`
              : "Check for new messages"}
        </button>
      </aside>

      {/* Thread */}
      <section
        className={`min-w-0 flex-1 flex-col bg-canvas ${
          !active || detailsOpen ? "hidden md:flex" : "flex"
        }`}
      >
        {!active ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-sm text-mute">Select a conversation.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line bg-panel px-3 py-2.5 sm:px-4">
              <button
                type="button"
                aria-label="Back"
                className="-ml-1 shrink-0 px-2 py-2 text-mute hover:text-ink md:hidden"
                onClick={() => setActiveEmail(null)}
              >
                <BackIcon />
              </button>
              <Avatar name={active.name} email={active.email} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {activeName}
                </p>
                <p className="truncate text-xs text-mute">
                  {active.lastSubject || active.email}
                </p>
              </div>
              <button
                type="button"
                aria-label={starred.includes(active.email) ? "Unstar" : "Star"}
                title={starred.includes(active.email) ? "Unstar" : "Star"}
                onClick={() => toggleStar(active.email)}
                className={`shrink-0 px-2 py-2 transition-colors ${
                  starred.includes(active.email)
                    ? "text-gold"
                    : "text-mute hover:text-ink"
                }`}
              >
                <StarIcon filled={starred.includes(active.email)} />
              </button>
              <button
                type="button"
                aria-label="Details"
                title="Details"
                onClick={() => setDetailsOpen((v) => !v)}
                className={`shrink-0 px-2 py-2 transition-colors ${
                  detailsOpen ? "text-gold" : "text-mute hover:text-ink"
                }`}
              >
                <InfoIcon />
              </button>
            </header>

            <div
              ref={threadRef}
              className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
            >
              {groups.map((group, i) => {
                const prev = groups[i - 1];
                const newDay = !prev || dayLabel(prev.at) !== dayLabel(group.at);
                return (
                  <div key={group.key}>
                    {newDay ? (
                      <div className="flex items-center gap-3 py-4">
                        <span className="h-px flex-1 bg-line" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
                          {dayLabel(group.at)}
                        </span>
                        <span className="h-px flex-1 bg-line" />
                      </div>
                    ) : null}
                    <MessageGroup
                      group={group}
                      contactName={activeName}
                      contactEmail={active.email}
                      showOriginal={showOriginal}
                    />
                  </div>
                );
              })}
            </div>

            <footer className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
              {conn?.brevo.ready ? (
                <div className="border border-line bg-panel focus-within:border-gold">
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={`Message ${activeName}`}
                    className="max-h-40 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-mute/70"
                  />
                  <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2">
                    <span className="truncate text-[11px] text-mute">
                      Enter to send · Shift+Enter for a new line
                    </span>
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={sending || !draft.trim()}
                      className="shrink-0 bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="border border-line bg-panel px-3 py-3 text-xs text-gold">
                  Sending isn’t set up yet — finish Setup to reply from here.
                </p>
              )}
            </footer>
          </>
        )}
      </section>

      {/* Details */}
      {active && detailsOpen ? (
        <aside className="flex w-full min-w-0 flex-col border-l border-line bg-panel md:w-72 lg:w-80">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">Details</p>
            <button
              type="button"
              aria-label="Close details"
              onClick={() => setDetailsOpen(false)}
              className="px-2 py-1 text-mute hover:text-ink"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Avatar name={active.name} email={active.email} large />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{activeName}</p>
                <p className="truncate text-xs text-mute">{active.email}</p>
              </div>
            </div>

            <dl className="space-y-2 text-xs">
              {active.fields
                .filter(
                  (f) =>
                    f.value.toLowerCase() !== active.email &&
                    f.value.toLowerCase() !== activeName.toLowerCase(),
                )
                .map((f) => (
                  <div key={`${f.label}-${f.value}`} className="flex gap-2">
                    <dt className="w-20 shrink-0 text-mute">{f.label}</dt>
                    <dd className="min-w-0 wrap-break-word">{f.value}</dd>
                  </div>
                ))}
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-mute">Messages</dt>
                <dd>{active.messages.length}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-mute">Last</dt>
                <dd>{stamp(active.lastAt)}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => setShowOriginal((v) => !v)}
              className="w-full border border-line px-3 py-2 text-xs font-semibold text-mute transition-colors hover:bg-ash hover:text-ink"
            >
              {showOriginal ? "Show tidied messages" : "Show original emails"}
            </button>

            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
                Add to CRM
              </p>
              <DetailAction
                label="Save as lead"
                onClick={() =>
                  void addLead({
                    name: activeName,
                    email: active.email,
                    phone:
                      active.fields.find((f) =>
                        /phone|tel|télé/i.test(f.label),
                      )?.value ?? "",
                    company: "",
                    source: "website",
                    status: "new",
                    value: 0,
                    currency: "USD",
                    owner: "Team",
                    notes: `From inbox: ${active.lastSubject}`,
                  })
                }
              />
              <DetailAction
                label="Create follow-up"
                onClick={() =>
                  void addFollowUp({
                    title: `Follow up: ${activeName}`,
                    relatedTo: activeName,
                    relatedType: "inquiry",
                    relatedId: active.lastMailId ?? active.email,
                    dueAt: new Date().toISOString().slice(0, 10),
                    owner: "Team",
                    notes: `From inbox message: ${active.lastSubject}`,
                  })
                }
              />
              <DetailAction
                label="Create sale"
                onClick={() =>
                  void addSale({
                    customer: activeName,
                    email: active.email,
                    product: active.lastSubject || "Tour enquiry",
                    amount: 0,
                    source: "website",
                    inquiryId: null,
                    leadId: null,
                    notes: `Started from inbox: ${active.lastSubject}`,
                  })
                }
              />
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function RoomRow({
  room,
  active,
  starred,
  onOpen,
  onStar,
}: {
  room: Room;
  active: boolean;
  starred: boolean;
  onOpen: () => void;
  onStar: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-3 border-b border-line px-4 py-3 transition-colors ${
        active ? "bg-accent-soft" : "hover:bg-ash/60"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar name={room.name} email={room.email} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-sm ${
                room.unread > 0 ? "font-bold text-ink" : "font-medium text-ink"
              }`}
            >
              {displayName(room.name, room.email)}
            </span>
            <span className="shrink-0 text-[11px] text-mute">
              {stamp(room.lastAt)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span
              className={`truncate text-xs ${
                room.unread > 0 ? "text-ink" : "text-mute"
              }`}
            >
              {room.lastText}
            </span>
            {room.unread > 0 ? (
              <span className="shrink-0 bg-accent px-1.5 text-[11px] font-bold text-white">
                {room.unread}
              </span>
            ) : null}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={starred ? "Unstar conversation" : "Star conversation"}
        onClick={onStar}
        className={`shrink-0 p-1 transition-colors ${
          starred
            ? "text-gold"
            : "text-transparent hover:text-ink group-hover:text-mute"
        }`}
      >
        <StarIcon filled={starred} />
      </button>
    </div>
  );
}

function MessageGroup({
  group,
  contactName,
  contactEmail,
  showOriginal,
}: {
  group: Group;
  contactName: string;
  contactEmail: string;
  showOriginal: boolean;
}) {
  const author = group.mine ? currentUser.name : contactName;

  return (
    <div className="flex gap-3 py-2">
      {group.mine ? (
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center text-xs font-bold text-white"
          style={{ background: currentUser.avatarHue }}
        >
          {currentUser.initials}
        </span>
      ) : (
        <Avatar name={contactName} email={contactEmail} />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink">
            {author}
          </span>
          <span className="shrink-0 text-[11px] text-mute">
            {clockTime(group.at)}
          </span>
        </p>
        <div className="mt-1 space-y-2">
          {group.items.map((m) => (
            <MessageBody key={m.key} message={m} showOriginal={showOriginal} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBody({
  message,
  showOriginal,
}: {
  message: Message;
  showOriginal: boolean;
}) {
  const [showQuoted, setShowQuoted] = useState(false);
  const { clean } = message;

  if (showOriginal) {
    return (
      <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap wrap-break-word border border-line bg-ash/40 p-2 text-xs text-mute">
        {message.raw}
      </pre>
    );
  }

  return (
    <div className="text-sm leading-relaxed text-ink">
      {clean.fields.length > 0 ? (
        <dl className="mb-2 space-y-0.5 border-l-2 border-line pl-3 text-xs text-mute">
          {clean.fields.map((f) => (
            <div key={`${f.label}-${f.value}`} className="flex gap-2">
              <dt>{f.label}</dt>
              <dd className="min-w-0 wrap-break-word text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="whitespace-pre-wrap wrap-break-word">
        {clean.text || (
          <span className="text-mute">(no message text)</span>
        )}
      </p>

      {clean.quoted ? (
        <>
          <button
            type="button"
            onClick={() => setShowQuoted((v) => !v)}
            className="mt-1 text-[11px] font-semibold text-mute underline-offset-2 hover:text-ink hover:underline"
          >
            {showQuoted ? "Hide earlier messages" : "Show earlier messages"}
          </button>
          {showQuoted ? (
            <pre className="mt-1.5 max-h-52 overflow-y-auto whitespace-pre-wrap wrap-break-word border-l-2 border-line pl-3 text-xs text-mute">
              {clean.quoted}
            </pre>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Avatar({
  name,
  email,
  large,
}: {
  name: string | null;
  email: string;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center font-bold text-white ${
        large ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs"
      } ${toneFor(email)}`}
    >
      {initialsOf(name, email)}
    </span>
  );
}

function DetailAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border border-line px-3 py-2 text-left text-xs font-semibold text-ink transition-colors hover:bg-ash"
    >
      {label}
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.8z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 7v4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 3l8 8M11 3l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M11 4 6 9l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
