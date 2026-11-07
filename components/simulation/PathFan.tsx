"use client";

import { useId, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { compactMoney } from "@/lib/format";
import type { FanBand } from "@/lib/monte-carlo-run";
import { valueTicks, yearTicks } from "./format";

const W = 1000;
const MAX_POINTS = 160;

interface PathFanProps {
  /** Values per path at each of `days`. */
  paths: number[][];
  days: number[];
  /** Trading days per axis year (252, or the sample length for Reshuffle). */
  daysPerYear: number;
  years: number;
  start: number;
  color: string;
  colorAlt: string;
  /** Path drawn in white on top, such as the historical order or the median ending. */
  highlight?: number[];
  highlightLabel?: string;
  band?: FanBand;
  showBand?: boolean;
  currency?: string;
  height?: number;
  /** Small-multiple mode: no axis labels, no tooltip. */
  compact?: boolean;
  label: string;
}

/** Round log-axis ticks at 1, 2 and 5 times each power of ten inside [lo, hi]. */
function logValueTicks(lo: number, hi: number): number[] {
  const all: { v: number; m: number }[] = [];
  for (let p = Math.floor(Math.log10(lo)); p <= Math.ceil(Math.log10(hi)); p++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** p;
      if (v >= lo && v <= hi) all.push({ v, m });
    }
  }
  const dense = all.length > 6 ? all.filter((t) => t.m === 1) : all;
  return dense.map((t) => t.v);
}

/** Keeps at most MAX_POINTS evenly spaced indices, always including the last. */
function sampleIndices(length: number): number[] {
  const stride = Math.max(1, Math.ceil(length / MAX_POINTS));
  const out: number[] = [];
  for (let i = 0; i < length; i += stride) out.push(i);
  if (out[out.length - 1] !== length - 1) out.push(length - 1);
  return out;
}

