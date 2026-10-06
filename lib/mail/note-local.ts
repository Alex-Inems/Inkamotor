import type { MailNote } from "@/lib/mail/notes";

export function isTempMailNoteId(id: string) {
  return id.startsWith("temp-");
}

export function makeOptimisticMailNote(input: {
  threadEmail: string;
  bodyText: string;
  authorName?: string | null;
  relatedSaleId?: string | null;
}): MailNote {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `temp-${crypto.randomUUID()}`
      : `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    threadEmail: input.threadEmail.trim().toLowerCase(),
    bodyText: input.bodyText.trim(),
    bodyHtml: "",
    authorEmail: null,
    authorName: input.authorName ?? null,
    relatedSaleId: input.relatedSaleId ?? null,
    createdAt: new Date().toISOString(),
    editedAt: null,
  };
}

/**
 * Keep optimistic / just-saved notes when a slower GET would otherwise wipe them.
 * Local-only rows younger than 2 minutes are preserved until the server catches up.
 */
export function mergeMailNotes(server: MailNote[], prev: MailNote[]): MailNote[] {
  const serverIds = new Set(server.map((n) => n.id));
  const now = Date.now();
  const extras = prev.filter((n) => {
    if (serverIds.has(n.id)) return false;
    if (isTempMailNoteId(n.id)) {
      return !server.some(
        (s) =>
          s.bodyText.trim() === n.bodyText.trim() &&
          Math.abs(new Date(s.createdAt).getTime() - new Date(n.createdAt).getTime()) <
            120_000,
      );
    }
    const age = now - new Date(n.createdAt).getTime();
    return Number.isFinite(age) && age >= 0 && age < 120_000;
  });
  if (!extras.length) return server;
  return [...server, ...extras].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function replaceTempMailNote(
  prev: MailNote[],
  tempId: string,
  saved: MailNote | null | undefined,
): MailNote[] {
  const withoutTemp = prev.filter((n) => n.id !== tempId);
  if (!saved) return withoutTemp;
  if (withoutTemp.some((n) => n.id === saved.id)) return withoutTemp;
  return [...withoutTemp, saved].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
