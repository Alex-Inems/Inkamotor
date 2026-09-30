"use client";

import { Modal, btnPrimary, btnSecondary, inputClass } from "@/components/modal";
import { useLocale } from "@/lib/i18n";

export function EditMessageModal({
  open,
  onClose,
  value,
  onChange,
  onSave,
  isNote,
}: {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  isNote?: boolean;
}) {
  const { t } = useLocale();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("pages.inbox.editMessage")}
      subtitle={
        isNote ? t("pages.inbox.internalNote") : t("pages.inbox.sendMessage")
      }
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-[11px] text-mute sm:block">
            {t("pages.inbox.editLocalHint")}
          </p>
          <div className="ml-auto flex gap-2">
            <button type="button" className={btnSecondary} onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={!value.trim()}
              onClick={onSave}
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      }
    >
      <div className="rounded-2xl border border-line/70 bg-canvas/40 p-1">
        <textarea
          rows={10}
          className={`${inputClass} min-h-56 resize-y border-0 bg-transparent focus:shadow-none`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      </div>
    </Modal>
  );
}
