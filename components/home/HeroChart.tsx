"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { EASE } from "../motion/Reveal";

export interface HeroPoint {
  t: number | string;
  v: number;
}

interface HeroChartProps {
  points: HeroPoint[];
  positive?: boolean;
  height?: number;
  /** Formats a value for the tooltip and the screen reader summary. */
  formatValue?: (v: number) => string;
  /** Formats a point label (date). */
  formatLabel?: (t: number | string) => string;
  label?: string;
}

const PAD_Y = 28;
const PAD_X = 6;

function defaultLabel(t: number | string): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return String(t);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function HeroChart({
  points,
  positive,
  height = 190,
  formatValue = (v) => v.toLocaleString("en-CA", { maximumFractionDigits: 2 }),
  formatLabel = defaultLabel,
  label = "Price chart",
}: HeroChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  if (n < 2) {
    return (
      <div
        ref={wrapRef}
        style={{ height }}
        className="flex items-center justify-center text-xs text-muted"
        role="status"
      >
        Chart data unavailable
      </div>
    );
  }

  const first = points[0].v;
  const last = points[n - 1].v;
  const up = positive ?? last >= first;
  const color = up ? "var(--compass)" : "var(--loss)";

  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  min = Math.min(min, first);
  max = Math.max(max, first);
  const span = max - min || 1;
  const w = Math.max(width, 1);
  const x = (i: number) => PAD_X + (i / (n - 1)) * (w - PAD_X * 2);
  const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (height - PAD_Y * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)} ${height} L${x(0).toFixed(1)} ${height} Z`;
  const baseY = y(first);

  // Redraws the line left to right whenever the series itself changes
  const drawKey = `${n}-${first}-${last}-${min}-${max}`;
  const active = hover ?? n - 1;
  const ap = points[active];

  const setFromClientX = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (clientX - rect.left - PAD_X) / Math.max(rect.width - PAD_X * 2, 1);
    setHover(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  };

  const change = last - first;
  const pct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
  const summary = `${label}. Start ${formatValue(first)} on ${formatLabel(points[0].t)}, end ${formatValue(last)} on ${formatLabel(points[n - 1].t)}, change ${change >= 0 ? "+" : "-"}${formatValue(Math.abs(change))} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%).`;

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-compass rounded-lg"
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={summary}
      onPointerMove={(e) => setFromClientX(e.clientX)}
      onPointerDown={(e) => setFromClientX(e.clientX)}
      onPointerLeave={() => setHover(null)}
      onBlur={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setHover(Math.max(0, (hover ?? n - 1) - 1));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setHover(Math.min(n - 1, (hover ?? n - 1) + 1));
        } else if (e.key === "Home") {
          e.preventDefault();
          setHover(0);
        } else if (e.key === "End" || e.key === "Escape") {
          e.preventDefault();
          setHover(e.key === "End" ? n - 1 : null);
        }
      }}
    >
      <svg width={w} height={height} className="block overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.12" />
            <stop offset="70%" stopColor={color} stopOpacity="0" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          key={`area-${drawKey}`}
          d={area}
          fill={`url(#${gradId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7, ease: EASE }}
        />
        <line
          x1={PAD_X}
          x2={w - PAD_X}
          y1={baseY}
          y2={baseY}
          stroke="var(--ink)"
          strokeOpacity="0.2"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <motion.path
          key={`line-${drawKey}`}
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: EASE }}
        />
        {hover !== null && (
          <line x1={x(active)} x2={x(active)} y1={0} y2={height} stroke="var(--ink)" strokeOpacity="0.3" strokeWidth="1" />
        )}
        <motion.g
          key={`dot-${drawKey}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: hover === null ? 0.8 : 0 }}
        >
          {hover !== null && <circle cx={x(active)} cy={y(ap.v)} r="5" fill="var(--panel)" />}
          <circle cx={x(active)} cy={y(ap.v)} r="3" fill={color} />
        </motion.g>
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md bg-[var(--panel)] px-2 py-0.5 text-xs leading-4 ring-1 ring-hairline whitespace-nowrap"
          style={{ left: Math.max(64, Math.min(w - 64, x(active))) }}
        >
          <span className="font-bold text-ink tabular-nums">{formatValue(ap.v)}</span>
          <span className="ml-2 text-muted">{formatLabel(ap.t)}</span>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {hover !== null ? `${formatValue(ap.v)} on ${formatLabel(ap.t)}` : ""}
      </span>
    </div>
  );
}
