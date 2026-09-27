"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  btnToolbar,
  btnToolbarPrimary,
  Field,
  inputClass,
  inputUnderlineClass,
  Modal,
} from "@/components/modal";
import { OdooFormToolbar } from "@/components/sales/odoo-form-toolbar";
import { EmailMarketingSubnav } from "@/components/email-marketing/email-marketing-subnav";
import {
  FaClock,
  FaCog,
  FaCopy,
  FaDesktop,
  FaFlask,
  FaPaperPlane,
  FaPencil,
  FaPlus,
  FaSave,
  FaStar,
  FaTrash,
  SNIPPET_THUMB,
} from "@/components/email-marketing/mailing-icons";
import { EmptyHint, FormNotice } from "@/components/ui";
import {
  FloatingSelectionToolbar,
  RichTextToolbar,
  resetHtmlHistory,
} from "@/components/rich-text-toolbar";
import { useCrm } from "@/lib/crm-store";
import { formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { MailingStatus, NewsletterMailing } from "@/lib/newsletter/mailings";
import {
  copyTemplateDisplayName,
  templateIdForMailing,
} from "@/lib/newsletter/templates";
import {
  insertIntoMainContent,
  pullOrphansIntoMainContent,
  findMainContentEl,
} from "@/lib/newsletter/html";

type Template = {
  id: string;
  name: string;
  subject: string;
  preview: string;
  html: string;
  builtin: boolean;
};

type Subscriber = {
  email: string;
  tags?: string[];
};

type FormTab = "body" | "settings";
type BodyMode = "design" | "edit";
type SideTab = "blocks" | "style" | "design";

const PIPELINE: MailingStatus[] = ["draft", "in_queue", "sending", "sent"];

const BLOCK_SNIPPETS: Record<string, string> = {
  headers: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;background:#1a1a1a"><tr><td align="center" style="padding:28px 20px"><img src="https://inkamototours.com/logo.png" alt="Inkamoto" style="max-height:48px" /></td></tr></table>`,
  text: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#222;padding:0 16px"><p>Your text here…</p></td></tr></table>`,
  images: `<img data-crm-free-img="1" data-crm-float="right" data-crm-wrap="below" src="https://inkamototours.com/logo.png" alt="" width="280" style="display:block;float:none;clear:both;width:280px;max-width:100%;height:auto;border:0;margin:12px 0 16px auto;cursor:move" />`,
  person: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td style="padding:0 16px;font-family:Arial,sans-serif;color:#222"><table><tr><td style="padding-right:12px"><div style="width:56px;height:56px;border-radius:50%;background:#ddd"></div></td><td><strong>Jorge Inkamoto</strong><br/><span style="color:#666;font-size:13px">Guide moto · Pérou</span></td></tr></table></td></tr></table>`,
  columns: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td width="33%" valign="top" style="padding:8px;font-family:Arial,sans-serif;font-size:14px;color:#222">Column 1</td><td width="33%" valign="top" style="padding:8px;font-family:Arial,sans-serif;font-size:14px;color:#222">Column 2</td><td width="33%" valign="top" style="padding:8px;font-family:Arial,sans-serif;font-size:14px;color:#222">Column 3</td></tr></table>`,
  website: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td align="center" style="padding:16px;font-family:Arial,sans-serif"><a href="https://inkamototours.com" style="color:#31595d;font-weight:700">inkamototours.com</a></td></tr></table>`,
  footer: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:32px;padding-top:16px;border-top:1px solid #e6e1d8"><tr><td style="font-family:Arial,sans-serif;font-size:12px;color:#8a8478;text-align:center;padding:16px"><p>Inkamoto Tours · <a href="https://inkamototours.com" style="color:#31595d">inkamototours.com</a></p><p><a href="{{ unsubscribe }}" style="color:#31595d">Unsubscribe</a></p></td></tr></table>`,
  alert: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td style="border-left:4px solid #714B67;background:#f8f5f7;padding:14px 16px;font-family:Arial,sans-serif;color:#222">Important message</td></tr></table>`,
  separator: `<hr style="border:none;border-top:1px solid #e6e1d8;margin:24px 16px" />`,
  highlight: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td style="background:#31595d;color:#fff;padding:18px 16px;font-family:Georgia,serif;font-size:18px;text-align:center">Highlighted text</td></tr></table>`,
  rating: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td align="center" style="font-size:22px;letter-spacing:2px;color:#714B67">★★★★★</td></tr></table>`,
  button: `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px auto"><tr><td style="background:#714B67;border-radius:4px"><a href="https://inkamototours.com" style="display:inline-block;padding:12px 22px;color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none">Learn more</a></td></tr></table>`,
  image: `<img data-crm-free-img="1" data-crm-float="right" data-crm-wrap="below" src="https://inkamototours.com/logo.png" alt="" width="280" style="display:block;float:none;clear:both;width:280px;max-width:100%;height:auto;border:0;margin:12px 0 16px auto;cursor:move" />`,
  icon: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td align="center" style="font-size:32px">🏍️</td></tr></table>`,
  video: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td align="center" style="padding:24px;background:#111;color:#fff;font-family:Arial,sans-serif"><a href="https://inkamototours.com" style="color:#fff;text-decoration:none">▶ Watch video</a></td></tr></table>`,
  badge: `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:16px auto"><tr><td style="background:#e8f0f0;color:#31595d;border-radius:999px;padding:6px 14px;font-family:Arial,sans-serif;font-size:12px;font-weight:700">New</td></tr></table>`,
  ctaBadge: `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:16px auto"><tr><td style="background:#714B67;color:#fff;border-radius:999px;padding:8px 16px;font-family:Arial,sans-serif;font-size:13px;font-weight:700">Book now</td></tr></table>`,
};

function stageIndex(status: MailingStatus) {
  const i = PIPELINE.indexOf(status);
  return i < 0 ? 0 : i;
}

function formatRatio(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 %";
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/\.?0+$/, "")} %`;
}

function collectImageSrcs(html: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/\bsrc=["']([^"']+)["']/gi)) {
    const src = m[1]!.trim();
    if (!src || src.startsWith("data:") || seen.has(src)) continue;
    if (!/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(src) && !/\/image|mailing-assets|storage/i.test(src)) {
      // still allow http images without extension
      if (!/^https?:\/\//i.test(src)) continue;
    }
    seen.add(src);
    found.push(src);
  }
  return found;
}

function replaceImageSrc(html: string, from: string, to: string) {
  if (!from || !to || from === to) return html;
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html
    .replace(new RegExp(`src=(["'])${escaped}\\1`, "gi"), `src="${to}"`)
    .replace(
      new RegExp(`data-original-src=(["'])${escaped}\\1`, "gi"),
      `data-original-src="${to}"`,
    );
}

type ImageAlign = "left" | "center" | "right";
type ImageWidth = number | "full";

const IMAGE_WIDTH_PRESETS: { value: ImageWidth; labelKey: string }[] = [
  { value: 160, labelKey: "pages.emailMarketing.imageSizeSmall" },
  { value: 280, labelKey: "pages.emailMarketing.imageSizeMedium" },
  { value: 400, labelKey: "pages.emailMarketing.imageSizeLarge" },
  { value: "full", labelKey: "pages.emailMarketing.imageSizeFull" },
];

function imageCss(width: ImageWidth, marginLeft = 0, marginTop = 0) {
  const size =
    width === "full"
      ? "width:100%;max-width:100%"
      : `width:${width}px;max-width:100%`;
  return `${size};height:auto;display:block;border:0;margin:${marginTop}px 0 0 ${marginLeft}px`;
}

function imageWidthAttr(width: ImageWidth) {
  return width === "full" ? 'width="100%"' : `width="${width}"`;
}

function buildImageSnippet(url: string, width: ImageWidth, align: ImageAlign) {
  const w = width === "full" ? 480 : width;
  const side: FloatSide =
    width === "full"
      ? "block"
      : align === "left"
        ? "left"
        : align === "center"
          ? "block"
          : "right";
  // Text always moves down under the image (not beside it).
  const wrap: WrapMode = "below";
  return `<img data-crm-free-img="1" data-crm-float="${side}" data-crm-wrap="${wrap}" src="${url}" alt="" width="${w}" style="${flowImageStyle(w, side, wrap)}" />`;
}

function parsePx(value: string | null | undefined) {
  if (!value) return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type FloatSide = "left" | "right" | "block";
type WrapMode = "square" | "below";

function clearImageEditorChrome(doc: Document) {
  doc.querySelectorAll("[data-crm-img-chrome]").forEach((el) => el.remove());
  doc.querySelectorAll("img[data-crm-img-selected]").forEach((img) => {
    img.removeAttribute("data-crm-img-selected");
    const el = img as HTMLImageElement;
    el.style.outline = "";
    el.style.outlineOffset = "";
    el.style.opacity = "";
    el.style.filter = "";
    el.style.cursor = "";
  });
}

/**
 * below (default) = image on its own row; following text stays full width underneath.
 * square = optional float wrap (text beside, then under).
 */
function flowImageStyle(width: number, side: FloatSide, wrap: WrapMode = "below") {
  if (wrap === "below" || side === "block") {
    const align =
      side === "right"
        ? "margin:12px 0 16px auto"
        : side === "left"
          ? "margin:12px auto 16px 0"
          : "margin:12px auto";
    return [
      "display:block",
      "float:none",
      "clear:both",
      `width:${width}px`,
      "max-width:100%",
      "height:auto",
      "border:0",
      align,
      "cursor:move",
    ].join(";");
  }
  if (side === "right") {
    return [
      "float:right",
      "clear:none",
      `width:${width}px`,
      "max-width:46%",
      "height:auto",
      "border:0",
      "margin:2px 0 12px 18px",
      "display:block",
      "cursor:move",
    ].join(";");
  }
  return [
    "float:left",
    "clear:none",
    `width:${width}px`,
    "max-width:46%",
    "height:auto",
    "border:0",
    "margin:2px 18px 12px 0",
    "display:block",
    "cursor:move",
  ].join(";");
}

function prepareMainForFlowImages(main: HTMLElement) {
  main.style.position = "relative";
  main.style.overflow = "visible";
  if (main.style.minHeight) main.style.minHeight = "";
  // Let floated images wrap following paragraphs instead of trapping them.
  for (const child of [...main.children]) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.tagName === "IMG") continue;
    if (child.hasAttribute("data-crm-img-chrome")) continue;
    child.style.overflow = "visible";
  }
}

function resolveFloatSide(
  main: HTMLElement,
  width: number,
  clientX: number,
): FloatSide {
  // Near-full width → own row. Otherwise left/right only so text can wrap under.
  if (width >= main.clientWidth * 0.9) return "block";
  const rect = main.getBoundingClientRect();
  const ratio = (clientX - rect.left) / Math.max(rect.width, 1);
  return ratio >= 0.5 ? "right" : "left";
}

function readWrapMode(img: HTMLImageElement): WrapMode {
  // Default: text moves down under the image (not beside).
  return img.getAttribute("data-crm-wrap") === "square" ? "square" : "below";
}

function findFlowInsertBefore(
  main: HTMLElement,
  clientY: number,
  exclude: Element | null,
): Node | null {
  const kids = [...main.children].filter((el) => {
    if (el === exclude) return false;
    if ((el as HTMLElement).hasAttribute?.("data-crm-img-chrome")) return false;
    if (el instanceof HTMLElement && el.style.display === "none") return false;
    return true;
  }) as HTMLElement[];
  for (const kid of kids) {
    const r = kid.getBoundingClientRect();
    // Midpoint of each block — drag above → insert before, below → after.
    const cut = r.top + r.height * 0.5;
    if (clientY < cut) return kid;
  }
  return null;
}

