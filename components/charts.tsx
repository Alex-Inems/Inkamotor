"use client";

import { formatMoney, formatNumber } from "@/lib/format";

type SeriesPoint = {
  label: string;
  a: number;
  b?: number;
};

export function LineChart({
  title,
  points,
  aLabel,
  bLabel,
  formatA = (n) => formatMoney(n, "USD", true),
  formatB = (n) => formatNumber(n),
}: {
  title: string;
  points: SeriesPoint[];
  aLabel: string;
  bLabel?: string;
  formatA?: (n: number) => string;
  formatB?: (n: number) => string;
}) {
  const width = 560;
  const height = 220;
  const pad = { t: 16, r: 16, b: 28, l: 12 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(
    ...points.flatMap((p) => [p.a, p.b ?? 0]),
    1,
  );

  const x = (i: number) =>
    pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  const pathA = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.a)}`)
    .join(" ");
  const pathB = points.some((p) => p.b != null)
    ? points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.b ?? 0)}`)
        .join(" ")
    : null;

  const areaA = `${pathA} L ${x(points.length - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH} Z`;

  const latest = points[points.length - 1];

  if (points.length === 0) {
    return (
      <div className="border border-line bg-panel p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">
          {title}
        </p>
        <p className="mt-3 text-sm text-mute">No data for this period.</p>
      </div>
    );
  }

  return (
    <div className="border border-line bg-panel p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">
            {title}
          </p>
          <p className="mt-1 font-display text-xl font-bold">
            {formatA(latest.a)}
            {bLabel && latest.b != null ? (
              <span className="ml-2 text-sm font-medium text-mute">
                · {formatB(latest.b)} {bLabel.toLowerCase()}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5 text-ink">
            <span className="h-2 w-2 bg-accent" />
            {aLabel}
          </span>
          {bLabel ? (
            <span className="inline-flex items-center gap-1.5 text-ink">
              <span className="h-2 w-2 bg-pink" />
              {bLabel}
            </span>
          ) : null}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
        <defs>
          <linearGradient id="areaAccent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#31595d" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#31595d" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad.l}
            x2={width - pad.r}
            y1={pad.t + innerH * (1 - t)}
            y2={pad.t + innerH * (1 - t)}
            stroke="#3a3834"
            strokeWidth="1"
          />
        ))}
        <path d={areaA} fill="url(#areaAccent)" />
        <path d={pathA} fill="none" stroke="#31595d" strokeWidth="2.5" />
        {pathB ? (
          <path
            d={pathB}
            fill="none"
            stroke="#e1736c"
            strokeWidth="2.5"
            strokeDasharray="0"
          />
        ) : null}
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.a)} r="3.5" fill="#ecbb5a" />
            {p.b != null ? (
              <circle cx={x(i)} cy={y(p.b)} r="3.5" fill="#e1736c" />
            ) : null}
            <text
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#b8b3a8"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function BarChart({
  title,
  points,
  formatValue = (n) => formatMoney(n, "USD", true),
}: {
  title: string;
  points: { label: string; value: number }[];
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="border border-line bg-panel p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {points.map((p) => (
          <div key={p.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{p.label}</span>
              <span className="text-mute">{formatValue(p.value)}</span>
            </div>
            <div className="h-2.5 overflow-hidden bg-ash">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${(p.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  title,
  segments,
  centerLabel = "100%",
  centerHint = "mix",
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerHint?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = 54;
  const stroke = 18;
  const c = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="border border-line bg-panel p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">
        {title}
      </p>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
          <g transform="translate(70,70) rotate(-90)">
            {segments.map((seg) => {
              const len = (seg.value / total) * c;
              const dash = `${len} ${c - len}`;
              const el = (
                <circle
                  key={seg.label}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
          </g>
          <text
            x="70"
            y="68"
            textAnchor="middle"
            className="fill-ink"
            fontSize="16"
            fontWeight="700"
          >
            {centerLabel}
          </text>
          <text
            x="70"
            y="86"
            textAnchor="middle"
            fill="#b8b3a8"
            fontSize="10"
          >
            {centerHint}
          </text>
        </svg>
        <ul className="w-full space-y-2 text-sm">
          {segments.map((seg) => (
            <li key={seg.label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0"
                  style={{ background: seg.color }}
                />
                {seg.label}
              </span>
              <span className="font-semibold">
                {typeof seg.value === "number" && seg.value <= 100
                  ? `${seg.value}%`
                  : formatNumber(seg.value, true)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function GroupedBarChart({
  title,
  points,
  aLabel,
  bLabel,
  cLabel,
}: {
  title: string;
  points: { label: string; a: number; b: number; c?: number }[];
  aLabel: string;
  bLabel: string;
  cLabel?: string;
}) {
  const width = 640;
  const height = 240;
  const pad = { t: 20, r: 12, b: 36, l: 12 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(
    ...points.flatMap((p) => [p.a, p.b, p.c ?? 0]),
    1,
  );
  const groupW = innerW / points.length;
  const barCount = cLabel ? 3 : 2;
  const barW = Math.min(18, (groupW * 0.7) / barCount);

  function bar(x: number, value: number, color: string, key: string) {
    const h = (value / max) * innerH;
    return (
      <rect
        key={key}
        x={x}
        y={pad.t + innerH - h}
        width={barW}
        height={Math.max(h, 1)}
        fill={color}
      />
    );
  }

  return (
    <div className="border border-line bg-panel p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">
          {title}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 bg-accent" />
            {aLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 bg-pink" />
            {bLabel}
          </span>
          {cLabel ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 bg-ink" />
              {cLabel}
            </span>
          ) : null}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad.l}
            x2={width - pad.r}
            y1={pad.t + innerH * (1 - t)}
            y2={pad.t + innerH * (1 - t)}
            stroke="#3a3834"
            strokeWidth="1"
          />
        ))}
        {points.map((p, i) => {
          const base = pad.l + i * groupW + groupW * 0.15;
          return (
            <g key={p.label}>
              {bar(base, p.a, "#31595d", `${p.label}-a`)}
              {bar(base + barW + 4, p.b, "#e1736c", `${p.label}-b`)}
              {cLabel && p.c != null
                ? bar(base + (barW + 4) * 2, p.c, "#ecbb5a", `${p.label}-c`)
                : null}
              <text
                x={pad.l + i * groupW + groupW / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
                fill="#b8b3a8"
              >
                {p.label.length > 14 ? `${p.label.slice(0, 12)}…` : p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ConversionFunnel({
  title,
  impressions,
  clicks,
  conversions,
}: {
  title: string;
  impressions: number;
  clicks: number;
  conversions: number;
}) {
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const cvr = clicks ? (conversions / clicks) * 100 : 0;
  const steps = [
    {
      label: "Impressions",
      value: impressions,
      width: 100,
      color: "#31595d",
    },
    {
      label: "Clicks",
      value: clicks,
      width: Math.max(18, ctr * 8),
      color: "#624e8a",
      rate: `CTR ${ctr.toFixed(2)}%`,
    },
    {
      label: "Conversions",
      value: conversions,
      width: Math.max(12, cvr * 10),
      color: "#e1736c",
      rate: `CVR ${cvr.toFixed(2)}%`,
    },
  ];

  return (
    <div className="border border-line bg-panel p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">
        {title}
      </p>
      <div className="mt-5 space-y-3">
        {steps.map((step) => (
          <div key={step.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{step.label}</span>
              <span className="text-mute">
                {formatNumber(step.value, true)}
                {step.rate ? ` · ${step.rate}` : ""}
              </span>
            </div>
            <div className="h-8 overflow-hidden bg-ash">
              <div
                className="flex h-full items-center px-3 text-xs font-semibold text-white"
                style={{
                  width: `${Math.min(step.width, 100)}%`,
                  background: step.color,
                }}
              >
                {step.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
