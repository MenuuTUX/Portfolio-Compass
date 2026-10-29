"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// A small SVG line chart for Compass Lab results. Series share the x axis
// (`dates`); NaN values break the line. Distinct series are told apart by
// dash pattern and a direct label, not by color.

export interface ChartSeries {
  label: string;
  values: ArrayLike<number>;
  dash?: string;
  tone?: "ink" | "muted" | "loss";
  /** Fill between the line and zero (drawdown charts). */
  area?: boolean;
}

interface LabChartProps {
  dates: string[];
  series: ChartSeries[];
  format: (v: number) => string;
  log?: boolean;
  height?: number;
  /** Text summary for screen readers. */
  summary: string;
}

const PAD = { top: 12, right: 64, bottom: 22, left: 8 };
const STROKE = { ink: "var(--ink)", muted: "var(--muted)", loss: "var(--loss)" };

export default function LabChart({ dates, series, format, log = false, height = 280, summary }: LabChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const T = dates.length;
  const tf = (v: number) => (log ? Math.log(v) : v);

  const { min, max } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) {
      for (let i = 0; i < s.values.length; i++) {
        const v = s.values[i];
        if (!Number.isFinite(v) || (log && v <= 0)) continue;
        lo = Math.min(lo, tf(v));
        hi = Math.max(hi, tf(v));
      }
      if (s.area) {
        lo = Math.min(lo, 0);
        hi = Math.max(hi, 0);
      }
    }
    if (!Number.isFinite(lo)) return { min: 0, max: 1 };
    if (lo === hi) return { min: lo - 1, max: hi + 1 };
    const pad = (hi - lo) * 0.04;
    // An underwater chart tops out at exactly 0%.
    const capAtZero = series.some((s) => s.area) && hi === 0;
    return { min: lo - pad, max: capAtZero ? 0 : hi + pad };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tf depends only on log
  }, [series, log]);

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (T <= 1 ? 0 : (i / (T - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (tf(v) - min) / (max - min)) * innerH;

  // At most about two points per pixel keeps long histories cheap to draw.
  const step = Math.max(1, Math.floor(T / (innerW * 2)));
  const paths = series.map((s) => {
    let d = "";
    let pen = false;
    for (let i = 0; i < T; i += step) {
      const v = s.values[i];
      if (!Number.isFinite(v) || (log && v <= 0)) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    const area = s.area && d ? `${d}L${x(T - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z` : null;
    return { d, area };
  });

  const ticks = useMemo(() => {
    if (T < 2) return [];
    const years = Number(dates[T - 1].slice(0, 4)) - Number(dates[0].slice(0, 4));
    const every = years > 12 ? 4 : years > 6 ? 2 : 1;
    const out: { i: number; label: string }[] = [];
    let last = "";
    dates.forEach((d, i) => {
      const yr = d.slice(0, 4);
      if (yr !== last && i > 0 && Number(yr) % every === 0) out.push({ i, label: yr });
      last = yr;
    });
    return out.length ? out : [{ i: 0, label: dates[0].slice(0, 7) }];
  }, [dates, T]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left - PAD.left) / innerW;
    setHover(Math.max(0, Math.min(T - 1, Math.round(rel * (T - 1)))));
  };

  return (
    <div ref={box} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="block touch-none"
      >
        {[0, 0.5, 1].map((f) => {
          const v = min + f * (max - min);
          const yy = PAD.top + (1 - f) * innerH;
          return (
            <g key={f}>
              <line x1={PAD.left} x2={PAD.left + innerW} y1={yy} y2={yy} stroke="var(--hairline)" />
              <text x={PAD.left + innerW + 6} y={yy + 4} fontSize="11" fill="var(--muted)">
                {format(log ? Math.exp(v) : v)}
              </text>
            </g>
          );
        })}
        {ticks.map((t) => (
          <text key={t.i} x={x(t.i)} y={height - 6} fontSize="11" fill="var(--muted)" textAnchor="middle">
            {t.label}
          </text>
        ))}
        {series.map((s, k) => (
          <g key={s.label}>
            {paths[k].area && <path d={paths[k].area!} fill={STROKE[s.tone ?? "ink"]} opacity={0.12} />}
            <path
              d={paths[k].d}
              fill="none"
              stroke={STROKE[s.tone ?? "ink"]}
              strokeWidth={k === 0 ? 1.75 : 1.25}
              strokeDasharray={s.dash}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--hairline-strong)" />
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
        {hover !== null && <span className="font-mono text-body-strong">{dates[hover]}</span>}
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" x2="18" y1="3" y2="3" stroke={STROKE[s.tone ?? "ink"]} strokeWidth="2" strokeDasharray={s.dash} />
            </svg>
            {s.label}
            {hover !== null && Number.isFinite(s.values[hover]) && (
              <span className="font-mono text-body-strong">{format(s.values[hover])}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
