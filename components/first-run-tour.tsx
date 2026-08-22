"use client";

import { useCallback, useEffect, useId, useState, type CSSProperties } from "react";
import { ColorStripe, InkamotoLogo } from "@/components/brand";
import { btnPrimary } from "@/components/modal";
import { useT } from "@/lib/i18n";
import {
  markTourSeen,
  tourSeen,
  tourSteps,
  TOUR_START_EVENT,
  type TourStep,
  type TourStepId,
} from "@/lib/onboarding";

type Hole = { top: number; left: number; width: number; height: number };

const ACCENT: Record<TourStepId, string> = {
  welcome: "#ecbb5a",
  overview: "#31595d",
  inbox: "#4a8a90",
  leads: "#624e8a",
  bookings: "#9f2627",
  invoices: "#d0ad74",
  newsletter: "#65814f",
  done: "#ecbb5a",
};

export function FirstRunTour({
  onNeedNav,
  onCloseNav,
}: {
  onNeedNav: () => void;
  onCloseNav: () => void;
}) {
  const t = useT();
  const maskId = `tour-cut-${useId().replace(/:/g, "")}`;
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const [vw, setVw] = useState(0);

  const step = tourSteps[index];
  const last = index === tourSteps.length - 1;
  const accent = ACCENT[step?.id ?? "welcome"];

  const measure = useCallback((current: TourStep) => {
    if (!current.target) {
      setHole(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-tour="${current.target}"]`,
    );
    if (!el) {
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setHole({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, []);

  useEffect(() => {
    setVw(window.innerWidth);
    const timer = window.setTimeout(() => {
      if (!tourSeen()) setActive(true);
    }, 450);
    const onStart = () => {
      setIndex(0);
      setActive(true);
    };
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(TOUR_START_EVENT, onStart);
    };
  }, []);

  useEffect(() => {
    if (!active || !step) return;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (step.target && !desktop) onNeedNav();
    if (!step.target) onCloseNav();
    const wait = step.target && !desktop ? 260 : 50;
    const id = window.setTimeout(() => measure(step), wait);
    return () => window.clearTimeout(id);
  }, [active, step, measure, onNeedNav, onCloseNav]);

  useEffect(() => {
    if (!active) return;
    const onWin = () => {
      setVw(window.innerWidth);
      measure(tourSteps[index]);
    };
    onWin();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [active, index, measure]);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        markTourSeen();
        setActive(false);
        setIndex(0);
        onCloseNav();
      }
      if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, tourSteps.length - 1));
      }
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [active, onCloseNav]);

  function finish() {
    markTourSeen();
    setActive(false);
    setIndex(0);
    onCloseNav();
  }

  function next() {
    if (last) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  }

  if (!active || !step || vw < 1) return null;

  const pad = 5;
  const desktop = vw >= 1024;
  const cardStyle = cardPosition(hole, Boolean(step.target), desktop, vw);
  const spotlight = hole
    ? {
        x: hole.left - pad,
        y: hole.top - pad,
        w: hole.width + pad * 2,
        h: hole.height + pad * 2,
      }
    : null;

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <svg className="tour-mask" width="100%" height="100%" aria-hidden>
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            {spotlight ? (
              <rect
                x={spotlight.x}
                y={spotlight.y}
                width={spotlight.w}
                height={spotlight.h}
                rx="3"
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(10, 9, 8, 0.78)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {spotlight ? (
        <div
          className="tour-glow"
          style={{
            top: spotlight.y,
            left: spotlight.x,
            width: spotlight.w,
            height: spotlight.h,
            borderColor: accent,
            boxShadow: `0 0 0 1px ${accent}, 0 0 28px ${accent}55`,
          }}
        />
      ) : null}

      {spotlight && desktop ? (
        <Connector hole={spotlight} card={cardStyle} color={accent} />
      ) : null}

      <div key={step.id} className="tour-card" style={cardStyle}>
        <ColorStripe />
        <div className="px-5 pb-5 pt-5 sm:px-6">
          {step.id === "welcome" || step.id === "done" ? (
            <div className="mb-4 flex items-center gap-3">
              <InkamotoLogo className="h-7 w-auto" />
              <span className="font-display text-[0.7rem] tracking-[0.2em] text-mute">
                {t("brand.crm")}
              </span>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-3">
              <span className="tour-badge" style={{ background: accent }}>
                {index}
              </span>
              <StepDots index={index} onJump={setIndex} />
            </div>
          )}

          <h2 id="tour-title" className="font-display text-[1.85rem] leading-none tracking-wide">
            {t(step.titleKey)}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-mute">{t(step.bodyKey)}</p>

          {step.id === "welcome" ? (
            <ol className="tour-path" aria-hidden>
              <li>{t("nav.inbox")}</li>
              <li>{t("nav.leads")}</li>
              <li>{t("nav.sales")}</li>
              <li>{t("nav.invoices")}</li>
            </ol>
          ) : null}

          {step.id === "welcome" || step.id === "done" ? (
            <div className="mt-4">
              <StepDots index={index} onJump={setIndex} />
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button type="button" className={btnPrimary} onClick={next}>
              {last ? t("tour.finish") : t("tour.next")}
            </button>
            {index > 0 ? (
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-[0.1em] text-sand hover:text-gold"
                onClick={() => setIndex((i) => i - 1)}
              >
                {t("tour.back")}
              </button>
            ) : null}
            {!last ? (
              <button
                type="button"
                className="ml-auto text-xs font-semibold uppercase tracking-[0.1em] text-mute hover:text-ink"
                onClick={finish}
              >
                {t("tour.skip")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDots({
  index,
  onJump,
}: {
  index: number;
  onJump: (i: number) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-1.5" role="tablist">
      {tourSteps.map((s, i) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-label={t("tour.stepOf", { current: i + 1, total: tourSteps.length })}
          className={`tour-dot ${i === index ? "tour-dot-on" : i < index ? "tour-dot-done" : ""}`}
          onClick={() => onJump(i)}
        />
      ))}
    </div>
  );
}

function Connector({
  hole,
  card,
  color,
}: {
  hole: { x: number; y: number; w: number; h: number };
  card: CSSProperties;
  color: string;
}) {
  const fromX = hole.x + hole.w + 2;
  const fromY = hole.y + hole.h / 2;
  const toX = typeof card.left === "number" ? card.left : fromX + 40;
  const toY =
    typeof card.top === "number" ? card.top + 56 : fromY;
  const mid = fromX + (toX - fromX) * 0.45;

  return (
    <svg className="tour-connector" aria-hidden>
      <path
        d={`M ${fromX} ${fromY} C ${mid} ${fromY}, ${mid} ${toY}, ${toX} ${toY}`}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeDasharray="5 7"
        strokeLinecap="round"
      />
      <circle cx={fromX} cy={fromY} r="3.2" fill={color} />
    </svg>
  );
}

function cardPosition(
  hole: Hole | null,
  hasTarget: boolean,
  desktop: boolean,
  vw: number,
): CSSProperties {
  const width = Math.min(desktop ? 400 : 360, vw - 24);
  if (!hasTarget) {
    return {
      left: (vw - width) / 2,
      top: Math.max(28, window.innerHeight / 2 - 190),
      width,
    };
  }
  if (!hole || !desktop) {
    return {
      left: (vw - width) / 2,
      bottom: 20,
      width,
    };
  }
  const left = Math.min(hole.left + hole.width + 44, vw - width - 20);
  const top = Math.min(Math.max(20, hole.top - 28), window.innerHeight - 320);
  return { top, left: Math.max(16, left), width };
}
