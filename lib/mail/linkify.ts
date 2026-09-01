export type LinkifiedPart =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string };

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const URL_RE = /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/gi;

function normalizeHref(url: string) {
  return url.startsWith("www.") ? `https://${url}` : url;
}

function splitBareUrls(text: string): LinkifiedPart[] {
  const parts: LinkifiedPart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    const url = match[0];
    parts.push({ type: "link", href: normalizeHref(url), label: url });
    last = match.index + url.length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts.length ? parts : [{ type: "text", value: text }];
}

/** Split message text into plain text and link segments (markdown + bare URLs). */
export function linkifyParts(text: string): LinkifiedPart[] {
  const parts: LinkifiedPart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MARKDOWN_LINK_RE.source, MARKDOWN_LINK_RE.flags);
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(...splitBareUrls(text.slice(last, match.index)));
    }
    parts.push({
      type: "link",
      href: match[2],
      label: match[1],
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(...splitBareUrls(text.slice(last)));
  }
  return parts.length ? parts : [{ type: "text", value: text }];
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function linkifyHtml(escaped: string) {
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  return escaped.replace(re, (url) => {
    const href = normalizeHref(url);
    return `<a href="${href}" style="color:#31595d;text-decoration:underline">${url}</a>`;
  });
}

export function messageParagraphsToHtml(message: string) {
  const withMarkdown = message.replace(
    MARKDOWN_LINK_RE,
    (_full, label: string, href: string) =>
      `<a href="${href}" style="color:#31595d;text-decoration:underline">${escapeHtml(label)}</a>`,
  );

  return withMarkdown
    .split(/\n+/)
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return "";
      if (trimmed.includes("<a ")) return `<p>${trimmed}</p>`;
      return `<p>${linkifyHtml(escapeHtml(trimmed))}</p>`;
    })
    .filter(Boolean)
    .join("");
}
