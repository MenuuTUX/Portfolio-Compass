"use client";

import { useState, useEffect } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { EASE } from "./motion/Reveal";
import { cn } from "@/lib/utils";
import { HelpTip } from "./ui/HelpTip";

interface FearGreedData {
  score: number;
  rating: string;
  updatedAt: string;
}

interface FearGreedGaugeProps {
  className?: string;
  /** Panel-friendly form: no card chrome, tighter spacing, smaller dial. */
  compact?: boolean;
}

interface Point {
  x: number;
  y: number;
}

/** Map a score from 0 to 100 onto a semicircle angle in degrees.
 *  0   → 180° (left, extreme fear)
 *  50  →  90° (top, neutral)
 *  100 →   0° (right, extreme greed)
 *  SVG polar: 0° = east, increases counterclockwise.
 */
function scoreToAngle(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return 180 - (clamped / 100) * 180;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad), // SVG y grows downward
  };
}

/** SVG arc path between two angles on the semicircle. */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  // Sweep flag 1 = clockwise in SVG when angles decrease left→right on our semicircle
  // Our angles go 180→0 left to right; we draw decreasing angle = clockwise
  const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  const sweep = startAngle > endAngle ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

/** Fear (red) through neutral (amber) to greed (green), shared with the watchlist mini bar. */
export const FEAR_GREED_GRADIENT = ["#ed4f3c", "#e8a93a", "#6dc382"] as const;

export default function FearGreedGauge({ className, compact = false }: FearGreedGaugeProps) {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/market/fear-greed");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Dial and number sweep up from 0 to the score
  const target = data?.score ?? null;
  const [shown, setShown] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (target === null) return;
    if (reduce) {
      setShown(target);
      return;
    }
    const controls = animate(0, target, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [target, reduce]);

  // Geometry
  const cx = 100;
  const cy = 100;
  const radius = 78;
  const strokeWidth = 14;
  const trackRadius = radius;

  const score = data?.score ?? 50;
  const indicator = polarToCartesian(cx, cy, trackRadius, scoreToAngle(shown));

  const valuePath = describeArc(cx, cy, trackRadius, 180, scoreToAngle(shown));

  // Background full arc (track)
  const trackPath = describeArc(cx, cy, trackRadius, 180, 0);

  if (loading) {
    return (
      <div
        className={cn(
          "w-full min-h-[300px] bg-surface-card ring-1 ring-hairline rounded-2xl flex items-center justify-center",
          className,
        )}
      >
        <span className="text-sm text-muted">Loading market sentiment...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={cn(
          "w-full min-h-[300px] bg-surface-card ring-1 ring-hairline rounded-2xl flex flex-col items-center justify-center gap-2",
          className,
        )}
      >
        <span className="text-sm text-muted">Sentiment data unavailable</span>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-compass hover:underline min-h-[44px] md:min-h-0 px-3"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full flex flex-col items-center",
        compact ? "p-3" : "bg-surface-card ring-1 ring-hairline rounded-2xl p-6",
        className,
      )}
    >
      <div className={cn("w-full", compact ? "mb-1" : "mb-2")}>
        <h3 className={cn("font-semibold text-ink", compact ? "text-sm" : "text-base")}>
          <HelpTip term="Fear & Greed" showIcon className={cn("text-ink font-semibold", compact ? "text-sm" : "text-base")}>
            Fear & Greed
          </HelpTip>
        </h3>
        <p className="text-xs text-muted">Market sentiment, 0 to 100</p>
      </div>

      <div className={cn("relative w-full aspect-[2/1.1] flex justify-center mb-2", compact ? "max-w-[200px]" : "max-w-[280px]")}>
        <svg
          viewBox="0 0 200 118"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`Fear and Greed Index: ${score}, ${data.rating}`}
        >
          <defs>
            {/* Spans the arc's x extent so each position keeps its colour as the dial fills */}
            <linearGradient
              id="fear-greed-scale"
              gradientUnits="userSpaceOnUse"
              x1={cx - trackRadius}
              x2={cx + trackRadius}
              y1={0}
              y2={0}
            >
              <stop offset="0%" stopColor={FEAR_GREED_GRADIENT[0]} />
              <stop offset="50%" stopColor={FEAR_GREED_GRADIENT[1]} />
              <stop offset="100%" stopColor={FEAR_GREED_GRADIENT[2]} />
            </linearGradient>
          </defs>
          <path
            d={trackPath}
            fill="none"
            stroke="url(#fear-greed-scale)"
            strokeOpacity={0.3}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {shown > 0.5 && (
            <path
              d={valuePath}
              fill="none"
              stroke="url(#fear-greed-scale)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )}
          <circle
            cx={indicator.x}
            cy={indicator.y}
            r={7}
            fill="#FFFFFF"
            stroke="#0D0D0D"
            strokeWidth={2}
          />
          <text x={20} y={114} textAnchor="middle" className="fill-muted text-xs font-medium" fontSize={12}>
            Fear
          </text>
          <text x={180} y={114} textAnchor="middle" className="fill-muted text-xs font-medium" fontSize={12}>
            Greed
          </text>
        </svg>

        <div className="absolute left-0 right-0 top-[42%] flex flex-col items-center pointer-events-none">
          <div className={cn("font-bold text-ink leading-none tabular-nums", compact ? "text-2xl" : "text-[32px]")}>{Math.round(shown)}</div>
          <div className="text-sm font-semibold capitalize mt-1.5 text-body-strong">
            {data.rating}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted">
        Updated: {new Date(data.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
