"use client";

import { useEffect, useState } from "react";
import { btnPrimary, btnSecondary, inputClass, Modal } from "@/components/modal";
import { type Sale } from "@/lib/demo-data";
import { useLocale } from "@/lib/i18n";
import {
  quoteEmailBodyText,
  quoteEmailSubject,
} from "@/lib/mail/quote-email-copy";
import { enrichSale } from "@/lib/sale-quote";

export function SendQuotationModal({
  open,
  sale,
  sending,
  onClose,
  onSend,
}: {
  open: boolean;
  sale: Sale | null;
  sending: boolean;
  onClose: () => void;
  onSend: (message: string) => void | Promise<void>;
}) {
  const { t, locale } = useLocale();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !sale) return;
    setMessage(quoteEmailBodyText(enrichSale(sale), locale));
  }, [open, sale, locale]);

  const enriched = sale ? enrichSale(sale) : null;

  return (
    <Modal
      open={open && !!sale}
      title={t("pages.sales.sendQuotation")}
      onClose={onClose}
      wide
      footer={
        enriched ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btnSecondary} disabled={sending} onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={sending || !message.trim()}
              onClick={() => void onSend(message.trim())}
            >
              {sending ? t("common.sending") : t("pages.sales.sendQuotation")}
            </button>
          </div>
        ) : null
      }
    >
      {enriched ? (
        <div className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-mute">{t("pages.sales.quoteEmailTo")}: </span>
              <span className="font-medium">{enriched.email}</span>
            </p>
            <p className="sm:col-span-2">
              <span className="text-mute">{t("pages.sales.quoteEmailSubjectLabel")}: </span>
              <span className="font-medium">{quoteEmailSubject(enriched, locale)}</span>
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
              {t("pages.sales.quoteEmailMessage")}
            </span>
            <textarea
              className={`${inputClass} min-h-44 resize-y font-sans text-sm leading-relaxed`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
            <p className="text-xs text-mute">{t("pages.sales.quoteEmailMessageHint")}</p>
          </label>
        </div>
      ) : null}
    </Modal>
  );
}
