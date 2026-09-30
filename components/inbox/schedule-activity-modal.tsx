"use client";

import { useEffect, useState } from "react";
import {
  Field,
  Modal,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/modal";
import { useCrm } from "@/lib/crm-store";
import { useLocale } from "@/lib/i18n";

function isoDateOffset(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ScheduleActivityModal({
  open,
  onClose,
  relatedTo,
  relatedType,
  relatedId,
  defaultOwner,
}: {
  open: boolean;
  onClose: () => void;
  relatedTo: string;
  relatedType: "inquiry" | "lead" | "sale";
  relatedId: string;
  defaultOwner?: string;
}) {
  const { t } = useLocale();
  const { addFollowUp } = useCrm();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setNotes("");
    setDueAt(isoDateOffset(2));
  }, [open]);

  async function save() {
    if (!title.trim() || !dueAt || busy) return;
    setBusy(true);
    try {
      await addFollowUp({
        title: title.trim(),
        relatedTo,
        relatedType,
        relatedId,
        dueAt,
        owner: defaultOwner || "Team",
        notes: notes.trim(),
      });
      onClose();
    } catch {
      /* store already toasts */
    } finally {
      setBusy(false);
    }
  }

  const presets = [
    { label: t("common.today"), value: isoDateOffset(0) },
    { label: t("pages.inbox.dueTomorrow"), value: isoDateOffset(1) },
    { label: t("pages.inbox.dueIn3Days"), value: isoDateOffset(3) },
    { label: t("pages.inbox.dueNextWeek"), value: isoDateOffset(7) },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("pages.inbox.scheduleActivity")}
      subtitle={relatedTo}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !title.trim() || !dueAt}
            onClick={() => void save()}
          >
            {busy ? "…" : t("pages.inbox.schedule")}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-2xl border border-line/70 bg-linear-to-br from-accent-soft/50 via-panel to-transparent p-4">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold/10 blur-2xl" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
            {t("pages.inbox.activities")}
          </p>
          <p className="mt-1.5 max-w-[28rem] text-sm leading-relaxed text-ink/90">
            {t("pages.inbox.activitySummaryPlaceholder")}
          </p>
        </div>

        <Field label={t("pages.inbox.activitySummary")}>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("pages.inbox.activitySummaryPlaceholder")}
            autoFocus
          />
        </Field>

        <Field label={t("pages.inbox.dueDate")}>
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setDueAt(p.value)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
                    dueAt === p.value
                      ? "bg-cream/95 text-[#1c1b19]"
                      : "border border-line/80 bg-ash/40 text-mute hover:border-mute/40 hover:bg-ash hover:text-ink"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              className={inputClass}
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </Field>

        <Field label={t("pages.inbox.activityNotes")}>
          <textarea
            rows={4}
            className={`${inputClass} resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
