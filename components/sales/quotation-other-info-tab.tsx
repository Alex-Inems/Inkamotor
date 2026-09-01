"use client";

import { inputUnderlineClass } from "@/components/modal";
import type { QuotationOtherInfo } from "@/lib/quotation-form-data";
import { useLocale } from "@/lib/i18n";

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mute">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function InfoField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid grid-cols-1 gap-1 py-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:items-center sm:gap-4">
      <span className="text-sm text-mute">{label}</span>
      <div className="min-w-0">{children}</div>
    </label>
  );
}

export function QuotationOtherInfoTab({
  value,
  onChange,
}: {
  value: QuotationOtherInfo;
  onChange: (patch: Partial<QuotationOtherInfo>) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="grid gap-8 px-4 py-6 lg:grid-cols-2">
      <div className="space-y-8">
        <InfoSection title={t("pages.sales.otherSales")}>
          <InfoField label={t("pages.sales.seller")}>
            <input
              className={inputUnderlineClass}
              value={value.seller}
              onChange={(e) => onChange({ seller: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.salesTeam")}>
            <input
              className={inputUnderlineClass}
              value={value.salesTeam}
              onChange={(e) => onChange({ salesTeam: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.onlineSignature")}>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.onlineSignature}
                onChange={(e) => onChange({ onlineSignature: e.target.checked })}
              />
              <span>{value.onlineSignature ? t("common.yes") : t("common.no")}</span>
            </label>
          </InfoField>
          <InfoField label={t("pages.sales.onlinePayment")}>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.onlinePayment}
                  onChange={(e) => onChange({ onlinePayment: e.target.checked })}
                />
              </label>
              {value.onlinePayment ? (
                <>
                  <span className="text-sm text-mute">{t("pages.sales.onlinePaymentOf")}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={`${inputUnderlineClass} w-16 text-right`}
                    value={value.onlinePaymentPercent}
                    onChange={(e) =>
                      onChange({
                        onlinePaymentPercent: Math.min(
                          100,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                  />
                  <span className="text-sm text-mute">%</span>
                </>
              ) : null}
            </div>
          </InfoField>
          <InfoField label={t("pages.sales.customerReference")}>
            <input
              className={inputUnderlineClass}
              value={value.customerReference}
              onChange={(e) => onChange({ customerReference: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.tags")}>
            <input
              className={inputUnderlineClass}
              value={value.tags}
              onChange={(e) => onChange({ tags: e.target.value })}
              placeholder={t("pages.sales.tagsPlaceholder")}
            />
          </InfoField>
        </InfoSection>

        <InfoSection title={t("pages.sales.otherShipping")}>
          <InfoField label={t("pages.sales.warehouse")}>
            <input
              className={inputUnderlineClass}
              value={value.warehouse}
              onChange={(e) => onChange({ warehouse: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.incoterm")}>
            <input
              className={inputUnderlineClass}
              value={value.incoterm}
              onChange={(e) => onChange({ incoterm: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.incotermLocation")}>
            <input
              className={inputUnderlineClass}
              value={value.incotermLocation}
              onChange={(e) => onChange({ incotermLocation: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.shippingPolicy")}>
            <select
              className={inputUnderlineClass}
              value={value.shippingPolicy}
              onChange={(e) => onChange({ shippingPolicy: e.target.value })}
            >
              <option value={t("pages.sales.shippingAsap")}>
                {t("pages.sales.shippingAsap")}
              </option>
              <option value={t("pages.sales.shippingWhenReady")}>
                {t("pages.sales.shippingWhenReady")}
              </option>
            </select>
          </InfoField>
          <InfoField label={t("pages.sales.deliveryDate")}>
            <input
              type="datetime-local"
              className={inputUnderlineClass}
              value={value.deliveryDate}
              onChange={(e) => onChange({ deliveryDate: e.target.value })}
            />
          </InfoField>
        </InfoSection>
      </div>

      <div className="space-y-8">
        <InfoSection title={t("pages.sales.otherBilling")}>
          <InfoField label={t("pages.sales.taxPosition")}>
            <input
              className={inputUnderlineClass}
              value={value.taxPosition}
              onChange={(e) => onChange({ taxPosition: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.paymentMethod")}>
            <input
              className={inputUnderlineClass}
              value={value.paymentMethod}
              onChange={(e) => onChange({ paymentMethod: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.project")}>
            <input
              className={inputUnderlineClass}
              value={value.project}
              onChange={(e) => onChange({ project: e.target.value })}
            />
          </InfoField>
        </InfoSection>

        <InfoSection title={t("pages.sales.otherTracking")}>
          <InfoField label={t("pages.sales.originalDocument")}>
            <input
              className={inputUnderlineClass}
              value={value.originalDocument}
              onChange={(e) => onChange({ originalDocument: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.opportunity")}>
            <input
              className={inputUnderlineClass}
              value={value.opportunity}
              onChange={(e) => onChange({ opportunity: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.campaign")}>
            <input
              className={inputUnderlineClass}
              value={value.campaign}
              onChange={(e) => onChange({ campaign: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("pages.sales.medium")}>
            <input
              className={inputUnderlineClass}
              value={value.medium}
              onChange={(e) => onChange({ medium: e.target.value })}
            />
          </InfoField>
          <InfoField label={t("common.source")}>
            <input
              className={inputUnderlineClass}
              value={value.trackingSource}
              onChange={(e) => onChange({ trackingSource: e.target.value })}
            />
          </InfoField>
        </InfoSection>
      </div>
    </div>
  );
}
