"use client";

import { useState } from "react";
import type { HistogramBin } from "@/lib/monte-carlo";
import { LOSS } from "@/lib/chart-colors";
import { signedPercent } from "./format";

const W = 1000;

interface OutcomeHistogramProps {
  bins: HistogramBin[];
  color: string;
  height?: number;
  compact?: boolean;
  label: string;
}

/** Ending return distribution. Bars below 0 use the loss colour; 0 is always a bar edge. */
export default function OutcomeHistogram({ bins, color, height = 220, compact = false, label }: OutcomeHistogramProps) {
  const [active, setActive] = useState<number | null>(null);
  if (bins.length === 0) return null;
  const H = height;
  const lo = bins[0].from;
  const hi = bins[bins.length - 1].to;
  const span = hi - lo || 1;
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const total = bins.reduce((s, b) => s + b.count, 0);
  const x = (v: number) => ((v - lo) / span) * W;
  const zeroInside = lo < 0 && hi > 0;
  const zeroLeft = (x(0) / W) * 100;
  const gap = Math.min(4, (W / bins.length) * 0.15);
  const tickEvery = Math.max(1, Math.ceil(bins.length / 6));
  const activeBin = active !== null ? bins[active] : null;

  return (
    <figure className="m-0" aria-label={label}>
      <div className="relative" style={{ height: H }} onPointerLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label={label}>
          {bins.map((b, i) => {
            const h = (b.count / maxCount) * (H - 20);
            return (
              <rect
                key={i}
                x={x(b.from) + gap / 2}
                y={H - h}
                width={Math.max(0.5, x(b.to) - x(b.from) - gap)}
                height={h}
                fill={b.loss ? LOSS : color}
                fillOpacity={active === null || active === i ? 0.9 : 0.5}
                rx={2}
                onPointerEnter={() => setActive(i)}
              />
            );
          })}
          {zeroInside && (
            <line x1={x(0)} x2={x(0)} y1="0" y2={H} stroke="var(--muted)" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {zeroInside && (
          <span className="pointer-events-none absolute top-0 pl-1.5 font-mono text-[11px] uppercase tracking-wide text-muted" style={{ left: `${zeroLeft}%` }}>
            Start
          </span>
        )}
        {activeBin && !compact && (
          <div className="ws-floating pointer-events-none absolute right-2 top-2 z-10 p-3 text-sm">
            <p className="text-ink">
              {activeBin.count.toLocaleString()} of {total.toLocaleString()} paths
            </p>
            <p className="text-muted">
              ended between {signedPercent(activeBin.from * 100, 0)} and {signedPercent(activeBin.to * 100, 0)}
            </p>
          </div>
        )}
      </div>
      {!compact && (
        <div className="relative mt-2 h-4" aria-hidden="true">
          {bins.map((b, i) => i % tickEvery === 0 && (
            <span key={i} className="absolute -translate-x-1/2 text-xs tabular-nums text-muted" style={{ left: `${(x(b.from) / W) * 100}%` }}>
              {signedPercent(b.from * 100, 0)}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