export default function PathFan({
  paths, days, daysPerYear, years, start, color, colorAlt, highlight, highlightLabel,
  band, showBand = false, currency, height = 320, compact = false, label,
}: PathFanProps) {
  const clipId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [logScale, setLogScale] = useState(false);
  const H = height;
  const xMax = years * daysPerYear;

  // The log axis needs every plotted value above 0; otherwise the toggle is disabled.
  const { yMin, yMax, canLog } = useMemo(() => {
    let lo = start;
    let hi = start;
    const scan = (arr: number[]) => {
      for (const v of arr) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    };
    paths.forEach(scan);
    if (highlight) scan(highlight);
    if (band && showBand) {
      scan(band.p10);
      scan(band.p90);
    }
    const canLog = lo > 0;
    if (logScale && canLog) {
      const a = Math.log(lo);
      const b = Math.log(hi);
      const pad = (b - a) * 0.06 || 0.05;
      return { yMin: a - pad, yMax: b + pad, canLog };
    }
    const pad = (hi - lo) * 0.06 || start * 0.05;
    return { yMin: Math.max(0, lo - pad), yMax: hi + pad, canLog };
  }, [paths, highlight, band, showBand, start, logScale]);

  const log = logScale && canLog;
  const scaled = (v: number) => (log ? Math.log(v) : v);
  const x = (day: number) => (day / xMax) * W;
  const y = (v: number) => H - ((scaled(v) - yMin) / (yMax - yMin)) * H;

  const idx = useMemo(() => sampleIndices(days.length), [days.length]);
  const toD = (values: number[]) =>
    idx.map((i, k) => `${k === 0 ? "M" : "L"}${x(days[i]).toFixed(1)},${y(values[i]).toFixed(1)}`).join("");

  const pathDs = useMemo(() => paths.map(toD),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paths, idx, yMin, yMax, xMax, H, log]);

  const bandD = useMemo(() => {
    if (!band || !showBand) return null;
    const top = band.days.map((d, i) => `${i === 0 ? "M" : "L"}${x(d).toFixed(1)},${y(band.p90[i]).toFixed(1)}`).join("");
    const bottom = band.days.map((_, j) => {
      const i = band.days.length - 1 - j;
      return `L${x(band.days[i]).toFixed(1)},${y(band.p10[i]).toFixed(1)}`;
    }).join("");
    return `${top}${bottom}Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band, showBand, yMin, yMax, xMax, H, log]);

  const startY = y(start);
  const yTicks = compact ? [] : log
    ? logValueTicks(Math.exp(yMin), Math.exp(yMax))
    : valueTicks(yMin, yMax, 4);
  const hoverPoint = hover !== null && band ? {
    year: band.days[hover] / daysPerYear,
    p10: band.p10[hover], p50: band.p50[hover], p90: band.p90[hover],
    left: (x(band.days[hover]) / W) * 100,
  } : null;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (compact || !band) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const day = ((e.clientX - rect.left) / rect.width) * xMax;
    let best = 0;
    for (let i = 1; i < band.days.length; i++) {
      if (Math.abs(band.days[i] - day) < Math.abs(band.days[best] - day)) best = i;
    }
    setHover(best);
  };

  return (
    <figure className="m-0" aria-label={label}>
      {!compact && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={log}
              disabled={!canLog}
              aria-describedby={canLog ? undefined : `${clipId}-log-hint`}
              onChange={(e) => setLogScale(e.target.checked)}
            />
            Log scale
          </label>
          {!canLog && (
            <span id={`${clipId}-log-hint`} className="text-xs">Needs every value above 0</span>
          )}
        </div>
      )}
      <div className={compact ? "" : "grid grid-cols-[3.5rem_1fr] gap-x-2"}>
        {!compact && (
          <div className="relative" style={{ height: H }} aria-hidden="true">
            {yTicks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2 text-xs tabular-nums text-muted" style={{ top: y(t) }}>
                {compactMoney(t, currency)}
              </span>
            ))}
          </div>
        )}
        <div
          className="relative"
          style={{ height: H }}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            role="img"
            aria-label={label}
          >
            <defs>
              <clipPath id={clipId}>
                <rect className="mc-reveal" x="0" y={-H} width={W} height={H * 3} />
              </clipPath>
            </defs>
            {yTicks.map((t) => (
              <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="var(--hairline)" vectorEffect="non-scaling-stroke" />
            ))}
            {bandD && <path d={bandD} fill={color} fillOpacity={0.12} stroke="none" />}
            <g clipPath={`url(#${clipId})`} fill="none" strokeLinejoin="round">
              {pathDs.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  stroke={`color-mix(in oklab, ${color} ${100 - ((i * 37) % 100)}%, ${colorAlt})`}
                  strokeOpacity={paths.length > 60 ? 0.35 : 0.55}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {highlight && (
                <path d={toD(highlight)} stroke="var(--ink)" strokeWidth={compact ? 1.75 : 2.25} vectorEffect="non-scaling-stroke" />
              )}
            </g>
            <line x1="0" x2={W} y1={startY} y2={startY} stroke="var(--muted)" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
            {hoverPoint && (
              <line x1={x(band!.days[hover!])} x2={x(band!.days[hover!])} y1="0" y2={H} stroke="var(--hairline-strong)" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          <span
            className="pointer-events-none absolute right-0 -translate-y-full pb-0.5 font-mono text-[11px] uppercase tracking-wide text-muted"
            style={{ top: startY }}
          >
            Start
          </span>
          {hoverPoint && (
            <div
              className="ws-floating pointer-events-none absolute top-2 z-10 min-w-44 p-3 text-sm"
              style={hoverPoint.left > 55 ? { right: `${100 - hoverPoint.left + 2}%` } : { left: `${hoverPoint.left + 2}%` }}
            >
              <p className="mb-2 font-medium text-ink">Year {hoverPoint.year.toFixed(1)}</p>
              <p className="flex justify-between gap-6 text-muted">1 in 10 above <span className="tabular-nums text-ink">{formatCurrency(hoverPoint.p90, currency)}</span></p>
              <p className="flex justify-between gap-6 text-muted">Typical <span className="tabular-nums text-ink">{formatCurrency(hoverPoint.p50, currency)}</span></p>
              <p className="flex justify-between gap-6 text-muted">1 in 10 below <span className="tabular-nums text-ink">{formatCurrency(hoverPoint.p10, currency)}</span></p>
            </div>
          )}
        </div>
        {!compact && (
          <div className="relative col-start-2 mt-2 h-4" aria-hidden="true">
            {yearTicks(years).map((yr) => (
              <span key={yr} className="absolute -translate-x-1/2 text-xs text-muted first:translate-x-0" style={{ left: `${(yr / years) * 100}%` }}>
                {yr}y
              </span>
            ))}
          </div>
        )}
      </div>
      {!compact && highlightLabel && (
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-body">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 rounded bg-ink" aria-hidden="true" /> {highlightLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 rounded" style={{ background: color }} aria-hidden="true" /> Simulated paths
          </span>
          {showBand && band && (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-5 rounded-sm" style={{ background: color, opacity: 0.25 }} aria-hidden="true" /> Where 8 in 10 paths were
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <span className="w-5 border-t border-dashed border-muted" aria-hidden="true" /> Starting amount
          </span>
        </figcaption>
      )}
    </figure>
  );
}
