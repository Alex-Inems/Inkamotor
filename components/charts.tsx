"use client";

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { formatMoney, formatNumber } from "@/lib/format";

type SeriesPoint = {
  label: string;
  a: number;
  b?: number;
  /** Optional `YYYY-MM` / `YYYY-MM-DD` so incomplete current periods can be skipped in trends. */
  periodKey?: string;
};

function smoothLine(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].find((n) => n * pow >= raw) ?? 10;
  const step = nice * pow;
  const ticks: number[] = [];
  for (let v = step; v < max * 1.05; v += step) ticks.push(v);
  if (!ticks.length || ticks[ticks.length - 1]! < max) ticks.push(step * Math.ceil(max / step));
  return ticks;
}

function ChartShell({
  title,
  meta,
  legend,
  children,
  className = "",
  plain = false,
}: {
  title: string;
  meta?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden px-5 py-4 sm:px-6 sm:py-5 ${
        plain
          ? "bg-transparent"
          : "border border-line/70 bg-panel/80"
      } ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_80%_100%_at_20%_0%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_70%)]"
        aria-hidden
      />
      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-mute">
            {title}
          </p>
          {meta ? <div className="mt-1.5">{meta}</div> : null}
        </div>
        {legend ? (
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-mute">
            {legend}
          </div>
        ) : null}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

