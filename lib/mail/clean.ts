/**
 * Turns raw email text into something readable in a chat bubble: the person's
 * own words, without provider footers, tracking links or quoted history.
 * The raw body stays in the database, so this is always reversible.
 */

export type FormField = { label: string; value: string };

export type CleanBody = {
  /** The human message, ready to render. */
  text: string;
  /** Submitted form fields, when the mail is a form notification. */
  fields: FormField[];
  /** Earlier thread history, hidden behind a toggle. */
  quoted: string | null;
  isForm: boolean;
  /** True when anything was removed, so the UI can offer the original. */
  trimmed: boolean;
};

const ENTITIES: [RegExp, string][] = [
  [/&nbsp;/gi, " "],
  [/&zwnj;/gi, ""],
  [/&zwj;/gi, ""],
  [/&amp;/gi, "&"],
  [/&lt;/gi, "<"],
  [/&gt;/gi, ">"],
  [/&quot;/gi, '"'],
  [/&#39;|&apos;/gi, "'"],
  [/&mdash;/gi, "—"],
  [/&ndash;/gi, "–"],
  [/&hellip;/gi, "…"],
];

/** Everything from here down is provider boilerplate. */
const FOOTER_MARKERS = [
  /if you believe this is a spam submission/i,
  /^\s*unsubscribe\b/im,
  /to stop receiving/i,
  /you are receiving this (?:email|message)/i,
  /this email was sent to/i,
  /manage (?:your )?(?:email )?preferences/i,
  /view this email in your browser/i,
  /©\s*\d{4}/,
  /all rights reserved/i,
  /sent from my i(?:phone|pad)/i,
];

/**
 * Start of quoted thread history. Attribution lines routinely wrap, so these
 * span newlines and anchor on the trailing "wrote:".
 */
const QUOTE_MARKERS = [
  /^[ \t]*On\b[\s\S]{4,200}?\bwrote:[ \t]*$/im,
  /^[ \t]*Le\b[\s\S]{4,200}?\ba écrit\s*:[ \t]*$/im,
  /^[ \t]*El\b[\s\S]{4,200}?\bescribió\s*:[ \t]*$/im,
  /^-{2,}\s*Original Message\s*-{2,}/im,
  /^\s*-{2,}\s*Forwarded message\s*-{2,}/im,
  /^\s*From:\s.+\nSent:\s/im,
  /^\s*_{10,}\s*$/m,
];

const FORM_PREAMBLE =
  /you just received a new form submission(?: on your website[^.\n]*)?\.?/i;

/** Labels that describe the sender rather than carrying their message. */
const CONTACT_LABELS = new Set([
  "name",
  "nom",
  "prenom",
  "prénom",
  "firstname",
  "first name",
  "lastname",
  "last name",
  "surname",
  "email",
  "e-mail",
  "mail",
  "courriel",
  "phone",
  "telephone",
  "téléphone",
  "tel",
  "mobile",
  "company",
  "societe",
  "société",
  "subject",
  "sujet",
  "page",
  "site",
  "date",
]);

/** Generic labels Webflow emits for an unnamed field. */
const MESSAGE_LABELS = new Set([
  "field",
  "message",
  "msg",
  "comment",
  "comments",
  "commentaire",
  "enquiry",
  "inquiry",
  "question",
  "details",
  "body",
  "notes",
]);

function decode(input: string) {
  let out = input.replace(/\r\n?/g, "\n");
  for (const [re, to] of ENTITIES) out = out.replace(re, to);
  // Zero-width and non-breaking padding used by bulk senders
  return out.replace(/[\u200b-\u200d\u2060\ufeff\u00a0]/g, " ");
}

function stripLinks(input: string) {
  return (
    input
      // Bracketed link blocks: [https://...]
      .replace(/\[\s*https?:\/\/[^\]]*\]/gi, "")
      // A link alone inside parentheses, often across lines
      .replace(/\(\s*https?:\/\/[^)]*\)/gi, "")
      // A link alone on its line
      .replace(/^[ \t]*<?https?:\/\/\S+>?[ \t]*$/gim, "")
      // mailto: wrappers
      .replace(/<mailto:[^>]*>/gi, "")
  );
}