/** Prefer inserting after the first text block (typical newsletter layout). */
function defaultImageInsertBefore(main: HTMLElement): Node | null {
  const blocks = [...main.children].filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hasAttribute("data-crm-img-chrome")) return false;
    if (el.tagName === "IMG") return false;
    return true;
  });
  if (blocks.length >= 1) return blocks[0]!.nextSibling;
  return null;
}

function unwrapImageIntoMain(img: HTMLImageElement, main: HTMLElement) {
  if (img.parentElement === main) return;
  let hoist: Node = img;
  while (hoist.parentNode && hoist.parentNode !== main) {
    hoist = hoist.parentNode;
  }
  if (hoist.parentNode === main) {
    main.insertBefore(img, hoist);
    if (
      hoist instanceof HTMLElement &&
      hoist.tagName === "TABLE" &&
      !hoist.querySelector("img")
    ) {
      hoist.remove();
    } else if (
      hoist instanceof HTMLElement &&
      !hoist.querySelector("img") &&
      !(hoist.textContent || "").trim()
    ) {
      hoist.remove();
    }
  } else {
    main.appendChild(img);
  }
}

/** Commit image into document flow so text wraps / continues under it. */
function placeImageInFlow(
  img: HTMLImageElement,
  main: HTMLElement,
  opts?: {
    clientX?: number;
    clientY?: number;
    width?: number;
    side?: FloatSide;
    wrap?: WrapMode;
    useDefaultSlot?: boolean;
  },
) {
  prepareMainForFlowImages(main);
  unwrapImageIntoMain(img, main);

  let width = Math.round(
    opts?.width ??
      (parsePx(img.style.width) ||
        parsePx(img.getAttribute("width")) ||
        img.getBoundingClientRect().width ||
        320),
  );
  width = clamp(width, 40, Math.max(40, main.clientWidth));

  const wrap = opts?.wrap ?? readWrapMode(img);
  const side =
    opts?.side ??
    (opts?.clientX != null
      ? resolveFloatSide(main, width, opts.clientX)
      : ((img.getAttribute("data-crm-float") as FloatSide | null) || "right"));

  if (opts?.clientY != null) {
    const before = findFlowInsertBefore(main, opts.clientY, img);
    if (before && before.parentNode === main) {
      main.insertBefore(img, before);
    } else {
      main.appendChild(img);
    }
  } else if (opts?.useDefaultSlot) {
    const before = defaultImageInsertBefore(main);
    if (before && before.parentNode === main) {
      main.insertBefore(img, before);
    } else if (before === null && main.firstChild) {
      // after first block if nextSibling was null → append after first
      const first = [...main.children].find(
        (el) =>
          el instanceof HTMLElement &&
          el.tagName !== "IMG" &&
          !el.hasAttribute("data-crm-img-chrome"),
      );
      if (first) first.after(img);
      else main.appendChild(img);
    } else {
      main.appendChild(img);
    }
  }

  img.setAttribute("data-crm-free-img", "1");
  img.setAttribute("data-crm-float", side === "block" ? "block" : side);
  img.setAttribute("data-crm-wrap", wrap);
  img.removeAttribute("data-crm-left");
  img.removeAttribute("data-crm-top");
  img.setAttribute("width", String(width));
  img.removeAttribute("height");
  img.draggable = false;
  img.style.cssText = flowImageStyle(
    width,
    side === "block" ? "block" : side,
    wrap,
  );
}

function commitLiveImageLayout(
  img: HTMLImageElement,
  main: HTMLElement,
  opts?: { clientX?: number; clientY?: number },
) {
  placeImageInFlow(img, main, opts);
}

function syncAllFreeImages(doc: Document) {
  const main = findMainContentEl(doc);
  prepareMainForFlowImages(main);
  main.querySelectorAll("img[data-crm-free-img='1']").forEach((node) => {
    placeImageInFlow(node as HTMLImageElement, main);
  });
}

function parseImageLayout(
  html: string,
  src: string,
): { width: ImageWidth; align: ImageAlign } {
  const defaults = { width: 320 as ImageWidth, align: "left" as ImageAlign };
  if (typeof DOMParser === "undefined" || !src) return defaults;
  try {
    const wrapped = /<html[\s>]/i.test(html)
      ? html
      : `<!DOCTYPE html><html><body>${html}</body></html>`;
    const doc = new DOMParser().parseFromString(wrapped, "text/html");
    const img = [...doc.querySelectorAll("img")].find((el) => {
      const current = el.getAttribute("src") || "";
      return current === src || el.src === src;
    });
    if (!img) return defaults;
    const td = img.closest("td");
    const alignRaw = (td?.getAttribute("align") || "").toLowerCase();
    const align: ImageAlign =
      alignRaw === "center" || alignRaw === "right" || alignRaw === "left"
        ? alignRaw
        : "left";
    const style = img.getAttribute("style") || "";
    const styleWidth = style.match(/(?:^|;)\s*width\s*:\s*([^;]+)/i)?.[1]?.trim();
    const attrWidth = img.getAttribute("width")?.trim();
    const raw = styleWidth || attrWidth || "";
    if (/^100%$/.test(raw) || raw.toLowerCase() === "100%") {
      return { width: "full", align };
    }
    const px = Number.parseInt(raw.replace(/px$/i, ""), 10);
    if (Number.isFinite(px) && px > 0) return { width: px, align };
    // Legacy inserts with only max-width:100% and no width → treat as full.
    if (/max-width\s*:\s*100%/i.test(style) && !styleWidth && !attrWidth) {
      return { width: "full", align };
    }
    return { width: 320, align };
  } catch {
    return defaults;
  }
}

function applyImageLayout(
  html: string,
  fromSrc: string,
  toSrc: string,
  width: ImageWidth,
  align: ImageAlign,
) {
  if (typeof DOMParser === "undefined") {
    return replaceImageSrc(html, fromSrc, toSrc);
  }
  const hasHtml = /<html[\s>]/i.test(html);
  const wrapped = hasHtml
    ? html
    : `<!DOCTYPE html><html><body id="__root">${html}</body></html>`;
  const doc = new DOMParser().parseFromString(wrapped, "text/html");
  const imgs = [...doc.querySelectorAll("img")].filter((el) => {
    const current = el.getAttribute("src") || "";
    return current === fromSrc || el.src === fromSrc;
  });
  if (imgs.length === 0) {
    return replaceImageSrc(html, fromSrc, toSrc);
  }
  for (const img of imgs) {
    img.setAttribute("src", toSrc);
    if (img.hasAttribute("data-original-src")) {
      img.setAttribute("data-original-src", toSrc);
    }
    const isFree = img.getAttribute("data-crm-free-img") === "1";
    if (isFree) {
      const side: FloatSide =
        width === "full"
          ? "block"
          : align === "right"
            ? "right"
            : align === "center"
              ? "block"
              : "left";
      const wrap: WrapMode = "below";
      const w = width === "full" ? 480 : width;
      img.setAttribute("width", String(w));
      img.removeAttribute("height");
      img.setAttribute("data-crm-float", side);
      img.setAttribute("data-crm-wrap", wrap);
      img.removeAttribute("data-crm-left");
      img.removeAttribute("data-crm-top");
      img.style.cssText = flowImageStyle(w, side, wrap);
      continue;
    }
    img.setAttribute("style", imageCss(width, 0, 0));
    img.setAttribute("width", width === "full" ? "100%" : String(width));
    img.removeAttribute("height");
    let td = img.closest("td");
    if (!td) {
      const table = doc.createElement("table");
      table.setAttribute("width", "100%");
      table.setAttribute("cellpadding", "0");
      table.setAttribute("cellspacing", "0");
      table.setAttribute("role", "presentation");
      table.setAttribute("style", "margin:16px 0");
      const tr = doc.createElement("tr");
      td = doc.createElement("td");
      td.setAttribute("style", "padding:0 16px");
      const parent = img.parentNode;
      if (parent) {
        parent.insertBefore(table, img);
        tr.appendChild(td);
        table.appendChild(tr);
        td.appendChild(img);
      }
    }
    td.setAttribute("align", align);
  }
  if (hasHtml) {
    const doctype = doc.doctype
      ? `<!DOCTYPE ${doc.doctype.name}>\n`
      : "<!DOCTYPE html>\n";
    return `${doctype}${doc.documentElement.outerHTML}`;
  }
  return doc.getElementById("__root")?.innerHTML || doc.body.innerHTML;
}

