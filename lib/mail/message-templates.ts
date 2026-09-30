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
};

/** Inkamoto mail.template records synced from Odoo (business templates only). */
export const MESSAGE_TEMPLATES = seed.templates as MessageTemplate[];

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

  const ranked = MESSAGE_TEMPLATES.map((tpl) => {
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
    .sort((a, b) => b.score - a.score || a.tpl.name.localeCompare(b.tpl.name, "fr"));

  return ranked.map((row) => row.tpl);
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