function LegendDot({
  colorClass,
  label,
}: {
  colorClass: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-[1px] ${colorClass}`} />
      {label}
    </span>
  );
}

export function LineChart({
  title,
  points,
  aLabel,
  bLabel,
  formatA = (n) => formatMoney(n, "USD", true),
  formatB = (n) => formatNumber(n),
  plain = false,
}: {
  title: string;
  points: SeriesPoint[];
  aLabel: string;
  bLabel?: string;
  formatA?: (n: number) => string;
  formatB?: (n: number) => string;
  /** Skip outer card chrome when nested in another panel. */
  plain?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const width = 720;
  const height = 280;
  const pad = { t: 16, r: bLabel ? 44 : 16, b: 34, l: 48 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const maxA = Math.max(...points.map((p) => p.a), 1);
  const maxB = Math.max(...points.map((p) => p.b ?? 0), 1);
  const ticksA = useMemo(() => niceTicks(maxA, 4), [maxA]);
  const scaleMaxA = Math.max(ticksA[ticksA.length - 1] ?? maxA, maxA);

  const xAt = useCallback(
    (i: number) =>
      pad.l +
      (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW),
    [innerW, pad.l, points.length],
  );
  const yA = useCallback(
    (v: number) => pad.t + innerH - (v / scaleMaxA) * innerH,
    [innerH, pad.t, scaleMaxA],
  );
  const yB = useCallback(
    (v: number) => pad.t + innerH - (v / maxB) * innerH,
    [innerH, maxB, pad.t],
  );

  const coordsA = points.map((p, i) => ({ x: xAt(i), y: yA(p.a) }));
  const coordsB = points.map((p, i) => ({ x: xAt(i), y: yB(p.b ?? 0) }));
  const pathA = smoothLine(coordsA);
  const hasB = Boolean(bLabel && points.some((p) => p.b != null));
  const pathB = hasB ? smoothLine(coordsB) : null;
  const areaA =
    pathA && coordsA.length
      ? `${pathA} L ${coordsA[coordsA.length - 1]!.x} ${pad.t + innerH} L ${coordsA[0]!.x} ${pad.t + innerH} Z`
      : "";

  // Skip an incomplete current calendar month when comparing trends.
  const currentMonthKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  let latestIdx = points.length - 1;
  if (
    latestIdx >= 0 &&
    points[latestIdx]?.periodKey === currentMonthKey &&
    latestIdx >= 1
  ) {
    latestIdx -= 1;
  }
  const latest = points[latestIdx];
  const prior = latestIdx >= 1 ? points[latestIdx - 1]! : null;
  const deltaA = latest && prior ? latest.a - prior.a : 0;
  const pctA =
    latest && prior && prior.a
      ? (deltaA / Math.abs(prior.a)) * 100
      : prior && prior.a === 0 && latest
        ? latest.a > 0
          ? 100
          : 0
        : 0;
  const hasDelta = Boolean(latest && prior);
  const activePoint = active != null ? points[active] : null;
  const activeXA = active != null ? xAt(active) : 0;
  const activeYA = active != null ? yA(points[active]!.a) : 0;
  const activeYB =
    active != null && points[active]?.b != null
      ? yB(points[active]!.b!)
      : null;

  function indexFromClientX(clientX: number) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const localX = ((clientX - rect.left) / rect.width) * width;
    if (points.length === 1) return 0;
    const t = (localX - pad.l) / innerW;
    return Math.max(0, Math.min(points.length - 1, Math.round(t * (points.length - 1))));
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    setActive(indexFromClientX(e.clientX));
  }

  if (points.length === 0) {
    return (
      <ChartShell title={title} plain={plain}>
        <p className="py-10 text-center text-sm text-mute">No data for this period.</p>
      </ChartShell>
    );
  }

  const tipLeftPct = (activeXA / width) * 100;
  const tipTopPct = (Math.min(activeYA, activeYB ?? activeYA) / height) * 100;

  return (
    <ChartShell
      title={title}
      plain={plain}
      meta={
        <div>
          <p className="font-display text-[1.85rem] leading-none tracking-wide text-ink sm:text-[2.1rem]">
            {formatA(latest!.a)}
          </p>
          {hasDelta ? (
            <p
              className={`mt-2 text-sm font-medium ${
                deltaA >= 0 ? "text-green" : "text-pink"
              }`}
            >
              {deltaA >= 0 ? "+" : ""}
              {formatA(deltaA)} ({pctA >= 0 ? "+" : ""}
              {pctA.toFixed(1)}%)
              <span className="font-normal text-mute">
                {" "}
                · vs {prior!.label}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-mute">{latest!.label}</p>
          )}
        </div>
      }
      legend={
        <>
          <LegendDot colorClass="bg-accent" label={aLabel} />
          {hasB ? <LegendDot colorClass="bg-purple" label={bLabel!} /> : null}
        </>
      }
    >
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full touch-pan-y select-none"
          role="img"
          aria-label={title}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          onPointerDown={onPointerMove}
        >
          <defs>
            <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.38" />
              <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <pattern
              id={`dots-${uid}`}
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="var(--line)" fillOpacity="0.55" />
            </pattern>
          </defs>

          <rect
            x={pad.l}
            y={pad.t}
            width={innerW}
            height={innerH}
            fill={`url(#dots-${uid})`}
          />

          {ticksA.map((tick) => {
            const y = yA(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad.l}
                  x2={width - pad.r}
                  y1={y}
                  y2={y}
                  stroke="var(--line)"
                  strokeOpacity="0.35"
                  strokeDasharray="2 6"
                />
                <text
                  x={pad.l - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--mute)"
                >
                  {formatA(tick)}
                </text>
              </g>
            );
          })}

          <path d={areaA} fill={`url(#area-${uid})`} />
          <path
            d={pathA}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pathB ? (
            <path
              d={pathB}
              fill="none"
              stroke="var(--purple)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.9"
            />
          ) : null}

          {points.map((p, i) => (
            <text
              key={p.label}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="var(--mute)"
            >
              {p.label}
            </text>
          ))}

          {active != null && activePoint ? (
            <g pointerEvents="none">
              <line
                x1={activeXA}
                x2={activeXA}
                y1={pad.t}
                y2={pad.t + innerH}
                stroke="var(--accent)"
                strokeOpacity="0.55"
                strokeWidth="1.25"
              />
              <circle
                cx={activeXA}
                cy={activeYA}
                r="7"
                fill="var(--panel)"
                stroke="var(--accent)"
                strokeWidth="2.5"
              />
              {activeYB != null ? (
                <circle
                  cx={activeXA}
                  cy={activeYB}
                  r="6"
                  fill="var(--panel)"
                  stroke="var(--purple)"
                  strokeWidth="2.25"
                />
              ) : null}
            </g>
          ) : null}

          {/* Wide hit targets per point for touch */}
          {points.map((p, i) => (
            <rect
              key={`hit-${p.label}`}
              x={xAt(i) - Math.max(18, innerW / points.length / 2)}
              y={pad.t}
              width={Math.max(36, innerW / points.length)}
              height={innerH}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
            />
          ))}
        </svg>

        {active != null && activePoint ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[10rem] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-line bg-panel px-3.5 py-2.5 text-left shadow-[0_14px_36px_-12px_var(--shadow-strong)]"
            style={{
              left: `${tipLeftPct}%`,
              top: `${Math.max(18, tipTopPct)}%`,
            }}
          >
            <p className="text-[11px] text-mute">{activePoint.label}</p>
            <p className="mt-1 text-[13px] font-semibold text-ink">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
              {aLabel}: {formatA(activePoint.a)}
            </p>
            {hasB && activePoint.b != null ? (
              <p className="mt-0.5 text-[13px] font-semibold text-ink">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-purple align-middle" />
                {bLabel}: {formatB(activePoint.b)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </ChartShell>
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
  const uid = useId().replace(/:/g, "");
  const max = Math.max(...points.map((p) => p.value), 1);
  const width = 560;
  const height = 220;
  const pad = { t: 16, r: 12, b: 34, l: 12 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const gap = 10;
  const barW =
    points.length > 0
      ? Math.min(42, (innerW - gap * (points.length - 1)) / points.length)
      : 24;

  const peak = points.reduce(
    (best, p) => (p.value >= best.value ? p : best),
    points[0] ?? { label: "", value: 0 },
  );

  if (points.length === 0) {
    return (
      <ChartShell title={title}>
        <p className="py-10 text-center text-sm text-mute">No data for this period.</p>
      </ChartShell>
    );
  }

  return (
    <ChartShell
      title={title}
      meta={
        <p className="font-display text-2xl leading-none tracking-wide text-ink">
          {formatValue(peak.value)}
          <span className="ml-2 align-baseline text-sm font-sans font-medium tracking-normal text-mute">
            · {peak.label}
          </span>
        </p>
      }
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id={`bar-${uid}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--accent-deep)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        {[0.33, 0.66, 1].map((t) => (
          <line
            key={t}
            x1={pad.l}
            x2={width - pad.r}
            y1={pad.t + innerH * (1 - t)}
            y2={pad.t + innerH * (1 - t)}
            stroke="var(--line)"
            strokeOpacity="0.55"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        ))}
        {points.map((p, i) => {
          const h = Math.max(4, (p.value / max) * innerH);
          const x =
            pad.l +
            i * (barW + gap) +
            Math.max(0, (innerW - points.length * barW - (points.length - 1) * gap) / 2);
          const y = pad.t + innerH - h;
          const hot = p.value === peak.value;
          return (
            <g key={p.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx="6"
                fill={hot ? "var(--gold)" : `url(#bar-${uid})`}
                opacity={hot ? 0.95 : 0.9}
              />
              <text
                x={x + barW / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="11"
                fill="var(--mute)"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartShell>
  );
}

export function DonutChart({
  title,
  segments,
  centerLabel,
  centerHint = "mix",
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerHint?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = 58;
  const stroke = 14;
  const c = 2 * Math.PI * radius;
  const gap = 4;
  let offset = 0;
  const top = [...segments].sort((a, b) => b.value - a.value)[0];
  const label =
    centerLabel ??
    (top ? `${Math.round((top.value / total) * 100)}%` : "—");

  return (
    <ChartShell title={title}>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <svg
          width="156"
          height="156"
          viewBox="0 0 156 156"
          className="shrink-0"
          role="img"
          aria-label={title}
        >
          <circle
            cx="78"
            cy="78"
            r={radius}
            fill="none"
            stroke="var(--ash)"
            strokeWidth={stroke}
          />
          <g transform="translate(78,78) rotate(-90)">
            {segments.map((seg) => {
              const len = Math.max(0, (seg.value / total) * c - gap);
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
                  strokeLinecap="round"
                />
              );
              offset += (seg.value / total) * c;
              return el;
            })}
          </g>
          <text
            x="78"
            y="74"
            textAnchor="middle"
            fill="var(--ink)"
            fontSize="18"
            fontWeight="700"
          >
            {label}
          </text>
          <text
            x="78"
            y="94"
            textAnchor="middle"
            fill="var(--mute)"
            fontSize="10"
          >
            {centerHint}
          </text>
        </svg>
        <ul className="w-full space-y-2.5 text-sm">
          {segments.map((seg) => (
            <li key={seg.label} className="flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[1px]"
                  style={{ background: seg.color }}
                />
                <span className="truncate text-ink">{seg.label}</span>
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-ink">
                {seg.value <= 100 ? `${seg.value}%` : formatNumber(seg.value, true)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartShell>
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
  const max = Math.max(...points.flatMap((p) => [p.a, p.b, p.c ?? 0]), 1);
  const groupW = points.length ? innerW / points.length : innerW;
  const barCount = cLabel ? 3 : 2;
  const barW = Math.min(16, (groupW * 0.68) / barCount);

  function bar(x: number, value: number, color: string, key: string) {
    const h = (value / max) * innerH;
    return (
      <rect
        key={key}
        x={x}
        y={pad.t + innerH - h}
        width={barW}
        height={Math.max(h, 2)}
        rx="3"
        fill={color}
      />
    );
  }

  return (
    <ChartShell
      title={title}
      legend={
        <>
          <LegendDot colorClass="bg-accent" label={aLabel} />
          <LegendDot colorClass="bg-pink" label={bLabel} />
          {cLabel ? <LegendDot colorClass="bg-gold" label={cLabel} /> : null}
        </>
      }
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad.l}
            x2={width - pad.r}
            y1={pad.t + innerH * (1 - t)}
            y2={pad.t + innerH * (1 - t)}
            stroke="var(--line)"
            strokeOpacity="0.55"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        ))}
        {points.map((p, i) => {
          const base = pad.l + i * groupW + groupW * 0.18;
          return (
            <g key={p.label}>
              {bar(base, p.a, "var(--accent)", `${p.label}-a`)}
              {bar(base + barW + 3, p.b, "var(--pink)", `${p.label}-b`)}
              {cLabel && p.c != null
                ? bar(base + (barW + 3) * 2, p.c, "var(--gold)", `${p.label}-c`)
                : null}
              <text
                x={pad.l + i * groupW + groupW / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
                fill="var(--mute)"
              >
                {p.label.length > 14 ? `${p.label.slice(0, 12)}…` : p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartShell>
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
      tone: "bg-accent",
    },
    {
      label: "Clicks",
      value: clicks,
      width: Math.max(22, Math.min(100, ctr * 8)),
      tone: "bg-purple",
      rate: `CTR ${ctr.toFixed(2)}%`,
    },
    {
      label: "Conversions",
      value: conversions,
      width: Math.max(14, Math.min(100, cvr * 10)),
      tone: "bg-pink",
      rate: `CVR ${cvr.toFixed(2)}%`,
    },
  ];

  return (
    <ChartShell title={title}>
      <div className="space-y-3.5">
        {steps.map((step) => (
          <div key={step.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{step.label}</span>
              <span className="tabular-nums text-mute">
                {formatNumber(step.value, true)}
                {step.rate ? ` · ${step.rate}` : ""}
              </span>
            </div>
            <div className="h-7 overflow-hidden rounded-sm bg-ash/80">
              <div
                className={`flex h-full items-center px-3 text-[11px] font-semibold text-white ${step.tone}`}
                style={{ width: `${Math.min(step.width, 100)}%` }}
              >
                {step.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ChartShell>
  );
}