function tidy(input: string) {
  return (
    input
      // Runs of separator characters used as visual dividers
      .replace(/^[ \t]*[-=_*~•]{3,}[ \t]*$/gm, "")
      .replace(/[*]{3,}/g, "")
      .replace(/[-]{5,}/g, "")
      // Image alt-text noise from marketing templates
      .replace(/^[ \t]*(?:Description de l['’]image|Image description)\s*:.*$/gim, "")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function splitQuoted(input: string): { body: string; quoted: string | null } {
  let cutAt = -1;
  for (const re of QUOTE_MARKERS) {
    const m = input.match(re);
    if (m?.index !== undefined && (cutAt === -1 || m.index < cutAt)) {
      cutAt = m.index;
    }
  }

  // A block of ">" lines also starts the history
  const lines = input.split("\n");
  const firstQuote = lines.findIndex((l) => /^\s*>/.test(l));
  if (firstQuote !== -1) {
    const offset = lines.slice(0, firstQuote).join("\n").length;
    if (cutAt === -1 || offset < cutAt) cutAt = offset;
  }

  if (cutAt <= 0) return { body: input, quoted: null };
  const quoted = input
    .slice(cutAt)
    .split("\n")
    .map((l) => l.replace(/^\s*>+\s?/, ""))
    .join("\n")
    .trim();
  return { body: input.slice(0, cutAt), quoted: quoted || null };
}

function cutFooter(input: string): { body: string; cut: boolean } {
  let cutAt = -1;
  for (const re of FOOTER_MARKERS) {
    const m = input.match(re);
    if (m?.index !== undefined && (cutAt === -1 || m.index < cutAt)) {
      cutAt = m.index;
    }
  }
  if (cutAt <= 0) return { body: input, cut: false };
  return { body: input.slice(0, cutAt), cut: true };
}

const FIELD_RE =
  /(?:^|\n)[ \t]*([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9 _'’\-/]{0,28}?)[ \t]*:[ \t]*/g;

function parseFields(input: string): FormField[] {
  const marks: { label: string; start: number; end: number }[] = [];
  FIELD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FIELD_RE.exec(input))) {
    marks.push({ label: m[1].trim(), start: m.index, end: FIELD_RE.lastIndex });
  }

  return marks
    .map((mark, i) => {
      const stop = i + 1 < marks.length ? marks[i + 1].start : input.length;
      return { label: mark.label, value: input.slice(mark.end, stop).trim() };
    })
    .filter((f) => f.label && f.value);
}

function looksLikeForm(raw: string, subject?: string) {
  if (FORM_PREAMBLE.test(raw)) return true;
  if (subject && /new form submission|nouvelle soumission/i.test(subject)) {
    return true;
  }
  return false;
}

export function cleanBody(
  raw: string | null | undefined,
  subject?: string,
): CleanBody {
  const original = raw ?? "";
  if (!original.trim()) {
    return { text: "", fields: [], quoted: null, isForm: false, trimmed: false };
  }

  const decoded = decode(original);
  const { body: unquoted, quoted } = splitQuoted(decoded);
  const { body: noFooter, cut } = cutFooter(unquoted);
  const isForm = looksLikeForm(decoded, subject);

  let working = tidy(stripLinks(noFooter));
  let fields: FormField[] = [];

  if (isForm) {
    working = working.replace(FORM_PREAMBLE, "").trim();
    fields = parseFields(working);

    // The message is the longest field that isn't just contact details
    const messageField =
      fields
        .filter(
          (f) =>
            MESSAGE_LABELS.has(f.label.toLowerCase()) ||
            !CONTACT_LABELS.has(f.label.toLowerCase()),
        )
        .sort((a, b) => b.value.length - a.value.length)[0] ?? null;

    if (messageField) {
      fields = fields.filter((f) => f !== messageField);
      working = messageField.value;
    } else {
      working = "";
    }
  }

  const text = working.trim();
  const trimmed =
    cut ||
    !!quoted ||
    isForm ||
    text.length + fields.reduce((n, f) => n + f.value.length, 0) <
      decoded.trim().length - 8;

  return { text, fields, quoted, isForm, trimmed };
}

/** One-line summary for the conversation list. */
export function previewOf(clean: CleanBody, fallback = ""): string {
  const base =
    clean.text ||
    clean.fields.map((f) => `${f.label}: ${f.value}`).join(" · ") ||
    fallback;
  return base.replace(/\s+/g, " ").trim().slice(0, 120);
}

const NAME_LABELS = [
  "name",
  "full name",
  "nom",
  "prenom",
  "prénom",
  "firstname",
  "first name",
  "lastname",
  "last name",
  "surname",
];

const EMAIL_LABELS = ["email", "e-mail", "mail", "courriel"];

/**
 * The person behind a form submission, read from its own fields. More reliable
 * than scanning the body, since the labels tell us what each value is.
 */
export function contactFromFields(fields: FormField[]): {
  name: string | null;
  email: string | null;
} {
  const parts: string[] = [];
  let email: string | null = null;

  for (const f of fields) {
    const label = f.label.toLowerCase();
    if (!email && EMAIL_LABELS.includes(label) && f.value.includes("@")) {
      email = f.value.trim().toLowerCase();
      continue;
    }
    if (NAME_LABELS.includes(label) && !f.value.includes("@")) {
      parts.push(f.value.trim());
    }
  }

  const name = parts.join(" ").replace(/\s+/g, " ").trim();
  return { name: name || null, email };
}

const BULK_HINTS = [
  "newsletter",
  "news",
  "inspiration",
  "marketing",
  "promo",
  "offers",
  "deals",
  "updates",
  "notifications",
  "notification",
  "noreply",
  "no-reply",
  "mailer",
  "email",
  "info",
  "hello",
  "team",
];

/**
 * Bulk mail (promos, digests) shouldn't sit next to real customers in a chat
 * list. Form notifications are never bulk — a person is behind them.
 */
export function isBulkMail(input: {
  fromEmail: string;
  isForm: boolean;
  raw?: string | null;
}): boolean {
  if (input.isForm) return false;

  const [local = "", domain = ""] = input.fromEmail.toLowerCase().split("@");
  if (BULK_HINTS.some((hint) => local === hint || local.startsWith(`${hint}-`) || local.startsWith(`${hint}.`))) {
    return true;
  }
  if (/(?:^|\.)(?:mail|mp\d+|email|sendgrid|mailgun|mailchimp|mjt)\./.test(domain)) {
    return true;
  }

  const raw = input.raw ?? "";
  return (
    /^\s*unsubscribe\b/im.test(raw) ||
    /to stop receiving|manage (?:your )?(?:email )?preferences|view this email in your browser/i.test(
      raw,
    )
  );
}
