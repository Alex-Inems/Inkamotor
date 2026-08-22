export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[1.6rem] leading-none tracking-wide break-words text-ink sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mute sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center [&>div]:flex [&>div]:w-full [&>div]:flex-col sm:[&>div]:w-auto sm:[&>div]:flex-row [&_a]:w-full sm:[&_a]:w-auto [&_button]:w-full sm:[&_button]:w-auto">
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="h-full border border-line bg-panel px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-[0.7rem] font-medium uppercase leading-snug tracking-[0.14em] text-mute">
        {label}
      </p>
      <p className="mt-2.5 font-display text-[1.45rem] leading-tight tracking-wide break-words sm:text-2xl lg:text-3xl">
        {value}
      </p>
      {hint ? (
        <div className="mt-2 text-xs leading-relaxed text-mute break-words">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
  compact,
}: {
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  compact?: boolean;
}) {
  const tones = {
    neutral: "bg-ash text-ink",
    info: "bg-purple/25 text-cream",
    success: "bg-green/20 text-sand",
    warning: "bg-gold/20 text-gold",
    danger: "bg-wine/25 text-pink",
  };

  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap font-semibold capitalize leading-none ${
        compact
          ? "px-1.5 py-1 text-[10px] tracking-[0.04em]"
          : "px-2 py-0.5 text-xs leading-snug"
      } ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-panel">
      {title ? (
        <div className="flex flex-col gap-2 border-b border-line px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
          <h2 className="min-w-0 font-display text-base leading-snug tracking-wide break-words sm:text-lg">
            {title}
          </h2>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 py-6 text-center text-sm leading-relaxed text-mute">
      {children}
    </p>
  );
}
