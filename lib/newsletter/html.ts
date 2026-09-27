export function wrapCampaignHtml(html: string, fallbackText = "") {
  const inner = html.trim() || `<p>${escapeHtml(fallbackText)}</p>`;
  if (/\{\{\s*unsubscribe\s*\}\}/i.test(inner)) return inner;
  return `${inner}
<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e6e1d8;font-size:12px;color:#8a8478;font-family:Georgia,serif">
  <a href="{{ unsubscribe }}" style="color:#31595d">Unsubscribe</a>
</p>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serializeParsedHtml(doc: Document, hadHtmlRoot: boolean) {
  if (hadHtmlRoot) {
    const doctype = doc.doctype
      ? `<!DOCTYPE ${doc.doctype.name}>\n`
      : "<!DOCTYPE html>\n";
    return `${doctype}${doc.documentElement.outerHTML}`;
  }
  return doc.getElementById("__root")?.innerHTML || doc.body.innerHTML;
}

/** Prefer the branded letter body (cream padding), else the card content, else root. */
export function findMainContentEl(doc: Document): HTMLElement {
  const byStyle = [...doc.querySelectorAll("div")].find((el) => {
    const style = (el.getAttribute("style") || "").replace(/\s+/g, "");
    return (
      /padding:24px/i.test(style) &&
      /line-height/i.test(style) &&
      /font-size:16px/i.test(style)
    );
  });
  if (byStyle) return byStyle as HTMLElement;

  const card = [...doc.querySelectorAll("div")].find((el) => {
    const style = el.getAttribute("style") || "";
    return (
      /max-width:\s*560px/i.test(style) ||
      (/background:\s*#f7f4ee/i.test(style) &&
        /font-family:\s*Georgia/i.test(style))
    );
  });
  if (card) {
    const withCopy = [...card.children].find(
      (child) =>
        child instanceof HTMLElement &&
        (child.querySelector("p") || /padding:\s*24px/i.test(child.getAttribute("style") || "")),
    );
    if (withCopy instanceof HTMLElement) return withCopy;
    const last = card.lastElementChild;
    if (last instanceof HTMLElement) return last;
  }

  return (
    (doc.getElementById("__root") as HTMLElement | null) ||
    doc.body ||
    (doc.documentElement as HTMLElement)
  );
}

/**
 * Insert a block inside the main letter body (not after the outer email chrome).
 * If `atNode` is inside the document, inserts after that node (or into it for text).
 */
export function insertIntoMainContent(
  html: string,
  snippet: string,
  options?: { beforeEnd?: boolean },
): string {
  if (!snippet.trim()) return html;
  if (typeof DOMParser === "undefined") {
    return `${html || ""}\n${snippet}`;
  }
  const source = html || "";
  const hadHtmlRoot = /<html[\s>]/i.test(source);
  const wrapped = hadHtmlRoot
    ? source
    : `<!DOCTYPE html><html><body id="__root">${source}</body></html>`;
  const doc = new DOMParser().parseFromString(wrapped, "text/html");
  const main = findMainContentEl(doc);
  if (/data-crm-free-img/i.test(snippet)) {
    const style = main.getAttribute("style") || "";
    if (!/position\s*:/i.test(style)) {
      main.style.position = "relative";
    }
    main.style.overflow = "visible";
  }
  const holder = doc.createElement("div");
  holder.innerHTML = snippet;
  const nodes = [...holder.childNodes];
  if (options?.beforeEnd === false) {
    for (const node of nodes) main.insertBefore(node, main.firstChild);
  } else {
    for (const node of nodes) main.appendChild(node);
  }
  return serializeParsedHtml(doc, hadHtmlRoot);
}

/**
 * Drop the old letterbox shell (black/sand frame + narrow 560px card) so the
 * cream email fills the full preview / send width.
 */
export function expandEmailToFullWidth(html: string): string {
  if (!html.trim() || typeof DOMParser === "undefined") {
    return html.replace(/background:\s*#1c1b19\b/gi, "background:#f7f4ee");
  }
  const hadHtmlRoot = /<html[\s>]/i.test(html);
  const wrapped = hadHtmlRoot
    ? html
    : `<!DOCTYPE html><html><body id="__root">${html}</body></html>`;
  const doc = new DOMParser().parseFromString(wrapped, "text/html");
  const root =
    (doc.getElementById("__root") as HTMLElement | null) || doc.body;
  if (!root) return html;

  const shell = [...root.children].find((el) => {
    if (!(el instanceof HTMLElement)) return false;
    const style = el.getAttribute("style") || "";
    const hasCard = el.querySelector(
      'div[style*="max-width:560px"], div[style*="background:#f7f4ee"], div[style*="background: #f7f4ee"]',
    );
    return (
      /background:\s*#1c1b19/i.test(style) ||
      /background:\s*#eae6de/i.test(style) ||
      (!!hasCard && /padding:\s*\d/i.test(style))
    );
  }) as HTMLElement | undefined;

  if (shell) {
    const card =
      ([...shell.children].find((child) => {
        if (!(child instanceof HTMLElement)) return false;
        const style = child.getAttribute("style") || "";
        return (
          /max-width:\s*560px/i.test(style) ||
          /background:\s*#f7f4ee/i.test(style)
        );
      }) as HTMLElement | undefined) || shell;

    // Promote card to root and remove the letterbox shell.
    if (card !== shell) {
      root.insertBefore(card, shell);
      shell.remove();
    } else {
      // Shell itself is the card — just stretch it.
    }
  }

  // Stretch any remaining narrow outer cards to full width.
  const stretchTargets = new Set<HTMLElement>();
  root.querySelectorAll("div").forEach((el) => {
    const style = el.getAttribute("style") || "";
    if (/max-width:\s*560px/i.test(style)) stretchTargets.add(el as HTMLElement);
  });
  // Also stretch a top-level cream letter if present.
  [...root.children].forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const style = el.getAttribute("style") || "";
    if (/background:\s*#f7f4ee/i.test(style)) stretchTargets.add(el);
  });

  for (const el of stretchTargets) {
    let next = (el.getAttribute("style") || "")
      .replace(/max-width:\s*560px/gi, "max-width:100%")
      .replace(/margin:\s*0\s+auto/gi, "margin:0");
    if (!/width\s*:/i.test(next)) {
      next = `width:100%;${next}`;
    } else {
      next = next.replace(/width:\s*[^;]+/i, "width:100%");
    }
    next = next
      .replace(/background:\s*#1c1b19\b/gi, "background:#f7f4ee")
      .replace(/background:\s*#eae6de\b/gi, "background:#f7f4ee");
    el.setAttribute("style", next);
  }

  if (doc.body) {
    doc.body.style.margin = "0";
    doc.body.style.padding = "0";
    doc.body.style.background = "#f7f4ee";
    doc.body.style.minHeight = "100%";
  }
  const htmlEl = doc.documentElement;
  if (htmlEl) {
    htmlEl.style.margin = "0";
    htmlEl.style.padding = "0";
    htmlEl.style.background = "#f7f4ee";
    htmlEl.style.minHeight = "100%";
    htmlEl.style.height = "100%";
  }

  // Guarantee a cream root letter fills the viewport width.
  const top = [...root.children].find(
    (el) => el instanceof HTMLElement,
  ) as HTMLElement | undefined;
  if (top) {
    let style = top.getAttribute("style") || "";
    if (!/background\s*:/i.test(style)) {
      style = `background:#f7f4ee;${style}`;
    } else if (!/background:\s*#f7f4ee/i.test(style)) {
      // Keep intentional colored headers; only paint plain wrappers cream.
      if (/background:\s*(#fff|#ffffff|white)\b/i.test(style)) {
        style = style.replace(
          /background:\s*(#fff|#ffffff|white)\b/gi,
          "background:#f7f4ee",
        );
      }
    }
    if (!/min-height\s*:/i.test(style)) {
      style = `min-height:100%;${style}`;
    }
    top.setAttribute("style", style);
  }

  return serializeParsedHtml(doc, hadHtmlRoot);
}

