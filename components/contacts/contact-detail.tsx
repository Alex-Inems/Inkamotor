"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { btnToolbar, btnToolbarPrimary } from "@/components/modal";
import { OdooFormToolbar } from "@/components/sales/odoo-form-toolbar";
import { SaleChatPanel } from "@/components/sales/sale-chat-thread";
import { EmptyHint, StatusBadge } from "@/components/ui";
import {
  contactWriteFromLead,
  emptyContactWrite,
  tagList,
  type ContactDetails,
  type ContactWrite,
} from "@/lib/crm/contact-details";
import {
  defaultPipelineStages,
  isCoreStageId,
  readPipelineFromStorage,
  type PipelineStage,
} from "@/lib/crm/pipeline";
import { useCrm } from "@/lib/crm-store";
import { quickSaleInput } from "@/lib/quotation-form-data";
import { type Lead } from "@/lib/demo-data";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

type ContactRow = { lead: Lead; details: ContactDetails; score?: number };

const FORM_ID = "contact-detail-form";

const AVATAR_TONES = [
  "bg-[#714B67]",
  "bg-[#3d8b7a]",
  "bg-[#c47a3a]",
  "bg-[#5a7aa8]",
  "bg-[#6b8f3a]",
  "bg-[#a85a5a]",
];

function avatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function initials(name: string, email: string) {
  const base = (name || email.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : base.slice(0, 2);
  return (letters || "?").toUpperCase();
}

export function ContactDetail({ contactId }: { contactId: string }) {
  const isNew = contactId === "new";
  const router = useRouter();
  const { addSale, pushToast } = useCrm();
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(!isNew);
  const [row, setRow] = useState<ContactRow | null>(null);
  const [form, setForm] = useState<ContactWrite>(emptyContactWrite());
  const [pipeline, setPipeline] = useState<PipelineStage[]>(defaultPipelineStages);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const local = readPipelineFromStorage();
    if (local?.length) setPipeline(local);
  }, []);

  const stageLabel = useCallback(
    (id: string) => {
      const custom = pipeline.find((s) => s.id === id)?.label.trim();
      if (custom) return custom;
      if (isCoreStageId(id)) return t(`stages.${id}`);
      return id;
    },
    [pipeline, t],
  );

  const load = useCallback(async () => {
    if (isNew) {
      setRow(null);
      setForm(emptyContactWrite());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/leads?id=${encodeURIComponent(contactId)}`,
      );
      const json = (await res.json()) as { row?: ContactRow; error?: string };
      if (!res.ok || !json.row) {
        pushToast({
          message: json.error || t("pages.contacts.notFound"),
          tone: "error",
        });
        setRow(null);
        setLoading(false);
        return;
      }
      setRow(json.row);
      setForm(contactWriteFromLead(json.row.lead, json.row.details));
    } finally {
      setLoading(false);
    }
  }, [contactId, isNew, pushToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveContact() {
    if (!form.name.trim()) {
      setFormError(t("pages.contacts.nameRequired"));
      return;
    }
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/leads", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? form : { ...form, id: contactId }),
    });
    const json = (await res.json()) as { error?: string; row?: ContactRow };
    setSaving(false);
    if (!res.ok || !json.row) {
      setFormError(json.error || t("toast.saveFailed"));
      return;
    }
    pushToast({
      message: isNew
        ? t("pages.contacts.created", { name: form.name.trim() })
        : t("pages.contacts.saved"),
      tone: "success",
    });
    if (isNew) {
      router.replace(`/contacts/${encodeURIComponent(json.row.lead.id)}`);
      return;
    }
    setRow(json.row);
    setForm(contactWriteFromLead(json.row.lead, json.row.details));
  }

  function createBooking() {
    if (!row) return;
    void addSale(
      quickSaleInput({
        customer: row.lead.name,
        email: row.lead.email,
        product:
          row.lead.notes.slice(0, 80) || t("pages.leads.tourBooking"),
        amount: row.lead.value || 0,
        source: "lead",
        inquiryId: null,
        leadId: row.lead.id,
        notes: row.lead.notes,
      }),
    );
  }

  if (loading) {
    return <EmptyHint>{t("common.loading")}</EmptyHint>;
  }

  if (!isNew && !row) {
    return (
      <div className="space-y-3">
        <EmptyHint>{t("pages.contacts.notFound")}</EmptyHint>
        <Link href="/contacts" className="text-sm font-semibold text-gold hover:underline">
          {t("pages.contacts.backToList")}
        </Link>
      </div>
    );
  }

  const title = isNew
    ? t("pages.contacts.newContact")
    : form.name.trim() || row?.lead.name || t("pages.contacts.editContact");
  const chatEmail = (form.email || row?.lead.email || "").trim();
  const chatName = (form.name || row?.lead.name || "").trim();
  const tags = tagList(form.tags).slice(0, 6);
  const subtitle = [chatEmail, form.phone.trim()].filter(Boolean).join(" · ");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      <div className="mb-3 shrink-0 text-xs text-mute">
        <Link href="/contacts" className="hover:text-ink">
          {t("pages.contacts.title")}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-ink">{title}</span>
      </div>

      <div className="shrink-0">
      <OdooFormToolbar>
        <button
          type="submit"
          form={FORM_ID}
          className={btnToolbarPrimary}
          disabled={saving}
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
        {!isNew && chatEmail ? (
          <Link
            href={`/inbox?chat=${encodeURIComponent(chatEmail)}`}
            className={btnToolbar}
          >
            {t("pages.contacts.openInbox")}
          </Link>
        ) : null}
        {!isNew && row ? (
          <button
            type="button"
            className={btnToolbar}
            onClick={() => createBooking()}
          >
            {t("pages.leads.createSale")}
          </button>
        ) : null}
        <Link href="/contacts" className={btnToolbar}>
          {t("common.cancel")}
        </Link>
      </OdooFormToolbar>
      </div>

      {formError ? (
        <p className="mb-3 shrink-0 border border-wine/40 bg-wine/10 px-3 py-2 text-sm text-pink">
          {formError}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 overflow-hidden border border-line bg-panel max-lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <header className="border-b border-line bg-gradient-to-b from-ash/30 to-transparent px-5 py-5 sm:px-6">
            <div className="flex items-start gap-4">
              <span
                className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white shadow-sm ring-2 ring-line/60 ${avatarTone(title)}`}
                aria-hidden
              >
                {initials(title, chatEmail)}
              </span>
              <div className="min-w-0 flex-1">
                <input
                  className="w-full border-0 bg-transparent text-xl font-semibold tracking-tight text-ink outline-none placeholder:text-mute/50 focus:ring-0 sm:text-2xl"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={t("common.name")}
                  aria-label={t("common.name")}
                  required
                  form={FORM_ID}
                />
                {subtitle ? (
                  <p className="mt-0.5 truncate text-sm text-mute">{subtitle}</p>
                ) : null}
                {!isNew && row ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={form.isCompany ? "info" : "neutral"}
                      compact
                    >
                      {form.isCompany
                        ? t("pages.contacts.company")
                        : t("pages.contacts.person")}
                    </StatusBadge>
                    <StatusBadge tone="info" compact>
                      {stageLabel(form.status)}
                    </StatusBadge>
                    <span className="text-xs text-mute">
                      {t("pages.contacts.lastContact")}:{" "}
                      {formatDate(row.lead.lastContact, locale)}
                    </span>
                  </div>
                ) : null}
                {tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-sm bg-ash px-2 py-0.5 text-[11px] font-medium text-mute"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <ContactForm
            formId={FORM_ID}
            layout="sheet"
            value={form}
            onChange={setForm}
            onSubmit={() => void saveContact()}
            stages={pipeline.map((s) => ({ id: s.id, label: s.label }))}
            stageLabel={stageLabel}
          />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden border-t border-line lg:border-t-0">
          <SaleChatPanel
            email={chatEmail}
            customerName={chatName}
            title={t("pages.contacts.messages")}
          />
        </div>
      </div>
    </div>
  );
}
