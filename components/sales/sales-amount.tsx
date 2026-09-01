import { formatSalesMoneyParts } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

export function SalesAmount({
  amount,
  locale,
  className = "",
  size = "sm",
  variant = "crm",
}: {
  amount: number;
  locale?: Locale;
  className?: string;
  size?: "sm" | "md" | "lg" | "inherit";
  /** `crm` = dark UI (white €). `paper` = quote/invoice on white. */
  variant?: "crm" | "paper";
}) {
  const parts = formatSalesMoneyParts(amount, locale);
  const currencyClass = variant === "paper" ? "text-[#5c5850]" : "text-ink";
  const sizeClass =
    size === "inherit"
      ? ""
      : size === "lg"
        ? "font-display text-3xl tracking-wide"
        : size === "md"
          ? "text-base font-semibold"
          : "text-sm font-medium";

  return (
    <span className={`tabular-nums ${sizeClass} ${className}`.trim()}>
      {parts.map((part, index) => (
        <span
          key={`${part.type}-${index}`}
          className={part.type === "currency" ? currencyClass : "text-green-light"}
        >
          {part.value}
        </span>
      ))}
    </span>
  );
}
