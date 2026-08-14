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
        <h1 className="font-display text-[1.75rem] leading-none tracking-wide break-words text-ink sm:text-4xl">
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
    <div className="border border-line bg-panel p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-mute">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl tracking-wide break-all sm:text-3xl sm:break-normal">
        {value}
      </p>
      {hint ? <div className="mt-1 text-xs text-mute">{hint}</div> : null}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
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
      className={`inline-flex px-2 py-0.5 text-xs font-semibold capitalize ${tones[tone]}`}
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
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="min-w-0 truncate font-display text-base tracking-wide sm:text-lg">
            {title}
          </h2>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-mute">{children}</p>;
}
