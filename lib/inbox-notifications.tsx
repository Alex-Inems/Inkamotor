"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useCrm } from "@/lib/crm-store";
import { useLocale } from "@/lib/i18n";

export type InboxNotification = {
  id: string;
  fromName: string | null;
  fromEmail: string;
  subject: string;
  preview: string;
  receivedAt: string;
};

type NotificationsState = {
  unread: number;
  items: InboxNotification[];
  dismissAll: () => void;
};

const DISMISS_KEY = "inkamoto-notif-dismissed";
const POLL_MS = 30_000;
const SYNC_MS = 90_000;

const NotificationsContext = createContext<NotificationsState | null>(null);

function readDismissed() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(ids.slice(-80)));
  } catch {
    /* storage unavailable */
  }
}

export function InboxNotificationsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { locale, t } = useLocale();
  const { pushToast } = useCrm();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const seenIds = useRef<Set<string> | null>(null);
  const syncing = useRef(false);
  const ready = useRef(false);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/notifications?locale=${locale}`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      unread?: number;
      items?: InboxNotification[];
    };
    const nextItems = json.items ?? [];
    const nextUnread = json.unread ?? nextItems.length;
    const nextIds = new Set(nextItems.map((item) => item.id));

    if (seenIds.current) {
      const fresh = nextItems.filter((item) => !seenIds.current!.has(item.id));
      if (fresh.length > 0 && ready.current) {
        const first = fresh[0]!;
        const name = first.fromName || first.fromEmail;
        pushToast(
          fresh.length === 1
            ? t("topbar.newMessage", { name })
            : t("topbar.newMessages", { n: fresh.length }),
        );
      }
      for (const id of nextIds) seenIds.current.add(id);
    } else {
      seenIds.current = nextIds;
    }

    setItems(nextItems);
    setUnread(nextUnread);
    setDismissed((prev) => {
      const keep = prev.filter((id) => nextIds.has(id) || nextUnread === 0);
      if (keep.length !== prev.length) writeDismissed(keep);
      return keep;
    });
    ready.current = true;
  }, [locale, pushToast, t]);

  const syncMail = useCallback(async () => {
    if (syncing.current || document.visibilityState === "hidden") return;
    syncing.current = true;
    try {
      await fetch("/api/inbox/mail", { method: "POST" });
      await load();
    } catch {
      /* inbox may not be connected */
    } finally {
      syncing.current = false;
    }
  }, [load]);

  useEffect(() => {
    void load();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    const onInbox = pathname === "/inbox" || pathname.startsWith("/inbox/");
    if (onInbox) return;
    void syncMail();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void syncMail();
    }, SYNC_MS);
    return () => clearInterval(timer);
  }, [pathname, syncMail]);

  const dismissAll = useCallback(() => {
    const ids = items.map((item) => item.id);
    setDismissed(ids);
    writeDismissed(ids);
  }, [items]);

  const visibleItems = items.filter((item) => !dismissed.includes(item.id));
  const badge = dismissed.length === 0 ? unread : visibleItems.length;

  const value = useMemo(
    () => ({
      unread: badge,
      items: visibleItems,
      dismissAll,
    }),
    [badge, dismissAll, visibleItems],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useInboxNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    return {
      unread: 0,
      items: [] as InboxNotification[],
      dismissAll: () => {},
    };
  }
  return ctx;
}
