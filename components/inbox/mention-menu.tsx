"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n";

export type MentionCandidate = {
  id: string;
  name: string;
  email: string;
};

/** Lightweight @mention autocomplete for compose / notes. */
export function MentionMenu({
  draft,
  caret,
  candidates,
  onPick,
}: {
  draft: string;
  caret: number;
  candidates: MentionCandidate[];
  onPick: (insert: string, range: { start: number; end: number }) => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = draft.slice(0, caret);
    const match = before.match(/(^|[\s([{"'])@([\w.@+\-]*)$/);
    if (!match) {
      setQuery(null);
      return;
    }
    setStart(caret - (match[2]?.length ?? 0) - 1);
    setQuery((match[2] ?? "").toLowerCase());
  }, [draft, caret]);

  const hits = useMemo(() => {
    if (query == null) return [];
    const q = query;
    return candidates
      .filter((c) => {
        const hay = `${c.name} ${c.email}`.toLowerCase();
        return !q || hay.includes(q);
      })
      .slice(0, 8);
  }, [candidates, query]);

  if (query == null || hits.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="absolute bottom-[calc(100%+0.35rem)] left-2 z-20 w-[min(100%-1rem,16rem)] overflow-hidden rounded-xl border border-line bg-panel shadow-lg"
      role="listbox"
      aria-label={t("pages.inbox.mentions")}
    >
      {hits.map((c) => (
        <button
          key={c.id}
          type="button"
          role="option"
          className="flex w-full flex-col px-3 py-2 text-left hover:bg-ash"
          onClick={() =>
            onPick(`@${c.name || c.email}`, {
              start,
              end: caret,
            })
          }
        >
          <span className="truncate text-sm font-medium text-ink">
            {c.name || c.email}
          </span>
          <span className="truncate text-[11px] text-mute">{c.email}</span>
        </button>
      ))}
    </div>
  );
}
