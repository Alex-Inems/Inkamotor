"use client";

import { useCallback, useEffect, useState } from "react";

export type WorkspaceNotice = {
  id: string;
  kind: "newsletter";
  title: string;
  body: string;
  href: string;
  at: string;
};

const KEY = "inkamoto-workspace-notices";
const EVENT = "inkamoto-notices";

function readNotices(): WorkspaceNotice[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is WorkspaceNotice =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as WorkspaceNotice).id === "string" &&
        (row as WorkspaceNotice).kind === "newsletter",
    );
  } catch {
    return [];
  }
}

function writeNotices(rows: WorkspaceNotice[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 20)));
  window.dispatchEvent(new Event(EVENT));
}

export function pushWorkspaceNotice(
  input: Omit<WorkspaceNotice, "id" | "at">,
) {
  const row: WorkspaceNotice = {
    ...input,
    id: `wn-${Date.now()}`,
    at: new Date().toISOString(),
  };
  writeNotices([row, ...readNotices().filter((item) => item.id !== row.id)]);
}

export function dismissWorkspaceNotices() {
  writeNotices([]);
}

export function useWorkspaceNotices() {
  const [items, setItems] = useState<WorkspaceNotice[]>([]);

  const reload = useCallback(() => {
    setItems(readNotices());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  return { items, reload, dismissAll: dismissWorkspaceNotices };
}