/** @deprecated Use expandEmailToFullWidth — kept as alias for older call sites. */
export function normalizeEmailShellBackground(html: string): string {
  return expandEmailToFullWidth(html);
}

/** Move blocks that were accidentally appended outside the branded card into the main body. */
export function pullOrphansIntoMainContent(html: string): string {
  const source = expandEmailToFullWidth(html);
  if (!source.trim() || typeof DOMParser === "undefined") return source;
  const hadHtmlRoot = /<html[\s>]/i.test(source);
  const wrapped = hadHtmlRoot
    ? source
    : `<!DOCTYPE html><html><body id="__root">${source}</body></html>`;
  const doc = new DOMParser().parseFromString(wrapped, "text/html");
  const root =
    (doc.getElementById("__root") as HTMLElement | null) || doc.body;
  if (!root) return source;

  const outerShell = [...root.children].find((el) => {
    if (!(el instanceof HTMLElement)) return false;
    const style = el.getAttribute("style") || "";
    return (
      /background:\s*#eae6de/i.test(style) ||
      /background:\s*#1c1b19/i.test(style) ||
      el.querySelector('div[style*="max-width:560px"]') != null ||
      el.querySelector('div[style*="background:#f7f4ee"]') != null
    );
  }) as HTMLElement | undefined;

  // After expandEmailToFullWidth, the letter is usually the only root child.
  if (!outerShell || root.children.length <= 1) return source;

  const main = findMainContentEl(doc);
  const orphans = [...root.childNodes].filter((node) => {
    if (node === outerShell) return false;
    if (node.nodeType === 3 && !node.textContent?.trim()) return false;
    return true;
  });
  if (orphans.length === 0) return source;

  for (const node of orphans) {
    main.appendChild(node);
  }
  return serializeParsedHtml(doc, hadHtmlRoot);
}

/** Brevo wants UTC `YYYY-MM-DD HH:mm:ss`. */
export function formatBrevoUtc(d: Date) {
  if (!Number.isFinite(d.getTime())) throw new Error("Invalid schedule time.");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

/** `localValue` is datetime-local. */
export function toBrevoScheduledAt(localValue: string) {
  const d = new Date(localValue);
  if (d.getTime() < Date.now() + 60_000) {
    throw new Error("Schedule at least one minute in the future.");
  }
  return formatBrevoUtc(d);
}
