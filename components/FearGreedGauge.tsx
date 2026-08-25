"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HelpTip } from "./ui/HelpTip";

interface FearGreedData {
  score: number;
  rating: string;
  updatedAt: string;
}

interface FearGreedGaugeProps {
  className?: string;
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

const ZONES = [
  { label: "Extreme Fear", min: 0, max: 25, color: "#f43f5e" },
  { label: "Fear", min: 25, max: 45, color: "#f97316" },
  { label: "Neutral", min: 45, max: 55, color: "#eab308" },
  { label: "Greed", min: 55, max: 75, color: "#84cc16" },
  { label: "Extreme Greed", min: 75, max: 100, color: "#10b981" },
] as const;

function zoneForScore(score: number) {
  return (
    ZONES.find((z) => score >= z.min && score < z.max) ??
    ZONES[ZONES.length - 1]
  );
}

export default function FearGreedGauge({ className }: FearGreedGaugeProps) {
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

  // Geometry
  const cx = 100;
  const cy = 100;
  const radius = 78;
  const strokeWidth = 14;
  const trackRadius = radius;

  const score = data?.score ?? 50;
  const indicator = polarToCartesian(cx, cy, trackRadius, scoreToAngle(score));
  // Rest position (neutral / top of arc) for entrance animation
  const rest = polarToCartesian(cx, cy, trackRadius, 90);
  const zone = zoneForScore(score);
  const activeColor = zone.color;

  // Continuous colored segments with a tiny overlap so butt caps don't show hairlines
  const segments = useMemo(() => {
    const overlapDeg = 0.4;
    return ZONES.map((z, i) => {
      const startAngle = scoreToAngle(z.min) + (i === 0 ? 0 : overlapDeg);
      const endAngle =
        scoreToAngle(z.max) - (i === ZONES.length - 1 ? 0 : overlapDeg);
      return {
        ...z,
        path: describeArc(cx, cy, trackRadius, startAngle, endAngle),
      };
    });
  }, [trackRadius]);

  // Background full arc (track)
  const trackPath = describeArc(cx, cy, trackRadius, 180, 0);

  if (loading) {
    return (
      <div
        className={cn(
          "w-full min-h-[300px] bg-surface-card rounded-2xl animate-pulse flex items-center justify-center",
          className,
        )}
      >
        <span className="text-ink/20">Loading market sentiment...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={cn(
          "w-full min-h-[300px] bg-surface-card rounded-2xl flex flex-col items-center justify-center gap-2",
          className,
        )}
      >
        <span className="text-ink/40">Sentiment data unavailable</span>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full bg-stone-950 border border-hairline rounded-2xl p-8 flex flex-col items-center justify-between relative overflow-hidden group",
        className,
      )}
    >
      {/* Background Texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, #32302F 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Bottom Gradient Glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2/3 opacity-20 pointer-events-none transition-colors duration-500"
        style={{
          background: `linear-gradient(to top, ${activeColor}, transparent)`,
        }}
      />

      <div className="flex items-center gap-2 mb-2 z-10 w-full justify-center mt-2">
        <h3 className="text-ink/90 font-bold text-lg">
          <HelpTip term="Fear & Greed" showIcon className="text-ink/90 text-lg font-bold">
            Fear & Greed
          </HelpTip>
        </h3>
      </div>

      {/* Gauge Container */}
      <div className="relative w-full max-w-[280px] aspect-[2/1.1] z-10 flex justify-center mb-2">
        <svg
          viewBox="0 0 200 118"
          className="w-full h-full overflow-visible"
          aria-label={`Fear and Greed Index: ${score}, ${data.rating}`}
        >
          {/* Muted track underlay */}
          <path
            d={trackPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-stone-800"
          />

          {/* Colored zone segments use butt caps so they meet flush. */}
          {segments.map((seg) => (
            <path
              key={seg.label}
              d={seg.path}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              className="opacity-90"
            />
          ))}

          {/* Rounded end-caps so the arc tips stay pill-shaped */}
          <path
            d={describeArc(cx, cy, trackRadius, 180, 178)}
            fill="none"
            stroke={ZONES[0].color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={describeArc(cx, cy, trackRadius, 2, 0)}
            fill="none"
            stroke={ZONES[ZONES.length - 1].color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Tick marks at zone boundaries */}
          {ZONES.slice(1).map((z) => {
            const a = scoreToAngle(z.min);
            const outer = polarToCartesian(
              cx,
              cy,
              trackRadius + strokeWidth / 2 + 2,
              a,
            );
            const inner = polarToCartesian(
              cx,
              cy,
              trackRadius - strokeWidth / 2 - 2,
              a,
            );
            return (
              <line
                key={`tick-${z.min}`}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="#1c1917"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}

          {/* The arc knob leaves the score readable without a center needle. */}
          <motion.circle
            r={7}
            fill="#FFFFFF"
            stroke={activeColor}
            strokeWidth={2.5}
            initial={{ cx: rest.x, cy: rest.y, opacity: 0 }}
            animate={{ cx: indicator.x, cy: indicator.y, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 45,
              damping: 16,
              delay: 0.2,
            }}
            style={{
              filter: `drop-shadow(0 0 6px ${activeColor}88)`,
            }}
          />

          {/* Fear / Greed end labels */}
          <text
            x={20}
            y={114}
            textAnchor="middle"
            className="fill-stone-500 text-[8px] font-medium uppercase tracking-wide"
          >
            Fear
          </text>
          <text
            x={180}
            y={114}
            textAnchor="middle"
            className="fill-stone-500 text-[8px] font-medium uppercase tracking-wide"
          >
            Greed
          </text>
        </svg>

        {/* Score & rating sit inside the semicircle */}
        <div className="absolute left-0 right-0 top-[42%] flex flex-col items-center pointer-events-none">
          <motion.div
            className="text-5xl font-bold font-space text-ink tracking-tight leading-none drop-shadow-xl"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            {score}
          </motion.div>
          <motion.div
            className="text-sm font-semibold capitalize mt-1.5 transition-colors duration-300"
            style={{ color: activeColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.35 }}
          >
            {data.rating}
          </motion.div>
        </div>
      </div>

      <div className="text-xs font-mono text-ink/30 z-10">
        Updated: {new Date(data.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
