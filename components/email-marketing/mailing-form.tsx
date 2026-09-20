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
import { useCrm } from "@/lib/crm-store";
import { formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { MailingStatus, NewsletterMailing } from "@/lib/newsletter/mailings";
import { templateIdForMailing } from "@/lib/newsletter/templates";

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
  images: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td align="center" style="padding:0 16px"><img src="https://inkamototours.com/logo.png" alt="" style="max-width:100%;height:auto;display:block" /></td></tr></table>`,
  person: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td style="padding:0 16px;font-family:Arial,sans-serif;color:#222"><table><tr><td style="padding-right:12px"><div style="width:56px;height:56px;border-radius:50%;background:#ddd"></div></td><td><strong>Jorge Inkamoto</strong><br/><span style="color:#666;font-size:13px">Guide moto · Pérou</span></td></tr></table></td></tr></table>`,
  columns: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td width="33%" valign="top" style="padding:8px;font-family:Arial,sans-serif;font-size:14px;color:#222">Column 1</td><td width="33%" valign="top" style="padding:8px;font-family:Arial,sans-serif;font-size:14px;color:#222">Column 2</td><td width="33%" valign="top" style="padding:8px;font-family:Arial,sans-serif;font-size:14px;color:#222">Column 3</td></tr></table>`,
  website: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td align="center" style="padding:16px;font-family:Arial,sans-serif"><a href="https://inkamototours.com" style="color:#31595d;font-weight:700">inkamototours.com</a></td></tr></table>`,
  footer: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:32px;padding-top:16px;border-top:1px solid #e6e1d8"><tr><td style="font-family:Arial,sans-serif;font-size:12px;color:#8a8478;text-align:center;padding:16px"><p>Inkamoto Tours · <a href="https://inkamototours.com" style="color:#31595d">inkamototours.com</a></p><p><a href="{{ unsubscribe }}" style="color:#31595d">Unsubscribe</a></p></td></tr></table>`,
  alert: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td style="border-left:4px solid #714B67;background:#f8f5f7;padding:14px 16px;font-family:Arial,sans-serif;color:#222">Important message</td></tr></table>`,
  separator: `<hr style="border:none;border-top:1px solid #e6e1d8;margin:24px 16px" />`,
  highlight: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td style="background:#31595d;color:#fff;padding:18px 16px;font-family:Georgia,serif;font-size:18px;text-align:center">Highlighted text</td></tr></table>`,
  rating: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td align="center" style="font-size:22px;letter-spacing:2px;color:#714B67">★★★★★</td></tr></table>`,
  button: `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px auto"><tr><td style="background:#714B67;border-radius:4px"><a href="https://inkamototours.com" style="display:inline-block;padding:12px 22px;color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none">Learn more</a></td></tr></table>`,
  image: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td align="center" style="padding:0 16px"><img src="https://inkamototours.com/logo.png" alt="" style="max-width:100%;height:auto;display:block" /></td></tr></table>`,
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [previewHeight, setPreviewHeight] = useState(640);
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
          html: row.html,
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
          templateId: tpl?.id || "",
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

  function openReplaceImage(src: string | null) {
    if (contentLocked) return;
    setReplaceSrc(src);
    setReplaceUrl(src && /^https?:\/\//i.test(src) ? src : "");
    setReplaceOpen(true);
  }

  function applyImageUrl(nextUrl: string, previous: string | null) {
    const url = nextUrl.trim();
    if (!url) return;
    if (previous) {
      setForm((prev) => ({
        ...prev,
        html: replaceImageSrc(prev.html, previous, url),
      }));
    } else {
      const snippet = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0"><tr><td align="center"><img src="${url}" alt="" style="max-width:100%;height:auto;display:block" /></td></tr></table>`;
      setForm((prev) => ({ ...prev, html: `${prev.html || ""}\n${snippet}` }));
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

  async function uploadImageFile(file: File, previous: string | null) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/newsletter/assets", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !json.url) {
        pushToast({
          message: json.error || t("pages.emailMarketing.imageUploadFailed"),
          tone: "error",
        });
        return;
      }
      applyImageUrl(json.url, previous);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function flushPreviewHtml() {
    const doc = previewRef.current?.contentDocument;
    if (!doc?.documentElement) return form.html;
    const hasHtmlRoot = doc.documentElement.tagName.toLowerCase() === "html";
    const html = hasHtmlRoot
      ? `${doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : "<!DOCTYPE html>\n"}${doc.documentElement.outerHTML}`
      : doc.body?.innerHTML || form.html;
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
    resizePreview();

    const editable = bodyMode === "edit" && !contentLocked;
    doc.body.contentEditable = editable ? "true" : "false";
    doc.body.style.caretColor = "#017e84";
    if (editable) {
      doc.body.focus();
    }

    const onInput = () => {
      setBodyDirty(true);
      resizePreview();
    };
    doc.body.oninput = onInput;

    doc.querySelectorAll("img").forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", () => resizePreview(), { once: true });
      }
      if (contentLocked) return;
      img.style.cursor = "pointer";
      img.title = t("pages.emailMarketing.clickToReplaceImage");
      img.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (editable) flushPreviewHtml();
        openReplaceImage(img.currentSrc || img.src);
      };
    });
  }

  useEffect(() => {
    if (tab !== "body") return;
    const id = window.setTimeout(() => wirePreviewClicks(), 50);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyMode, tab, form.html, editorKey, contentLocked]);

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

  function openSaveChoices() {
    const html = bodyMode === "edit" ? flushPreviewHtml() : form.html;
    setTemplateNameDraft(
      form.name.trim() || form.subject.trim() || t("pages.emailMarketing.title"),
    );
    setSaveChoicesOpen(true);
    return html;
  }

  async function saveMailingOnly() {
    const html = bodyMode === "edit" ? flushPreviewHtml() : form.html;
    const saved = await saveMailing(undefined, html);
    if (!saved) return;
    setBodyDirty(false);
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
    const name = baseName.endsWith(suffix.trim())
      ? baseName
      : `${baseName}${suffix}`;
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
      html: tpl.html,
    }));
    setEditorKey(`${id}-${Date.now()}`);
    setBodyMode("design");
  }

  function insertSnippet(key: string) {
    if (contentLocked) return;
    const snippet = BLOCK_SNIPPETS[key];
    if (!snippet) return;
    if (bodyMode === "edit") flushPreviewHtml();
    setForm((prev) => ({
      ...prev,
      html: `${prev.html || ""}\n${snippet}`,
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
            if (bodyMode === "edit" || bodyDirty) openSaveChoices();
            else void saveMailing();
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
                    className={`${btnGhost} gap-1.5 ${bodyMode === "edit" ? "bg-white/10 text-white" : "text-[#9a9a9a]"}`}
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
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs text-[#9a9a9a]">
                      {t("pages.emailMarketing.styleHint")}
                    </p>
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
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-ash/30 px-3 py-2 sm:px-4">
                  <p className="text-xs text-mute">
                    {t("pages.emailMarketing.editVisualHint")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => enterPreviewMode()}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <FaDesktop className="h-3.5 w-3.5" />
                        {t("pages.emailMarketing.modeDesign")}
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
              ) : null}
              <div
                className={`bg-[#f4f3ef] p-3 sm:p-6 ${
                  bodyMode === "edit" ? "ring-2 ring-inset ring-[#017e84]/40" : ""
                }`}
              >
                <div className="mx-auto max-w-4xl border border-line bg-white shadow-sm">
                  <iframe
                    key={editorKey}
                    ref={previewRef}
                    title={t("pages.emailMarketing.emailPreview")}
                    className="block w-full border-0 bg-white"
                    style={{ height: previewHeight, overflow: "hidden" }}
                    scrolling="no"
                    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={
                      form.html?.trim()
                        ? form.html
                        : `<p style="padding:24px;font-family:sans-serif;color:#666">${t("pages.emailMarketing.emptyBody")}</p>`
                    }
                    onLoad={() => wirePreviewClicks()}
                  />
                </div>
              </div>
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
        </div>
      </Modal>
    </div>
  );
}
