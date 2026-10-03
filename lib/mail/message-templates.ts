import seed from "@/lib/seed/odoo-message-templates.json";

export type MessageTemplateModel =
  | "crm.lead"
  | "sale.order"
  | "res.partner"
  | "account.move";

export type MessageTemplate = {
  id: number;
  name: string;
  model: MessageTemplateModel;
  subject: string;
  body: string;
  /** User-saved from the composer (local). */
  custom?: boolean;
};

const CUSTOM_STORAGE_KEY = "inkamoto.messageTemplates.custom";

/** Inkamoto mail.template records synced from Odoo (business templates only). */
export const MESSAGE_TEMPLATES = seed.templates as MessageTemplate[];

function readCustomTemplates(): MessageTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const item = row as Record<string, unknown>;
        return {
          id: Number(item.id) || Date.now(),
          name: String(item.name ?? "").trim() || "Template",
          model: (String(item.model ?? "res.partner") as MessageTemplateModel),
          subject: String(item.subject ?? ""),
          body: String(item.body ?? ""),
          custom: true,
        } satisfies MessageTemplate;
      })
      .filter((row) => row.body.trim() || row.subject.trim());
  } catch {
    return [];
  }
}

function writeCustomTemplates(rows: MessageTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(rows));
}

export function listMessageTemplates(): MessageTemplate[] {
  const custom = readCustomTemplates();
  const byName = new Map<string, MessageTemplate>();
  for (const tpl of MESSAGE_TEMPLATES) {
    byName.set(tpl.name.toLowerCase(), tpl);
  }
  for (const tpl of custom) {
    byName.set(tpl.name.toLowerCase(), tpl);
  }
  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function searchMessageTemplates(
  query: string,
  modelHint?: MessageTemplateModel | MessageTemplateModel[],
): MessageTemplate[] {
  const q = query.trim().toLowerCase();
  const hints = modelHint
    ? Array.isArray(modelHint)
      ? modelHint
      : [modelHint]
    : null;

  const ranked = listMessageTemplates().map((tpl) => {
    let score = 0;
    if (hints?.includes(tpl.model)) score += 2;
    if (!q) return { tpl, score: score || 1 };
    const hay = `${tpl.name} ${tpl.subject} ${tpl.body}`.toLowerCase();
    if (tpl.name.toLowerCase().includes(q)) score += 5;
    else if (tpl.subject.toLowerCase().includes(q)) score += 3;
    else if (hay.includes(q)) score += 1;
    else return { tpl, score: -1 };
    return { tpl, score };
  })
    .filter((row) => row.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.tpl.name.localeCompare(b.tpl.name, undefined, { sensitivity: "base" }),
    );

  return ranked.map((row) => row.tpl);
}

export function saveCustomMessageTemplate(input: {
  name: string;
  subject?: string;
  body: string;
  model?: MessageTemplateModel;
}): MessageTemplate {
  const name = input.name.trim();
  if (!name) throw new Error("Template name is required");
  const body = input.body.trim();
  const subject = (input.subject ?? "").trim();
  if (!body && !subject) throw new Error("Add a subject or body before saving");

  const custom = readCustomTemplates();
  const existing = custom.find(
    (row) => row.name.toLowerCase() === name.toLowerCase(),
  );
  const next: MessageTemplate = {
    id: existing?.id ?? Date.now(),
    name,
    model: input.model ?? existing?.model ?? "res.partner",
    subject,
    body,
    custom: true,
  };
  const rows = existing
    ? custom.map((row) => (row.id === existing.id ? next : row))
    : [next, ...custom];
  writeCustomTemplates(rows);
  return next;
}

export function listCustomMessageTemplates(): MessageTemplate[] {
  return readCustomTemplates().sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function deleteCustomMessageTemplate(id: number): boolean {
  const custom = readCustomTemplates();
  const next = custom.filter((row) => row.id !== id);
  if (next.length === custom.length) return false;
  writeCustomTemplates(next);
  return true;
}

/** Soft-swap the greeting name so templates match the open conversation. */
export function personalizeTemplateBody(
  body: string,
  recipientName?: string | null,
) {
  const first = recipientName?.trim().split(/\s+/)[0];
  if (!first) return body;
  return body.replace(
    /^(Bonjour|Cher\/Chère|Cher|Chère|Holà|Madame,\s*Monsieur|Madame|Monsieur)\s+([^,\n]+)/i,
    (_m, greet: string) => `${greet} ${first}`,
  );
}