export function MailingForm({ mailingId }: { mailingId: string }) {
  const { t, locale } = useLocale();
  const { pushToast } = useCrm();
  const router = useRouter();
  const isNew = mailingId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [mailing, setMailing] = useState<NewsletterMailing | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [senderEmail, setSenderEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<FormTab>("body");
  const [bodyMode, setBodyMode] = useState<BodyMode>("design");
  const [sideTab, setSideTab] = useState<SideTab>("blocks");
  const [editorKey, setEditorKey] = useState(mailingId);
  const [testOpen, setTestOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [testing, setTesting] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceSrc, setReplaceSrc] = useState<string | null>(null);
  const [replaceUrl, setReplaceUrl] = useState("");
  const [imageWidth, setImageWidth] = useState<ImageWidth>(320);
  const [imageAlign, setImageAlign] = useState<ImageAlign>("left");
  const [imageWidthCustom, setImageWidthCustom] = useState("320");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [previewHeight, setPreviewHeight] = useState(640);
  /** Locked iframe HTML — only refresh when editorKey changes so edits don't remount. */
  const [frameSrcDoc, setFrameSrcDoc] = useState("");
  const [bodyDirty, setBodyDirty] = useState(false);
  const [saveChoicesOpen, setSaveChoicesOpen] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    preview: "",
    html: "",
    status: "draft" as MailingStatus,
    recipientTag: "",
    templateId: "",
    responsible: "Team",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, subRes, statusRes, mailRes] = await Promise.all([
        fetch("/api/newsletter/templates"),
        fetch("/api/newsletter/subscribers"),
        fetch("/api/inbox/status"),
        isNew
          ? Promise.resolve(null)
          : fetch(
              `/api/newsletter/mailings?id=${encodeURIComponent(mailingId)}`,
            ),
      ]);

      let loadedTemplates: Template[] = [];
      if (tplRes.ok) {
        const json = (await tplRes.json()) as { templates?: Template[] };
        loadedTemplates = json.templates ?? [];
        setTemplates(loadedTemplates);
      }
      if (subRes.ok) {
        const json = (await subRes.json()) as {
          subscribers?: Subscriber[];
          tags?: string[];
        };
        setSubscribers(json.subscribers ?? []);
        setTags(json.tags ?? []);
      }
      if (statusRes.ok) {
        const json = (await statusRes.json()) as { sender?: string | null };
        setSenderEmail(json.sender ?? null);
      }

      if (!isNew && mailRes) {
        const json = (await mailRes.json()) as {
          mailing?: NewsletterMailing;
          error?: string;
        };
        if (!mailRes.ok || !json.mailing) {
          pushToast({
            message: json.error || t("pages.emailMarketing.loadFailed"),
            tone: "error",
          });
          router.replace("/email-marketing");
          return;
        }
        const row = json.mailing;
        setMailing(row);
        setForm({
          name: row.name,
          subject: row.subject,
          preview: row.preview,
          html: pullOrphansIntoMainContent(row.html || ""),
          status: row.status,
          recipientTag: row.recipientTag ?? "",
          templateId: row.templateId ?? "",
          responsible: row.responsible || "Team",
        });
        setEditorKey(`${row.id}-${Date.now()}`);
        if (row.scheduledAt) {
          const d = new Date(row.scheduledAt);
          if (!Number.isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, "0");
            setScheduleAt(
              `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
            );
          }
        }
      } else {
        const tpl = loadedTemplates[0];
        setForm({
          name: tpl?.name || "",
          subject: tpl?.subject || "",
          preview: tpl?.preview || "",
          html: tpl?.html || "<p></p>",
          status: "draft",
          recipientTag: "",
          // Prefill content only — do not link a template until the user picks or duplicates.
          templateId: "",
          responsible: "Team",
        });
        setEditorKey(`new-${Date.now()}`);
      }
    } finally {
      setLoading(false);
    }
  }, [isNew, mailingId, pushToast, router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!bodyDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [bodyDirty]);

  const audienceCount = useMemo(() => {
    if (!form.recipientTag) return subscribers.length;
    const tag = form.recipientTag.toLowerCase();
    return subscribers.filter((s) =>
      (s.tags ?? []).some((x) => x.toLowerCase() === tag),
    ).length;
  }, [subscribers, form.recipientTag]);

  const imageSrcs = useMemo(() => collectImageSrcs(form.html), [form.html]);

  const linkedTemplateId = isNew ? null : templateIdForMailing(mailingId);
  const linkedTemplate = linkedTemplateId
    ? templates.find((tpl) => tpl.id === linkedTemplateId && !tpl.builtin)
    : undefined;
  const selectedTemplate = form.templateId
    ? templates.find((tpl) => tpl.id === form.templateId)
    : undefined;
  const updateTemplateId =
    selectedTemplate && !selectedTemplate.builtin
      ? selectedTemplate.id
      : linkedTemplate?.id ?? null;
  const updateTemplateName =
    (selectedTemplate && !selectedTemplate.builtin
      ? selectedTemplate.name
      : linkedTemplate?.name) || "";
  const isInTemplates = Boolean(linkedTemplate);

  /** Can't send/schedule again once already sent or mid-send. */
  const sendLocked = form.status === "sent" || form.status === "sending";
  /** Body/images stay editable on sent mailings so you can tweak & re-use. */
  const contentLocked = form.status === "sending";
  const activeStage = stageIndex(form.status);

  function resolveImageWidth(): ImageWidth {
    if (imageWidth === "full") return "full";
    const custom = Number.parseInt(imageWidthCustom, 10);
    if (Number.isFinite(custom) && custom >= 40 && custom <= 1200) {
      return custom;
    }
    return typeof imageWidth === "number" ? imageWidth : 320;
  }

  function openReplaceImage(src: string | null) {
    if (contentLocked) return;
    setReplaceSrc(src);
    setReplaceUrl(src && /^https?:\/\//i.test(src) ? src : "");
    if (src) {
      const layout = parseImageLayout(form.html, src);
      setImageWidth(layout.width);
      setImageAlign(layout.align);
      setImageWidthCustom(
        layout.width === "full" ? "320" : String(layout.width),
      );
    } else {
      setImageWidth(320);
      setImageAlign("left");
      setImageWidthCustom("320");
    }
    setReplaceOpen(true);
  }

  function applyImageUrl(nextUrl: string, previous: string | null) {
    const url = nextUrl.trim();
    if (!url) return;
    const width = resolveImageWidth();
    const align = imageAlign;
    if (previous) {
      setForm((prev) => ({
        ...prev,
        html: applyImageLayout(prev.html, previous, url, width, align),
      }));
    } else {
      const snippet = buildImageSnippet(url, width, align);
      const live = tryInsertSnippetInPreview(snippet);
      if (live) {
        setForm((prev) => ({ ...prev, html: live }));
      } else {
        const base = insertIntoMainContent(
          pullOrphansIntoMainContent(form.html || ""),
          snippet,
        );
        let settled = base;
        if (typeof DOMParser !== "undefined") {
          const hadHtml = /<html[\s>]/i.test(base);
          const wrapped = hadHtml
            ? base
            : `<!DOCTYPE html><html><body id="__root">${base}</body></html>`;
          const parsed = new DOMParser().parseFromString(wrapped, "text/html");
          const main = findMainContentEl(parsed);
          const imgs = [
            ...main.querySelectorAll("img[data-crm-free-img='1']"),
          ];
          const img = imgs[imgs.length - 1] as HTMLImageElement | undefined;
          if (img) {
            placeImageInFlow(img, main, {
              useDefaultSlot: true,
              side: align === "left" ? "left" : "right",
              wrap: "below",
              width: width === "full" ? 480 : width,
            });
          }
          settled = hadHtml
            ? `${parsed.doctype ? `<!DOCTYPE ${parsed.doctype.name}>\n` : "<!DOCTYPE html>\n"}${parsed.documentElement.outerHTML}`
            : parsed.getElementById("__root")?.innerHTML ||
              parsed.body.innerHTML;
        }
        setForm((prev) => ({ ...prev, html: settled }));
      }
    }
    setEditorKey(`img-${Date.now()}`);
    setBodyMode("design");
    setReplaceOpen(false);
    setReplaceSrc(null);
    pushToast({
      message: t("pages.emailMarketing.imageUpdated"),
      tone: "success",
    });
  }

  /** Insert HTML at the caret in the iframe, or into the main body container. */
  function tryInsertSnippetInPreview(snippet: string): string | null {
    const doc = previewRef.current?.contentDocument;
    if (!doc?.body) return null;
    const main = findMainContentEl(doc);
    if (/data-crm-free-img/i.test(snippet)) {
      prepareMainForFlowImages(main);
    }

    const sel = doc.getSelection();
    const holder = doc.createElement("div");
    holder.innerHTML = snippet;
    const nodes = [...holder.childNodes];
    if (!nodes.length) return null;

    if (
      bodyMode === "edit" &&
      sel &&
      sel.rangeCount > 0 &&
      main.contains(sel.anchorNode)
    ) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      const frag = doc.createDocumentFragment();
      for (const node of nodes) frag.appendChild(node);
      range.insertNode(frag);
      sel.collapseToEnd();
    } else if (/data-crm-free-img/i.test(snippet)) {
      // New images: after the first paragraph, top-right with text wrapping under.
      for (const node of nodes) {
        const before = defaultImageInsertBefore(main);
        if (before && before.parentNode === main) {
          main.insertBefore(node, before);
        } else {
          const first = [...main.children].find(
            (el) =>
              el instanceof HTMLElement &&
              el.tagName !== "IMG" &&
              !el.hasAttribute("data-crm-img-chrome"),
          );
          if (first) first.after(node);
          else main.appendChild(node);
        }
      }
    } else {
      for (const node of nodes) main.appendChild(node);
    }

    main.querySelectorAll("img[data-crm-free-img='1']").forEach((node) => {
      const img = node as HTMLImageElement;
      placeImageInFlow(img, main, {
        width:
          parsePx(img.style.width) ||
          parsePx(img.getAttribute("width")) ||
          280,
        side: (img.getAttribute("data-crm-float") as FloatSide | null) || "right",
        wrap: readWrapMode(img),
      });
    });

    const hasHtmlRoot = doc.documentElement.tagName.toLowerCase() === "html";
    return hasHtmlRoot
      ? `${doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : "<!DOCTYPE html>\n"}${doc.documentElement.outerHTML}`
      : doc.body.innerHTML;
  }

  async function uploadImageFile(file: File, previous: string | null) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/newsletter/assets", {
        method: "POST",
        body,
      });
      let json: { error?: string; url?: string } = {};
      try {
        json = (await res.json()) as { error?: string; url?: string };
      } catch {
        /* non-JSON error body */
      }
      if (!res.ok || !json.url) {
        pushToast({
          message: json.error || t("pages.emailMarketing.imageUploadFailed"),
          tone: "error",
        });
        return;
      }
      applyImageUrl(json.url, previous);
    } catch (err) {
      pushToast({
        message:
          err instanceof Error
            ? err.message
            : t("pages.emailMarketing.imageUploadFailed"),
        tone: "error",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function flushPreviewHtml() {
    const doc = previewRef.current?.contentDocument;
    if (!doc?.documentElement) return form.html;
    clearImageEditorChrome(doc);
    syncAllFreeImages(doc);
    const hasHtmlRoot = doc.documentElement.tagName.toLowerCase() === "html";
    let html = hasHtmlRoot
      ? `${doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : "<!DOCTYPE html>\n"}${doc.documentElement.outerHTML}`
      : doc.body?.innerHTML || form.html;
    html = pullOrphansIntoMainContent(html);
    setForm((prev) => ({ ...prev, html }));
    return html;
  }

  function resizePreview() {
    const frame = previewRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc?.body) return;
    const root = doc.documentElement;
    if (root && bodyMode !== "edit") {
      root.style.overflow = "hidden";
      root.style.height = "auto";
    }
    if (bodyMode !== "edit") {
      doc.body.style.overflow = "hidden";
    }
    doc.body.style.height = "auto";
    const height = Math.max(
      doc.body.scrollHeight,
      doc.body.offsetHeight,
      root?.scrollHeight ?? 0,
      root?.offsetHeight ?? 0,
      320,
    );
    setPreviewHeight(height);
    frame.style.height = `${height}px`;
  }

  function wirePreviewClicks() {
    const frame = previewRef.current;
    const doc = frame?.contentDocument;
    if (!doc?.body) return;
    doc.documentElement.style.background = "#f7f4ee";
    doc.body.style.background = "#f7f4ee";
    doc.body.style.margin = "0";
    doc.body.style.padding = "0";
    resizePreview();

    const editable = bodyMode === "edit" && !contentLocked;
    doc.body.contentEditable = editable ? "true" : "false";
    doc.body.style.caretColor = "#017e84";
    doc.body.style.outline = editable ? "none" : "";
    if (editable) {
      doc.body.style.cursor = "text";
    }

    const onInput = () => {
      setBodyDirty(true);
      resizePreview();
    };
    doc.body.oninput = onInput;

    let selectedImg: HTMLImageElement | null = null;
    let dragMode: "move" | "resize" | null = null;
    let dragArmed = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let grabOffsetX = 0;
    let grabOffsetY = 0;
    let parentWidth = 600;
    let lastClientX = 0;
    let lastClientY = 0;
    let mainEl: HTMLElement = findMainContentEl(doc);
    let dropLine: HTMLElement | null = null;
    let dropPreview: HTMLElement | null = null;
    let dropLabel: HTMLElement | null = null;
    let ghostHost: HTMLElement | null = null;
    let rafId = 0;
    let latestX = 0;
    let latestY = 0;
    let lastDropBefore: Node | null | undefined = undefined;
    let lastDropSide: FloatSide | null = null;
    let originOpacity = "";
    let originFilter = "";

    prepareMainForFlowImages(mainEl);
    mainEl.querySelectorAll("img").forEach((node) => {
      const img = node as HTMLImageElement;
      if ((img.width && img.width <= 2) || (img.height && img.height <= 2)) return;
      // Prefer text-under (not beside) unless the user explicitly chose Beside.
      placeImageInFlow(img, mainEl, {
        wrap: img.getAttribute("data-crm-wrap") === "square" ? "square" : "below",
      });
    });

    const hideOffscreen = (el: HTMLElement) => {
      el.style.transform = "translate3d(-9999px,-9999px,0)";
    };

    const ensureDropChrome = () => {
      const host = doc.documentElement || doc.body;
      if (!dropLine || !dropLine.isConnected) {
        dropLine?.remove();
        dropLine = doc.createElement("div");
        dropLine.setAttribute("data-crm-img-chrome", "drop-line");
        dropLine.setAttribute(
          "style",
          [
            "position:fixed",
            "left:0",
            "top:0",
            "width:0",
            "height:4px",
            "background:#017e84",
            "border-radius:2px",
            "z-index:2147483647",
            "pointer-events:none",
            "display:none",
            "box-shadow:0 0 0 2px #fff, 0 0 0 4px rgba(1,126,132,.35), 0 2px 10px rgba(0,0,0,.25)",
          ].join(";"),
        );
        const capL = doc.createElement("span");
        capL.setAttribute(
          "style",
          "position:absolute;left:-2px;top:-7px;width:12px;height:18px;border:3px solid #017e84;border-right:0;border-radius:3px 0 0 3px;background:#fff;box-sizing:border-box",
        );
        const capR = doc.createElement("span");
        capR.setAttribute(
          "style",
          "position:absolute;right:-2px;top:-7px;width:12px;height:18px;border:3px solid #017e84;border-left:0;border-radius:0 3px 3px 0;background:#fff;box-sizing:border-box",
        );
        dropLine.appendChild(capL);
        dropLine.appendChild(capR);
        host.appendChild(dropLine);
      }
      if (!dropPreview || !dropPreview.isConnected) {
        dropPreview?.remove();
        dropPreview = doc.createElement("div");
        dropPreview.setAttribute("data-crm-img-chrome", "drop-preview");
        dropPreview.setAttribute(
          "style",
          [
            "position:fixed",
            "left:0",
            "top:0",
            "width:0",
            "height:0",
            "box-sizing:border-box",
            "border:2px dashed #017e84",
            "background:rgba(1,126,132,0.10)",
            "border-radius:4px",
            "z-index:2147483646",
            "pointer-events:none",
            "display:none",
          ].join(";"),
        );
        host.appendChild(dropPreview);
      }
      if (!dropLabel || !dropLabel.isConnected) {
        dropLabel?.remove();
        dropLabel = doc.createElement("div");
        dropLabel.setAttribute("data-crm-img-chrome", "drop-label");
        dropLabel.setAttribute(
          "style",
          [
            "position:fixed",
            "left:0",
            "top:0",
            "padding:5px 10px",
            "background:#017e84",
            "color:#fff",
            "font:12px/1.2 sans-serif",
            "font-weight:700",
            "border-radius:4px",
            "z-index:2147483647",
            "pointer-events:none",
            "display:none",
            "white-space:nowrap",
            "box-shadow:0 2px 8px rgba(0,0,0,.25)",
          ].join(";"),
        );
        host.appendChild(dropLabel);
      }
    };

    const updateDropMarker = (clientX: number, clientY: number) => {
      if (!selectedImg || dragMode !== "move") return;
      ensureDropChrome();
      if (!dropLine || !dropPreview || !dropLabel) return;

      const before = findFlowInsertBefore(mainEl, clientY, selectedImg);
      lastDropBefore = before;
      const mainRect = mainEl.getBoundingClientRect();
      let lineY = mainRect.bottom - 2;

      if (before instanceof HTMLElement) {
        lineY = before.getBoundingClientRect().top;
      } else {
        const kids = [...mainEl.children].filter((el) => {
          if (el === selectedImg) return false;
          if ((el as HTMLElement).style?.display === "none") return false;
          if ((el as HTMLElement).hasAttribute?.("data-crm-img-chrome")) return false;
          return true;
        }) as HTMLElement[];
        if (kids.length) {
          lineY = kids[kids.length - 1]!.getBoundingClientRect().bottom;
        } else {
          lineY = Math.min(
            Math.max(clientY, mainRect.top + 8),
            mainRect.bottom - 8,
          );
        }
      }

      lineY = Math.min(Math.max(lineY, mainRect.top + 2), mainRect.bottom - 2);

      const side = resolveFloatSide(mainEl, startWidth, clientX);
      lastDropSide = side;
      const previewW = Math.min(startWidth, Math.max(40, mainRect.width - 16));
      const previewH = Math.max(36, Math.min(startHeight, 140));
      const previewLeft =
        side === "right"
          ? mainRect.right - previewW - 8
          : side === "left"
            ? mainRect.left + 8
            : mainRect.left + (mainRect.width - previewW) / 2;
      const previewTop = Math.min(lineY + 10, mainRect.bottom - previewH - 4);

      dropLine.style.display = "block";
      dropLine.style.left = `${mainRect.left}px`;
      dropLine.style.top = `${lineY - 2}px`;
      dropLine.style.width = `${Math.max(40, mainRect.width)}px`;
      dropLine.style.height = "4px";
      dropLine.style.transform = "none";
      dropLine.style.visibility = "visible";
      dropLine.style.opacity = "1";

      dropPreview.style.display = "block";
      dropPreview.style.left = `${previewLeft}px`;
      dropPreview.style.top = `${previewTop}px`;
      dropPreview.style.width = `${previewW}px`;
      dropPreview.style.height = `${previewH}px`;
      dropPreview.style.transform = "none";

      const sideText =
        side === "right"
          ? t("pages.emailMarketing.imageAlignRight")
          : side === "left"
            ? t("pages.emailMarketing.imageAlignLeft")
            : t("pages.emailMarketing.imageAlignCenter");
      dropLabel.textContent = `${t("pages.emailMarketing.imageDropHere")} · ${sideText}`;
      dropLabel.style.display = "block";
      dropLabel.style.left = `${Math.min(Math.max(mainRect.left, previewLeft), mainRect.right - 140)}px`;
      dropLabel.style.top = `${Math.max(4, lineY - 32)}px`;
      dropLabel.style.transform = "none";
    };

    const moveGhost = (clientX: number, clientY: number) => {
      if (!ghostHost) return;
      ghostHost.style.transform = `translate3d(${clientX - grabOffsetX}px,${clientY - grabOffsetY}px,0)`;
    };

    const flushMoveFrame = () => {
      rafId = 0;
      if (!dragMode || !selectedImg) return;
      lastClientX = latestX;
      lastClientY = latestY;
      const dx = latestX - startX;
      const dy = latestY - startY;

      if (dragMode === "resize") {
        // Gentle resize: dampen pointer travel and keep baseline fixed
        // (do not rewrite startWidth each frame — that makes size jump).
        const next = clamp(startWidth + dx * 0.35, 80, parentWidth);
        const snapped = Math.round(next / 8) * 8;
        const side =
          (selectedImg.getAttribute("data-crm-float") as FloatSide | null) ||
          "right";
        const wrap = readWrapMode(selectedImg);
        selectedImg.style.cssText = flowImageStyle(snapped, side, wrap);
        selectedImg.setAttribute("width", String(snapped));
        selectedImg.style.outline = "2px solid #017e84";
        selectedImg.style.outlineOffset = "2px";
        updateChromePositions();
        return;
      }

      // Drop markers only (ghost already tracks pointer on each move event).
      if (!dragArmed && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      if (!dragArmed) {
        dragArmed = true;
        doc
          .querySelectorAll(
            '[data-crm-img-chrome="handle"], [data-crm-img-chrome="toolbar"]',
          )
          .forEach((el) => {
            (el as HTMLElement).style.display = "none";
          });
        originOpacity = selectedImg.style.opacity;
        originFilter = selectedImg.style.filter;
        selectedImg.style.opacity = "0.28";
        selectedImg.style.filter = "grayscale(0.2)";
        selectedImg.style.cursor = "grabbing";
        ensureDropChrome();
        moveGhost(latestX, latestY);
      }
      updateDropMarker(latestX, latestY);
    };

    const placeChrome = (img: HTMLImageElement) => {
      clearImageEditorChrome(doc);
      dropLine = null;
      dropPreview = null;
      dropLabel = null;
      ghostHost = null;
      selectedImg = img;
      if (!/position:\s*fixed/i.test(img.getAttribute("style") || "")) {
        placeImageInFlow(img, mainEl);
      }
      img.setAttribute("data-crm-img-selected", "1");
      img.style.outline = "2px solid #017e84";
      img.style.outlineOffset = "2px";
      img.style.cursor = "grab";

      const rect = img.getBoundingClientRect();

      const handle = doc.createElement("div");
      handle.setAttribute("data-crm-img-chrome", "handle");
      handle.title = t("pages.emailMarketing.imageResizeHint");
      handle.setAttribute(
        "style",
        [
          "position:fixed",
          `left:${rect.right - 11}px`,
          `top:${rect.bottom - 11}px`,
          "width:22px",
          "height:22px",
          "background:#017e84",
          "border:2px solid #fff",
          "border-radius:4px",
          "box-sizing:border-box",
          "cursor:nwse-resize",
          "z-index:2147483646",
          "pointer-events:auto",
          "touch-action:none",
          "box-shadow:0 1px 4px rgba(0,0,0,.25)",
        ].join(";"),
      );

      const toolbar = doc.createElement("div");
      toolbar.setAttribute("data-crm-img-chrome", "toolbar");
      const widthLabel = Math.round(
        parsePx(img.style.width) ||
          parsePx(img.getAttribute("width")) ||
          rect.width,
      );
      toolbar.setAttribute(
        "style",
        [
          "position:fixed",
          `left:${Math.max(8, rect.left)}px`,
          `top:${Math.max(8, rect.top - 44)}px`,
          "display:flex",
          "flex-wrap:wrap",
          "align-items:center",
          "gap:6px",
          "padding:6px 8px",
          "background:#017e84",
          "color:#fff",
          "font:13px/1.2 sans-serif",
          "border-radius:6px",
          "z-index:2147483646",
          "pointer-events:auto",
          "box-shadow:0 2px 10px rgba(0,0,0,.18)",
          "max-width:min(92vw,420px)",
        ].join(";"),
      );

      const sizePill = doc.createElement("span");
      sizePill.setAttribute("data-crm-img-chrome", "size");
      sizePill.textContent = `${widthLabel}px`;
      sizePill.style.opacity = "0.9";
      sizePill.style.minWidth = "48px";

      const mkToolBtn = (label: string, active: boolean, onClick: () => void) => {
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.setAttribute(
          "style",
          `border:0;background:${active ? "#017e84" : "#444"};color:#fff;padding:6px 10px;border-radius:4px;cursor:pointer;font:13px sans-serif`,
        );
        btn.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        };
        return btn;
      };

      const currentWidth = () =>
        Math.round(
          parsePx(img.style.width) ||
            parsePx(img.getAttribute("width")) ||
            280,
        );

      const applyWidth = (width: number) => {
        const side =
          (img.getAttribute("data-crm-float") as FloatSide | null) || "right";
        const wrap = readWrapMode(img);
        const w = clamp(Math.round(width / 8) * 8, 80, mainEl.clientWidth || 560);
        placeImageInFlow(img, mainEl, { width: w, side, wrap });
        setBodyDirty(true);
        placeChrome(img);
        resizePreview();
      };

      const applySide = (side: FloatSide) => {
        placeImageInFlow(img, mainEl, {
          width: currentWidth(),
          side,
          wrap: "below",
        });
        setBodyDirty(true);
        placeChrome(img);
        resizePreview();
      };

      const currentSide =
        (img.getAttribute("data-crm-float") as FloatSide | null) || "right";

      const changeBtn = doc.createElement("button");
      changeBtn.type = "button";
      changeBtn.textContent = t("pages.emailMarketing.changeImage");
      changeBtn.setAttribute(
        "style",
        "border:0;background:#017e84;color:#fff;padding:6px 10px;border-radius:4px;cursor:pointer;font:13px sans-serif",
      );
      changeBtn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        flushPreviewHtml();
        openReplaceImage(img.currentSrc || img.src);
      };

      const doneBtn = doc.createElement("button");
      doneBtn.type = "button";
      doneBtn.textContent = t("pages.emailMarketing.imageDone");
      doneBtn.setAttribute(
        "style",
        "border:0;background:#444;color:#fff;padding:6px 10px;border-radius:4px;cursor:pointer;font:13px sans-serif",
      );
      doneBtn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        commitLiveImageLayout(img, mainEl);
        clearImageEditorChrome(doc);
        selectedImg = null;
        setBodyDirty(true);
        flushPreviewHtml();
        resizePreview();
      };

      toolbar.appendChild(sizePill);
      toolbar.appendChild(
        mkToolBtn(t("pages.emailMarketing.imageSmaller"), false, () =>
          applyWidth(currentWidth() - 40),
        ),
      );
      toolbar.appendChild(
        mkToolBtn(t("pages.emailMarketing.imageBigger"), false, () =>
          applyWidth(currentWidth() + 40),
        ),
      );
      toolbar.appendChild(
        mkToolBtn(
          t("pages.emailMarketing.imageAlignLeft"),
          currentSide === "left",
          () => applySide("left"),
        ),
      );
      toolbar.appendChild(
        mkToolBtn(
          t("pages.emailMarketing.imageAlignRight"),
          currentSide === "right",
          () => applySide("right"),
        ),
      );
      toolbar.appendChild(changeBtn);
      toolbar.appendChild(doneBtn);
      doc.body.appendChild(toolbar);
      doc.body.appendChild(handle);

      handle.onpointerdown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          handle.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        beginDrag(img, "resize", event.clientX, event.clientY);
      };
    };

    const updateChromePositions = () => {
      if (!selectedImg || !selectedImg.isConnected) return;
      if (dragArmed && dragMode === "move") return;
      const rect = selectedImg.getBoundingClientRect();
      const handle = doc.querySelector(
        '[data-crm-img-chrome="handle"]',
      ) as HTMLElement | null;
      const toolbar = doc.querySelector(
        '[data-crm-img-chrome="toolbar"]',
      ) as HTMLElement | null;
      const sizePill = doc.querySelector(
        '[data-crm-img-chrome="size"]',
      ) as HTMLElement | null;
      if (handle) {
        handle.style.display = "";
        handle.style.left = `${rect.right - 11}px`;
        handle.style.top = `${rect.bottom - 11}px`;
      }
      if (toolbar) {
        toolbar.style.display = "flex";
        toolbar.style.left = `${rect.left}px`;
        toolbar.style.top = `${Math.max(4, rect.top - 36)}px`;
      }
      if (sizePill) {
        const w = Math.round(
          parsePx(selectedImg.style.width) ||
            parsePx(selectedImg.getAttribute("width")) ||
            rect.width,
        );
        sizePill.textContent = `${w}px`;
      }
    };

    const beginDrag = (
      img: HTMLImageElement,
      mode: "move" | "resize",
      clientX: number,
      clientY: number,
    ) => {
      mainEl = findMainContentEl(doc);
      prepareMainForFlowImages(mainEl);
      parentWidth = Math.max(mainEl.clientWidth || 600, 80);
      dragMode = mode;
      dragArmed = false;
      startX = clientX;
      startY = clientY;
      lastClientX = clientX;
      lastClientY = clientY;
      latestX = clientX;
      latestY = clientY;
      const imgRect = img.getBoundingClientRect();
      startWidth = Math.round(
        parsePx(img.style.width) ||
          parsePx(img.getAttribute("width")) ||
          imgRect.width ||
          320,
      );
      startHeight = Math.round(imgRect.height || startWidth * 0.66);
      grabOffsetX = clientX - imgRect.left;
      grabOffsetY = clientY - imgRect.top;

      if (mode === "move") {
        unwrapImageIntoMain(img, mainEl);
        lastDropBefore = undefined;
        lastDropSide = null;
        // Floating ghost follows the pointer with GPU transforms.
        // Document stays still until drop — like Word.
        ghostHost = doc.createElement("div");
        ghostHost.setAttribute("data-crm-img-chrome", "ghost");
        ghostHost.setAttribute(
          "style",
          [
            "position:fixed",
            "left:0",
            "top:0",
            `width:${startWidth}px`,
            "z-index:2147483640",
            "pointer-events:none",
            "opacity:0.92",
            "box-shadow:0 14px 36px rgba(0,0,0,.28)",
            "border-radius:2px",
            "overflow:hidden",
            "will-change:transform",
            `transform:translate3d(${imgRect.left}px,${imgRect.top}px,0)`,
          ].join(";"),
        );
        const ghostImg = doc.createElement("img");
        ghostImg.src = img.currentSrc || img.src;
        ghostImg.alt = "";
        ghostImg.draggable = false;
        ghostImg.setAttribute(
          "style",
          `display:block;width:${startWidth}px;height:auto;border:0;pointer-events:none`,
        );
        ghostHost.appendChild(ghostImg);
        doc.body.appendChild(ghostHost);
        ensureDropChrome();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragMode || !selectedImg) return;
      event.preventDefault();
      latestX = event.clientX;
      latestY = event.clientY;
      if (dragMode === "move" && ghostHost) {
        const moved =
          dragArmed || Math.hypot(latestX - startX, latestY - startY) >= 3;
        if (moved) {
          if (!dragArmed) {
            dragArmed = true;
            doc
              .querySelectorAll(
                '[data-crm-img-chrome="handle"], [data-crm-img-chrome="toolbar"]',
              )
              .forEach((el) => {
                (el as HTMLElement).style.display = "none";
              });
            originOpacity = selectedImg.style.opacity;
            originFilter = selectedImg.style.filter;
            selectedImg.style.opacity = "0.28";
            selectedImg.style.filter = "grayscale(0.2)";
            selectedImg.style.cursor = "grabbing";
            ensureDropChrome();
          }
          moveGhost(latestX, latestY);
          // Update the placement line on every move so it never lags/hides.
          updateDropMarker(latestX, latestY);
        }
      }
      if (!rafId) {
        rafId = doc.defaultView?.requestAnimationFrame(flushMoveFrame) ?? 0;
        if (!rafId) flushMoveFrame();
      }
    };

    const endDragCleanup = () => {
      if (rafId && doc.defaultView) {
        doc.defaultView.cancelAnimationFrame(rafId);
      }
      rafId = 0;
      ghostHost?.remove();
      ghostHost = null;
      if (dropLine) {
        hideOffscreen(dropLine);
        dropLine.remove();
        dropLine = null;
      }
      if (dropPreview) {
        hideOffscreen(dropPreview);
        dropPreview.remove();
        dropPreview = null;
      }
      if (dropLabel) {
        hideOffscreen(dropLabel);
        dropLabel.remove();
        dropLabel = null;
      }
    };

    const onPointerUp = () => {
      if (!dragMode || !selectedImg) {
        endDragCleanup();
        dragMode = null;
        dragArmed = false;
        return;
      }
      const img = selectedImg;
      img.style.opacity = originOpacity;
      img.style.filter = originFilter;
      img.style.cursor = "grab";

      if (dragMode === "move" && dragArmed) {
        const side =
          lastDropSide ?? resolveFloatSide(mainEl, startWidth, lastClientX);
        const before =
          lastDropBefore !== undefined
            ? lastDropBefore
            : findFlowInsertBefore(mainEl, lastClientY, img);
        if (before && before.parentNode === mainEl) {
          mainEl.insertBefore(img, before);
        } else {
          mainEl.appendChild(img);
        }
        placeImageInFlow(img, mainEl, {
          width: startWidth,
          side,
          wrap: "below",
        });
      } else if (dragMode === "resize") {
        const width = Math.round(
          parsePx(img.style.width) || startWidth || 320,
        );
        const side =
          (img.getAttribute("data-crm-float") as FloatSide | null) || "right";
        placeImageInFlow(img, mainEl, {
          width,
          side,
          wrap: readWrapMode(img),
        });
      } else {
        placeImageInFlow(img, mainEl, {
          width: startWidth,
          wrap: "below",
        });
      }

      endDragCleanup();
      img.style.outline = "2px solid #017e84";
      img.style.outlineOffset = "2px";
      img.style.cursor = "grab";
      dragMode = null;
      dragArmed = false;
      setBodyDirty(true);
      placeChrome(img);
      resizePreview();
    };

    const selectImage = (img: HTMLImageElement) => {
      placeChrome(img);
    };

    const deselectImage = () => {
      endDragCleanup();
      if (selectedImg) {
        selectedImg.style.opacity = originOpacity || selectedImg.style.opacity;
        selectedImg.style.filter = originFilter || selectedImg.style.filter;
        selectedImg.style.display = "";
        commitLiveImageLayout(selectedImg, mainEl);
        setBodyDirty(true);
      }
      clearImageEditorChrome(doc);
      selectedImg = null;
    };

    doc.onpointermove = onPointerMove;
    doc.onpointerup = onPointerUp;
    doc.onpointercancel = onPointerUp;

    doc.onclick = (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-crm-img-chrome]")) return;
      if (target?.tagName?.toLowerCase() === "img") return;
      if (selectedImg) {
        deselectImage();
        flushPreviewHtml();
      }
    };

    doc.querySelectorAll("img").forEach((node) => {
      const img = node as HTMLImageElement;
      if (!img.complete) {
        img.addEventListener("load", () => resizePreview(), { once: true });
      }
      if (contentLocked) return;
      if ((img.width && img.width <= 2) || (img.height && img.height <= 2)) return;
      img.draggable = false;
      img.style.cursor = "pointer";
      img.style.touchAction = "none";
      img.title = t("pages.emailMarketing.imageDragHint");
      img.ondblclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        flushPreviewHtml();
        openReplaceImage(img.currentSrc || img.src);
      };
      img.onpointerdown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        try {
          img.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        selectImage(img);
        dragArmed = false;
        beginDrag(img, "move", event.clientX, event.clientY);
      };
      img.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectImage(img);
      };
    });
  }

  useEffect(() => {
    if (tab !== "body") return;
    const id = window.setTimeout(() => wirePreviewClicks(), 50);
    return () => window.clearTimeout(id);
    // Do not depend on form.html — flushing HTML while editing must not rewire/focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyMode, tab, editorKey, contentLocked]);

  useEffect(() => {
    const empty = `<p style="padding:24px;font-family:sans-serif;color:#666">${t("pages.emailMarketing.emptyBody")}</p>`;
    const html = form.html?.trim()
      ? pullOrphansIntoMainContent(form.html)
      : empty;
    setFrameSrcDoc(html);
    // Refresh iframe document only when the editor is intentionally remounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorKey]);

  function enterEditMode() {
    if (contentLocked) return;
    setBodyMode("edit");
  }

  function enterPreviewMode() {
    if (bodyMode === "edit") {
      flushPreviewHtml();
    }
    setEditorKey(`preview-${Date.now()}`);
    setBodyMode("design");
  }

  function onPreviewFormatChange() {
    // Sync React state from the live iframe DOM without remounting the frame.
    setBodyDirty(true);
    flushPreviewHtml();
    resizePreview();
    // Re-bind image click handlers after undo/format rewrites innerHTML.
    window.setTimeout(() => wirePreviewClicks(), 0);
  }

  function ensureEditThenFormat() {
    if (contentLocked) return;
    if (bodyMode !== "edit") enterEditMode();
  }

  function openSaveChoices() {
    const html = bodyMode === "edit" ? flushPreviewHtml() : form.html;
    setTemplateNameDraft(
      form.name.trim() || form.subject.trim() || t("pages.emailMarketing.title"),
    );
    setSaveChoicesOpen(true);
    return html;
  }

  function clearEditHistory() {
    const doc = previewRef.current?.contentDocument;
    if (doc) resetHtmlHistory(doc);
  }

  async function saveMailingOnly() {
    const html = bodyMode === "edit" ? flushPreviewHtml() : form.html;
    const saved = await saveMailing(undefined, html);
    if (!saved) return;
    setBodyDirty(false);
    clearEditHistory();
    setSaveChoicesOpen(false);
    if (bodyMode === "edit") {
      setEditorKey(`preview-${Date.now()}`);
      setBodyMode("design");
    }
  }

  async function saveTemplateChoice(mode: "update" | "new") {
    const html = bodyMode === "edit" ? flushPreviewHtml() : form.html;
    const saved = await saveMailing(undefined, html);
    if (!saved) return;
    setSavingTemplate(true);
    try {
      const name =
        mode === "new"
          ? templateNameDraft.trim() || saved.name || saved.subject
          : updateTemplateName || saved.name || saved.subject;
      const payload =
        mode === "update"
          ? updateTemplateId
            ? {
                id: updateTemplateId,
                name,
                subject: saved.subject,
                preview: saved.preview,
                html: saved.html,
              }
            : {
                mailingId: saved.id,
                name,
                subject: saved.subject,
                preview: saved.preview,
                html: saved.html,
              }
          : {
              name,
              subject: saved.subject,
              preview: saved.preview,
              html: saved.html,
            };
      const res = await fetch("/api/newsletter/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        pushToast({
          message: json.error || t("pages.emailMarketing.templateFailed"),
          tone: "error",
        });
        return;
      }
      if (json.id) {
        setForm((prev) => ({ ...prev, templateId: json.id! }));
      }
      pushToast({
        message:
          mode === "update"
            ? t("pages.emailMarketing.templateUpdated")
            : t("pages.emailMarketing.templateSaved"),
        tone: "success",
      });
      setBodyDirty(false);
      clearEditHistory();
      setSaveChoicesOpen(false);
      await refreshTemplates();
      if (bodyMode === "edit") {
        setEditorKey(`preview-${Date.now()}`);
        setBodyMode("design");
      }
    } finally {
      setSavingTemplate(false);
    }
  }

  async function saveMailing(
    patch?: {
      status?: MailingStatus;
      scheduledAt?: string | null;
    },
    htmlOverride?: string,
  ) {
    const html = (htmlOverride ?? form.html).trim();
    if (!form.subject.trim() && !html) {
      pushToast({
        message: t("pages.emailMarketing.needBody"),
        tone: "error",
      });
      return null;
    }
    setSaving(true);
    try {
      const id = isNew ? undefined : mailingId;
      const res = await fetch("/api/newsletter/mailings", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: form.name.trim() || form.subject.trim(),
          subject: form.subject.trim(),
          preview: form.preview.trim(),
          html,
          status: patch?.status ?? form.status,
          recipientTag: form.recipientTag || null,
          templateId: form.templateId || null,
          responsible: form.responsible,
          scheduledAt:
            patch && "scheduledAt" in patch
              ? patch.scheduledAt
              : mailing?.scheduledAt ?? null,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        mailing?: NewsletterMailing;
      };
      if (!res.ok || !json.mailing) {
        pushToast({
          message: json.error || t("pages.emailMarketing.saveFailed"),
          tone: "error",
        });
        return null;
      }
      setMailing(json.mailing);
      setForm((prev) => ({
        ...prev,
        status: json.mailing!.status,
        name: json.mailing!.name,
        subject: json.mailing!.subject,
        preview: json.mailing!.preview,
        html: json.mailing!.html,
        recipientTag: json.mailing!.recipientTag ?? "",
        responsible: json.mailing!.responsible || prev.responsible,
      }));
      setEditorKey(`saved-${json.mailing.id}-${Date.now()}`);
      clearEditHistory();
      pushToast({
        message: t("pages.emailMarketing.saved"),
        tone: "success",
      });
      if (isNew) {
        router.replace(`/email-marketing/${encodeURIComponent(json.mailing.id)}`);
      }
      return json.mailing;
    } finally {
      setSaving(false);
    }
  }

  async function deleteMailing() {
    if (isNew || !mailing) return;
    if (!window.confirm(t("pages.emailMarketing.deleteConfirm"))) return;
    const res = await fetch(
      `/api/newsletter/mailings?id=${encodeURIComponent(mailing.id)}`,
      { method: "DELETE" },
    );
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      pushToast({
        message: json.error || t("pages.emailMarketing.deleteFailed"),
        tone: "error",
      });
      return;
    }
    router.push("/email-marketing");
  }

  async function sendNow() {
    const saved = await saveMailing({ status: "draft" });
    if (!saved) return;
    router.push(
      `/newsletter?compose=1&draft=${encodeURIComponent(saved.id)}${
        form.recipientTag
          ? `&tag=${encodeURIComponent(form.recipientTag)}`
          : ""
      }`,
    );
  }

  async function scheduleMailing() {
    if (!scheduleAt) {
      pushToast({
        message: t("pages.emailMarketing.needSchedule"),
        tone: "error",
      });
      return;
    }
    const d = new Date(scheduleAt);
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now() + 60_000) {
      pushToast({
        message: t("pages.emailMarketing.needSchedule"),
        tone: "error",
      });
      return;
    }
    const saved = await saveMailing({
      status: "in_queue",
      scheduledAt: d.toISOString(),
    });
    if (!saved) return;
    setScheduleOpen(false);
    // Hand off to campaigns composer with schedule prefilled via draft
    router.push(
      `/newsletter?compose=1&draft=${encodeURIComponent(saved.id)}${
        form.recipientTag
          ? `&tag=${encodeURIComponent(form.recipientTag)}`
          : ""
      }`,
    );
  }

  async function sendTest() {
    const email = testEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      pushToast({
        message: t("pages.emailMarketing.needTestEmail"),
        tone: "error",
      });
      return;
    }
    const saved = await saveMailing();
    if (!saved) return;
    setTesting(true);
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactional: true,
          toEmail: email,
          name: saved.name,
          subject: `[TEST] ${saved.subject}`,
          previewText: saved.preview,
          htmlContent: saved.html,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        pushToast({
          message: json.error || t("pages.emailMarketing.testFailed"),
          tone: "error",
        });
        return;
      }
      pushToast({
        message: t("pages.emailMarketing.testSent"),
        tone: "success",
      });
      setTestOpen(false);
    } finally {
      setTesting(false);
    }
  }

  async function refreshTemplates() {
    const tplRes = await fetch("/api/newsletter/templates");
    if (tplRes.ok) {
      const tplJson = (await tplRes.json()) as { templates?: Template[] };
      setTemplates(tplJson.templates ?? []);
    }
  }

  async function addToTemplates() {
    const html = bodyMode === "edit" ? flushPreviewHtml() : undefined;
    const saved = await saveMailing(undefined, html);
    if (!saved) return;
    const res = await fetch("/api/newsletter/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailingId: saved.id,
        name: saved.name || saved.subject,
        subject: saved.subject,
        preview: saved.preview,
        html: saved.html,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      pushToast({
        message: json.error || t("pages.emailMarketing.templateFailed"),
        tone: "error",
      });
      return;
    }
    pushToast({
      message: t("pages.emailMarketing.templateSaved"),
      tone: "success",
    });
    await refreshTemplates();
  }

  async function removeFromTemplates() {
    if (!linkedTemplateId || isNew) return;
    const res = await fetch(
      `/api/newsletter/templates?id=${encodeURIComponent(linkedTemplateId)}`,
      { method: "DELETE" },
    );
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      pushToast({
        message: json.error || t("pages.emailMarketing.templateRemoveFailed"),
        tone: "error",
      });
      return;
    }
    pushToast({
      message: t("pages.emailMarketing.templateRemoved"),
      tone: "success",
    });
    await refreshTemplates();
  }

  async function toggleTemplate() {
    if (isInTemplates) {
      await removeFromTemplates();
      return;
    }
    await addToTemplates();
  }

  async function duplicateTemplate() {
    const html =
      (bodyMode === "edit" ? flushPreviewHtml() : form.html).trim() ||
      selectedTemplate?.html ||
      linkedTemplate?.html ||
      "";
    const subject =
      form.subject.trim() ||
      selectedTemplate?.subject ||
      linkedTemplate?.subject ||
      "";
    const preview =
      form.preview.trim() ||
      selectedTemplate?.preview ||
      linkedTemplate?.preview ||
      "";
    if (!subject || !html) {
      pushToast({
        message: t("pages.newsletter.templateNeedBody"),
        tone: "error",
      });
      return;
    }
    const suffix = t("pages.emailMarketing.templateCopySuffix");
    const baseName = (
      selectedTemplate?.name ||
      linkedTemplate?.name ||
      form.name.trim() ||
      subject
    ).trim();
    const name = copyTemplateDisplayName(
      baseName,
      suffix,
      templates.map((item) => item.name),
    );
    setDuplicating(true);
    setDuplicateNotice(null);
    try {
      const tplRes = await fetch("/api/newsletter/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          preview,
          html,
        }),
      });
      const tplJson = (await tplRes.json()) as { error?: string; id?: string };
      if (!tplRes.ok || !tplJson.id) {
        pushToast({
          message: tplJson.error || t("pages.emailMarketing.templateFailed"),
          tone: "error",
        });
        return;
      }

      const mailRes = await fetch("/api/newsletter/mailings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          preview,
          html,
          status: "draft",
          recipientTag: form.recipientTag || null,
          templateId: tplJson.id,
          responsible: form.responsible,
          scheduledAt: null,
        }),
      });
      const mailJson = (await mailRes.json()) as {
        error?: string;
        mailing?: NewsletterMailing;
      };
      if (!mailRes.ok || !mailJson.mailing) {
        pushToast({
          message: mailJson.error || t("pages.emailMarketing.saveFailed"),
          tone: "error",
        });
        return;
      }

      pushToast({
        message: t("pages.emailMarketing.templateDuplicated"),
        detail: t("pages.emailMarketing.templateDuplicatedDetail").replace(
          "{name}",
          name,
        ),
        tone: "success",
        ms: 10000,
      });
      setBodyDirty(false);
      router.push(
        `/email-marketing/${encodeURIComponent(mailJson.mailing.id)}`,
      );
    } finally {
      setDuplicating(false);
    }
  }

  function applyTemplate(id: string) {
    const tpl = templates.find((row) => row.id === id);
    if (!tpl) return;
    setForm((prev) => ({
      ...prev,
      templateId: id,
      name: prev.name || tpl.name,
      subject: tpl.subject,
      preview: tpl.preview,
      html: pullOrphansIntoMainContent(tpl.html || ""),
    }));
    setEditorKey(`${id}-${Date.now()}`);
    setBodyMode("design");
  }

  function insertSnippet(key: string) {
    if (contentLocked) return;
    const snippet = BLOCK_SNIPPETS[key];
    if (!snippet) return;
    if (bodyMode === "edit") flushPreviewHtml();
    const live = tryInsertSnippetInPreview(snippet);
    setForm((prev) => ({
      ...prev,
      html:
        live ??
        insertIntoMainContent(
          pullOrphansIntoMainContent(prev.html || ""),
          snippet,
        ),
    }));
    setBodyDirty(true);
    setEditorKey(`snip-${key}-${Date.now()}`);
  }

  function insertImage() {
    if (contentLocked) return;
    openReplaceImage(null);
  }

  if (loading) {
    return <EmptyHint>{t("common.loading")}</EmptyHint>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">
          {t("pages.emailMarketing.title")}
        </h1>
      </div>

      <EmailMarketingSubnav />

      <div className="mt-4 mb-3 text-xs text-mute">
        <Link href="/email-marketing" className="hover:text-ink">
          {t("pages.emailMarketing.tabMailings")}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-ink">
          {form.subject || t("pages.emailMarketing.newMailing")}
        </span>
      </div>

      <OdooFormToolbar>
        <button
          type="button"
          className={`${btnToolbarPrimary} gap-1.5 bg-[#714B67]! border-[#714B67]! hover:bg-[#5c3d54]!`}
          disabled={saving || sendLocked}
          onClick={() => void sendNow()}
        >
          <FaPaperPlane className="h-3.5 w-3.5" />
          {t("pages.emailMarketing.actionSend")}
        </button>
        <button
          type="button"
          className={`${btnToolbar} gap-1.5`}
          disabled={saving || sendLocked}
          onClick={() => setScheduleOpen(true)}
        >
          <FaClock className="h-3.5 w-3.5" />
          {t("pages.emailMarketing.actionSchedule")}
        </button>
        <button
          type="button"
          className={`${btnToolbar} gap-1.5`}
          disabled={saving}
          onClick={() => setTestOpen(true)}
        >
          <FaFlask className="h-3.5 w-3.5" />
          {t("pages.emailMarketing.actionTest")}
        </button>
        <button
          type="button"
          className={`${btnToolbar} gap-1.5`}
          disabled={saving || contentLocked}
          onClick={() => void toggleTemplate()}
        >
          <FaStar className="h-3.5 w-3.5" />
          {isInTemplates
            ? t("pages.emailMarketing.actionRemoveTemplate")
            : t("pages.emailMarketing.actionAddTemplate")}
        </button>
        <button
          type="button"
          className={`${btnToolbar} gap-1.5`}
          disabled={saving || savingTemplate || duplicating || contentLocked}
          onClick={() => void duplicateTemplate()}
        >
          <FaCopy className="h-3.5 w-3.5" />
          {duplicating
            ? t("pages.emailMarketing.duplicatingTemplate")
            : t("pages.emailMarketing.actionDuplicateTemplate")}
        </button>
        <button
          type="button"
          className={`${btnToolbar} gap-1.5`}
          disabled={saving || savingTemplate}
          onClick={() => {
            // Existing mailing with a custom template/copy → auto-save mailing + template.
            // Edits on a new draft (or no template) → prompt how to save.
            if (updateTemplateId && !isNew) {
              void saveTemplateChoice("update");
              return;
            }
            if (bodyMode === "edit" || bodyDirty) {
              openSaveChoices();
              return;
            }
            void saveMailing();
          }}
        >
          <FaSave className="h-3.5 w-3.5" />
          {saving || savingTemplate ? t("common.saving") : t("common.save")}
        </button>
        {!isNew ? (
          <button
            type="button"
            className={`${btnToolbar} gap-1.5`}
            disabled={saving}
            onClick={() => void deleteMailing()}
          >
            <FaTrash className="h-3.5 w-3.5" />
            {t("common.delete")}
          </button>
        ) : null}
        <span className="min-w-2 flex-1" aria-hidden />
        <div className="flex flex-wrap items-stretch overflow-hidden rounded-sm">
          {PIPELINE.map((stage, index) => {
            const active = index === activeStage;
            const reached = index <= activeStage;
            return (
              <span
                key={stage}
                className={`relative px-4 py-1.5 text-xs font-semibold ${
                  active
                    ? "bg-[#017e84] text-white"
                    : reached
                      ? "bg-[#e7e9ed] text-[#1f1f1f]"
                      : "bg-[#f8f9fa] text-[#6c757d]"
                } ${index > 0 ? "ml-1" : ""}`}
                style={
                  index < PIPELINE.length - 1
                    ? {
                        clipPath:
                          "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
                        paddingLeft: index === 0 ? "12px" : "18px",
                        paddingRight: "18px",
                      }
                    : {
                        clipPath:
                          "polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)",
                        paddingLeft: "18px",
                      }
                }
              >
                {t(`pages.emailMarketing.stage.${stage}`)}
              </span>
            );
          })}
        </div>
      </OdooFormToolbar>

      {duplicateNotice ? (
        <div className="mb-3">
          <FormNotice
            tone="success"
            title={t("pages.emailMarketing.templateDuplicated")}
            onDismiss={() => setDuplicateNotice(null)}
          >
            {t("pages.emailMarketing.templateDuplicatedDetail").replace(
              "{name}",
              duplicateNotice,
            )}
          </FormNotice>
        </div>
      ) : null}

      <div className="border border-line bg-panel">
        <div className="grid gap-4 border-b border-line px-4 py-4 sm:grid-cols-[7rem_1fr]">
          <span className="pt-2 text-sm font-medium text-mute">
            {t("pages.emailMarketing.fieldSubject")}
          </span>
          <input
            className={inputUnderlineClass}
            value={form.subject}
            disabled={contentLocked}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, subject: e.target.value }))
            }
            placeholder={t("pages.emailMarketing.subjectPlaceholder")}
          />
        </div>

        <div className="grid gap-4 border-b border-line px-4 py-4 sm:grid-cols-[7rem_1fr]">
          <span className="pt-2 text-sm font-medium text-mute">
            {t("pages.emailMarketing.fieldRecipients")}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className={`${inputClass} max-w-xs`}
              value={form.recipientTag}
              disabled={contentLocked}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, recipientTag: e.target.value }))
              }
            >
              <option value="">{t("pages.emailMarketing.allRecipients")}</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <span className="text-sm text-mute">
              {t("pages.emailMarketing.recordCount").replace(
                "{count}",
                formatNumber(audienceCount, false, locale),
              )}
            </span>
          </div>
        </div>

        {form.status === "sent" && mailing ? (
          <>
            <div className="flex flex-wrap items-stretch divide-x divide-line border-b border-line bg-ash/20">
              {(
                [
                  ["colOpened", formatRatio(mailing.openPct)],
                  ["colReplied", formatRatio(mailing.replyPct)],
                  ["colClicked", formatRatio(mailing.clickPct)],
                  ["colSent", formatNumber(mailing.sentCount, false, locale)],
                ] as const
              ).map(([labelKey, value]) => (
                <div
                  key={labelKey}
                  className="min-w-[6.5rem] flex-1 px-4 py-3 text-center"
                >
                  <p className="text-lg font-semibold tabular-nums text-ink sm:text-xl">
                    {value}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-mute">
                    {t(`pages.emailMarketing.${labelKey}`)}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-b border-line bg-[#e7f3f4] px-4 py-3 text-sm text-[#1a4a4e] dark:bg-[#1a3336] dark:text-[#b7d7da]">
              {t("pages.emailMarketing.sentSummary").replace(
                "{count}",
                formatNumber(mailing.sentCount, false, locale),
              )}
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap gap-1 border-b border-line px-2 pt-2">
          {(
            [
              ["body", t("pages.emailMarketing.tabBody")],
              ["settings", t("pages.emailMarketing.tabSettings")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                tab === key
                  ? "border-accent text-ink"
                  : "border-transparent text-mute hover:text-ink"
              }`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "settings" ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label={t("pages.newsletter.internalName")}>
              <input
                className={inputClass}
                value={form.name}
                disabled={contentLocked}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </Field>
            <Field label={t("pages.newsletter.previewText")}>
              <input
                className={inputClass}
                value={form.preview}
                disabled={contentLocked}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, preview: e.target.value }))
                }
              />
            </Field>
            <Field label={t("pages.emailMarketing.fieldFrom")}>
              <input
                className={inputClass}
                value={senderEmail || t("pages.emailMarketing.fromEnv")}
                disabled
              />
            </Field>
            <Field label={t("pages.emailMarketing.colResponsible")}>
              <input
                className={inputClass}
                value={form.responsible}
                disabled={contentLocked}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, responsible: e.target.value }))
                }
              />
            </Field>
            <Field label={t("pages.newsletter.template")}>
              <select
                className={inputClass}
                value={form.templateId}
                disabled={contentLocked}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">{t("pages.newsletter.pickTemplate")}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                    {tpl.builtin ? ` · ${t("pages.newsletter.builtin")}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <div className="flex flex-col">
            <aside className="shrink-0 border-b border-line bg-[#2c2c2c] text-[#dedede]">
              <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-2">
                {(
                  [
                    ["blocks", t("pages.emailMarketing.sideBlocks"), FaPlus],
                    ["style", t("pages.emailMarketing.sideStyle"), FaPencil],
                    ["design", t("pages.emailMarketing.sideDesign"), FaCog],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    data-side-tab={key}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold ${
                      sideTab === key
                        ? "border-b-2 border-[#017e84] text-white"
                        : "text-[#9a9a9a] hover:text-white"
                    }`}
                    onClick={() => setSideTab(key)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
                <div className="ml-auto flex flex-wrap items-center gap-2 px-2 py-1.5">
                  <button
                    type="button"
                    data-body-mode="design"
                    className={`${btnGhost} gap-1.5 ${bodyMode === "design" ? "bg-white/10 text-white" : "text-[#9a9a9a]"}`}
                    onClick={() => enterPreviewMode()}
                  >
                    <FaDesktop className="h-3.5 w-3.5" />
                    {t("pages.emailMarketing.modeDesign")}
                  </button>
                  <button
                    type="button"
                    data-body-mode="edit"
                    className={`${btnGhost} gap-1.5 ${
                      bodyMode === "edit"
                        ? "bg-[#017e84] text-white hover:bg-[#016a6f]"
                        : "border border-[#017e84]/50 bg-[#017e84]/20 text-white hover:bg-[#017e84]/35"
                    }`}
                    disabled={contentLocked}
                    onClick={() => enterEditMode()}
                  >
                    <FaPencil className="h-3.5 w-3.5" />
                    {t("pages.emailMarketing.modeEdit")}
                  </button>
                </div>
              </div>

              <div className="px-3 py-2.5">
                {sideTab === "blocks" ? (
                  <>
                  <div className="flex gap-4 overflow-x-auto pb-1">
                    <div className="min-w-0 shrink-0">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9a9a9a]">
                        {t("pages.emailMarketing.blockGroupStructure")}
                      </p>
                      <div className="flex gap-1.5">
                        {(
                          [
                            ["headers", "blockHeaders", SNIPPET_THUMB.headers],
                            ["text", "blockText", SNIPPET_THUMB.text],
                            ["images", "blockImages", SNIPPET_THUMB.images],
                            ["person", "blockPerson", SNIPPET_THUMB.person],
                            ["columns", "blockColumns", SNIPPET_THUMB.columns],
                            ["website", "blockWebsite", SNIPPET_THUMB.website],
                            ["footer", "blockFooter", SNIPPET_THUMB.footer],
                          ] as const
                        ).map(([key, labelKey, thumb]) => (
                          <button
                            key={key}
                            type="button"
                            data-block-key={key}
                            disabled={contentLocked}
                            title={t(`pages.emailMarketing.${labelKey}`)}
                            className="group flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded border border-transparent bg-[#3a3a3a] px-1.5 py-2 text-center hover:border-[#017e84] disabled:opacity-50"
                            onClick={() =>
                              key === "images"
                                ? openReplaceImage(null)
                                : insertSnippet(key)
                            }
                          >
                            <span
                              className="h-9 w-full bg-contain bg-center bg-no-repeat opacity-90 group-hover:opacity-100"
                              style={{ backgroundImage: `url(${thumb})` }}
                              aria-hidden
                            />
                            <span className="line-clamp-2 text-[10px] leading-tight text-[#dedede]">
                              {t(`pages.emailMarketing.${labelKey}`)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 shrink-0 border-l border-white/10 pl-4">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9a9a9a]">
                        {t("pages.emailMarketing.blockGroupInner")}
                      </p>
                      <div className="flex gap-1.5">
                        {(
                          [
                            ["text", "blockText", SNIPPET_THUMB.text],
                            ["alert", "blockAlert", SNIPPET_THUMB.alert],
                            ["separator", "blockSeparator", SNIPPET_THUMB.separator],
                            ["highlight", "blockHighlight", SNIPPET_THUMB.highlight],
                            ["rating", "blockRating", SNIPPET_THUMB.rating],
                            ["button", "blockButton", SNIPPET_THUMB.button],
                            ["image", "blockImage", SNIPPET_THUMB.image],
                            ["icon", "blockIcon", SNIPPET_THUMB.icon],
                            ["video", "blockVideo", SNIPPET_THUMB.video],
                            ["badge", "blockBadge", SNIPPET_THUMB.badge],
                            ["ctaBadge", "blockCtaBadge", SNIPPET_THUMB.ctaBadge],
                          ] as const
                        ).map(([key, labelKey, thumb]) => (
                          <button
                            key={`inner-${key}`}
                            type="button"
                            data-block-key={`inner-${key}`}
                            disabled={contentLocked}
                            title={t(`pages.emailMarketing.${labelKey}`)}
                            className="group flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded border border-transparent bg-[#3a3a3a] px-1.5 py-2 text-center hover:border-[#017e84] disabled:opacity-50"
                            onClick={() =>
                              key === "image"
                                ? insertImage()
                                : insertSnippet(key)
                            }
                          >
                            <span
                              className="h-9 w-full bg-contain bg-center bg-no-repeat opacity-90 group-hover:opacity-100"
                              style={{ backgroundImage: `url(${thumb})` }}
                              aria-hidden
                            />
                            <span className="line-clamp-2 text-[10px] leading-tight text-[#dedede]">
                              {t(`pages.emailMarketing.${labelKey}`)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                    <div className="mt-3 border-t border-white/10 pt-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9a9a9a]">
                          {t("pages.emailMarketing.imagesInMailing").replace(
                            "{count}",
                            String(imageSrcs.length),
                          )}
                        </p>
                        <p className="text-[10px] text-[#9a9a9a]">
                          {t("pages.emailMarketing.clickToReplaceImage")}
                        </p>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {imageSrcs.map((src) => (
                          <button
                            key={src}
                            type="button"
                            disabled={contentLocked}
                            title={t("pages.emailMarketing.changeImage")}
                            className="group relative h-16 w-20 shrink-0 overflow-hidden rounded border border-white/15 bg-[#3a3a3a] hover:border-[#017e84] disabled:opacity-50"
                            onClick={() => openReplaceImage(src)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1 py-0.5 text-center text-[9px] text-white opacity-0 group-hover:opacity-100">
                              {t("pages.emailMarketing.changeImage")}
                            </span>
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={contentLocked}
                          className="flex h-16 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded border border-dashed border-white/25 bg-[#3a3a3a] text-[10px] text-[#dedede] hover:border-[#017e84] disabled:opacity-50"
                          onClick={() => openReplaceImage(null)}
                        >
                          <FaPlus className="h-3.5 w-3.5" />
                          {t("pages.emailMarketing.addImage")}
                        </button>
                      </div>
                    </div>
                  </>
                ) : sideTab === "style" ? (
                  <div className="space-y-3">
                    <p className="text-xs text-[#9a9a9a]">
                      {t("pages.emailMarketing.styleHint")}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded border border-white/15 bg-[#3a3a3a] px-3 py-2 text-sm text-white hover:border-[#017e84]"
                        disabled={contentLocked}
                        onClick={() => enterEditMode()}
                      >
                        <FaPencil className="h-3.5 w-3.5" />
                        {t("pages.emailMarketing.modeEdit")}
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded border border-white/15 bg-[#3a3a3a] px-3 py-2 text-sm text-white hover:border-[#017e84]"
                        disabled={contentLocked}
                        onClick={() => openReplaceImage(null)}
                      >
                        <FaPlus className="h-3.5 w-3.5" />
                        {t("pages.emailMarketing.addImage")}
                      </button>
                    </div>
                    <div
                      onPointerDown={() => ensureEditThenFormat()}
                      className="rounded border border-white/10 bg-[#2f2f2f] p-2"
                    >
                      <RichTextToolbar
                        tone="dark"
                        disabled={contentLocked}
                        getDocument={() =>
                          previewRef.current?.contentDocument ?? null
                        }
                        onChange={onPreviewFormatChange}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <p className="max-w-sm text-xs text-[#9a9a9a]">
                      {t("pages.emailMarketing.designHint")}
                    </p>
                    <label className="min-w-[14rem] flex-1 space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9a9a9a]">
                        {t("pages.newsletter.template")}
                      </span>
                      <select
                        className="w-full rounded border border-white/15 bg-[#3a3a3a] px-3 py-2 text-sm text-white outline-none"
                        value={form.templateId}
                        disabled={contentLocked}
                        onChange={(e) => applyTemplate(e.target.value)}
                      >
                        <option value="">
                          {t("pages.newsletter.pickTemplate")}
                        </option>
                        {templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </aside>

            <div className="flex flex-col">
              {bodyMode === "edit" ? (
                <div className="space-y-2 border-b border-[#017e84]/30 bg-[#e7f6f7] px-3 py-3 sm:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <span className="inline-flex items-center rounded-full bg-[#017e84] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                        {t("pages.emailMarketing.editingBadge")}
                      </span>
                      <p className="text-sm font-medium text-[#1c1b19]">
                        {t("pages.emailMarketing.editVisualHint")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => enterPreviewMode()}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <FaDesktop className="h-3.5 w-3.5" />
                          {t("pages.emailMarketing.editDone")}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={saving || savingTemplate || contentLocked}
                        onClick={() => openSaveChoices()}
                      >
                        {saving || savingTemplate
                          ? t("common.saving")
                          : t("common.save")}
                      </button>
                    </div>
                  </div>
                  <RichTextToolbar
                    disabled={contentLocked}
                    getDocument={() =>
                      previewRef.current?.contentDocument ?? null
                    }
                    onChange={onPreviewFormatChange}
                  />
                </div>
              ) : null}
              <div
                className={`bg-[#f7f4ee] ${
                  bodyMode === "edit" ? "ring-2 ring-inset ring-[#017e84]/40" : ""
                }`}
              >
                <div className="w-full border-y border-line bg-[#f7f4ee]">
                  <iframe
                    key={editorKey}
                    ref={previewRef}
                    title={t("pages.emailMarketing.emailPreview")}
                    className="block w-full border-0 bg-[#f7f4ee]"
                    style={{ height: previewHeight, overflow: "hidden" }}
                    scrolling="no"
                    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={frameSrcDoc || undefined}
                    onLoad={() => wirePreviewClicks()}
                  />
                </div>
              </div>
              <FloatingSelectionToolbar
                active={bodyMode === "edit" && !contentLocked}
                disabled={contentLocked}
                iframeRef={previewRef}
                getDocument={() => previewRef.current?.contentDocument ?? null}
                getFrameElement={() => previewRef.current}
                onChange={onPreviewFormatChange}
              />
            </div>
          </div>
        )}
      </div>

      <Modal
        open={testOpen}
        title={t("pages.emailMarketing.actionTest")}
        onClose={() => setTestOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setTestOpen(false)}
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={testing}
              onClick={() => void sendTest()}
            >
              {testing ? t("common.saving") : t("pages.emailMarketing.actionTest")}
            </button>
          </div>
        }
      >
        <Field label={t("common.email")}>
          <input
            type="email"
            className={inputClass}
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
      </Modal>

      <Modal
        open={saveChoicesOpen}
        title={t("pages.emailMarketing.saveEditsTitle")}
        onClose={() => setSaveChoicesOpen(false)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setSaveChoicesOpen(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-mute">
          {t("pages.emailMarketing.saveEditsHint")}
        </p>
        <div className="space-y-2">
          <button
            type="button"
            className={`${btnSecondary} w-full justify-start text-left`}
            disabled={saving || savingTemplate}
            onClick={() => void saveMailingOnly()}
          >
            {t("pages.emailMarketing.saveMailingOnly")}
          </button>
          {updateTemplateId ? (
            <button
              type="button"
              className={`${btnSecondary} w-full justify-start text-left`}
              disabled={saving || savingTemplate}
              onClick={() => void saveTemplateChoice("update")}
            >
              {t("pages.emailMarketing.saveTemplateSame").replace(
                "{name}",
                updateTemplateName || updateTemplateId,
              )}
            </button>
          ) : null}
          <div className="rounded border border-line bg-ash/20 p-3">
            <Field label={t("pages.emailMarketing.newTemplateName")}>
              <input
                className={inputClass}
                value={templateNameDraft}
                onChange={(e) => setTemplateNameDraft(e.target.value)}
                placeholder={form.subject || form.name}
              />
            </Field>
            <button
              type="button"
              className={`${btnPrimary} mt-3 w-full`}
              disabled={saving || savingTemplate || !templateNameDraft.trim()}
              onClick={() => void saveTemplateChoice("new")}
            >
              {t("pages.emailMarketing.saveTemplateNew")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={scheduleOpen}
        title={t("pages.emailMarketing.actionSchedule")}
        onClose={() => setScheduleOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setScheduleOpen(false)}
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={saving}
              onClick={() => void scheduleMailing()}
            >
              {t("pages.emailMarketing.actionSchedule")}
            </button>
          </div>
        }
      >
        <Field label={t("pages.emailMarketing.scheduleAt")}>
          <input
            type="datetime-local"
            className={inputClass}
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
          />
        </Field>
      </Modal>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImageFile(file, replaceSrc);
        }}
      />

      <Modal
        open={replaceOpen}
        title={
          replaceSrc
            ? t("pages.emailMarketing.changeImage")
            : t("pages.emailMarketing.addImage")
        }
        onClose={() => {
          if (uploading) return;
          setReplaceOpen(false);
          setReplaceSrc(null);
        }}
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading
                ? t("common.saving")
                : t("pages.emailMarketing.uploadImage")}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className={btnSecondary}
                disabled={uploading}
                onClick={() => {
                  setReplaceOpen(false);
                  setReplaceSrc(null);
                }}
              >
                {t("common.close")}
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={uploading || !replaceUrl.trim()}
                onClick={() => applyImageUrl(replaceUrl, replaceSrc)}
              >
                {t("pages.emailMarketing.useImageUrl")}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-mute">
            {t("pages.emailMarketing.replaceImageHint")}
          </p>
          {replaceSrc ? (
            <div className="overflow-hidden border border-line bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={replaceSrc}
                alt=""
                className="mx-auto max-h-40 object-contain"
              />
            </div>
          ) : null}
          <Field label={t("pages.emailMarketing.imageUrlPrompt")}>
            <input
              className={inputClass}
              value={replaceUrl}
              onChange={(e) => setReplaceUrl(e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field label={t("pages.emailMarketing.imageSize")}>
            <div className="flex flex-wrap items-center gap-2">
              {IMAGE_WIDTH_PRESETS.map((preset) => {
                const active =
                  preset.value === "full"
                    ? imageWidth === "full"
                    : imageWidth !== "full" &&
                      Number.parseInt(imageWidthCustom, 10) === preset.value;
                return (
                  <button
                    key={String(preset.value)}
                    type="button"
                    className={active ? btnPrimary : btnSecondary}
                    onClick={() => {
                      setImageWidth(preset.value);
                      if (preset.value !== "full") {
                        setImageWidthCustom(String(preset.value));
                      }
                    }}
                  >
                    {t(preset.labelKey)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-mute">
              {t("pages.emailMarketing.imageSizeHint")}
            </p>
          </Field>
          <Field label={t("pages.emailMarketing.imagePosition")}>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["left", "pages.emailMarketing.imageAlignLeft"],
                  ["right", "pages.emailMarketing.imageAlignRight"],
                ] as const
              ).map(([value, labelKey]) => (
                <button
                  key={value}
                  type="button"
                  className={imageAlign === value ? btnPrimary : btnSecondary}
                  onClick={() => setImageAlign(value)}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
