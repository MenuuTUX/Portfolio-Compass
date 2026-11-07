"use client";

import { useCallback, useId, useRef, useState } from "react";
import { m as motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart as LineChartIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/utils";
import { RANGE_META, TIME_RANGES, type AssetChartState } from "./useAssetChart";
import type { ChartRange } from "@/lib/fast-market";
import { GAIN, LOSS, MUTED } from "@/lib/chart-colors";


interface AssetChartProps {
  chart: AssetChartState;
  ticker: string;
  currency?: string;
  kind?: "area" | "line" | "candles";
  /** Fixed height class for sheet use; defaults to filling the parent. */
  className?: string;
  /** Adds price/date axes, high/low markers and drag-to-measure. Off for compact charts. */
  advanced?: boolean;
  /** Overlays a moving average of the price (area/line only). */
  showAverage?: boolean;
}

const AXIS_DATE: Record<ChartRange, (d: Date) => string> = {
  "1D": (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  "1W": (d) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
  "1M": (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  "1Y": (d) => `${d.toLocaleDateString(undefined, { month: "short" })} '${String(d.getFullYear()).slice(2)}`,
  "5Y": (d) => String(d.getFullYear()),
  MAX: (d) => String(d.getFullYear()),
};

function formatAxisDate(date: string, range: ChartRange) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : AXIS_DATE[range](d);
}

function niceTicks(min: number, max: number, count = 4) {
  const raw = (max - min || 1) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6 && ticks.length < 12; v += step) {
    ticks.push(v);
  }
  return { ticks, step };
}

function formatTag(date: string, range: ChartRange) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const { intraday } = RANGE_META[range];
  const day = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: intraday ? undefined : "numeric",
  });
  if (intraday) {
    return `${day}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return day;
}

const PAD_TOP = 26;
const PAD_BOTTOM = 4;
// Room for the date axis plus the low marker's label
const PAD_BOTTOM_ADVANCED = 34;

function linePath(
  values: (number | null | undefined)[],
  x: (i: number) => number,
  y: (v: number) => number,
) {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v == null || Number.isNaN(v)) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

/** Edge-to-edge price chart: sharp 1.5px polyline, soft fill, no grid or axes. */
export function AssetChart({
  chart,
  ticker,
  currency,
  kind = "area",
  className,
  advanced = false,
  showAverage = false,
}: AssetChartProps) {
  const gradientId = `fill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const reduce = useReducedMotion();
  const drawRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);
  // Index where a mouse drag started; hover then marks the other end of the measured span
  const [anchor, setAnchor] = useState<number | null>(null);
  const { data, loading, compare, range } = chart;
  // Candles need OHLC bars and can't be percent-normalised against SPY
  const showCandles = kind === "candles" && !compare && chart.candles.length > 0;
  const n = data.length;

  // Callback ref: re-observes whenever the plot element is (re)mounted, e.g. when
  // the remount key changes with the chart style
  const roRef = useRef<ResizeObserver | null>(null);
  const setPlotEl = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    plotRef.current = el;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    roRef.current = new ResizeObserver(measure);
    roRef.current.observe(el);
    measure();
  }, []);

  const isUp = n > 1 ? data[n - 1].price >= data[0].price : chart.isPositive;
  const color = isUp ? GAIN : LOSS;

  if (n === 0) {
    return (
      <div className={cn("h-full w-full min-h-48", className)}>
        {loading ? (
          <div
            className="h-full flex flex-col justify-end gap-2 px-4 pb-4"
            role="status"
            aria-label="Loading chart"
          >
            <Skeleton className="h-1/2 w-full" />
            <p className="sr-only">Loading chart…</p>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-4">
            <LineChartIcon className="w-6 h-6 text-muted-soft" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">No price history available</p>
            <p className="text-xs text-muted max-w-xs">
              We couldn&apos;t load chart data for this asset. It may be thinly
              traded, recently listed, or the data sync failed.
            </p>
            <button
              type="button"
              onClick={chart.retry}
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-surface-soft hover:bg-hairline-strong transition-colors duration-75 px-4 min-h-9 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-compass"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  const { w, h } = size;
  const first = data[0].price;
  let min = first;
  let max = first;
  for (const p of data) {
    if (p.price < min) min = p.price;
    if (p.price > max) max = p.price;
    if (compare && p.spyPrice != null) {
      if (p.spyPrice < min) min = p.spyPrice;
      if (p.spyPrice > max) max = p.spyPrice;
    }
  }
  const span = max - min || 1;
  const padBottom = advanced ? PAD_BOTTOM_ADVANCED : PAD_BOTTOM;
  const plotH = Math.max(h - PAD_TOP - padBottom, 1);
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * w : w / 2);
  const y = (v: number) => PAD_TOP + (1 - (v - min) / span) * plotH;

  const cn_ = chart.candles.length;
  let cMin = Infinity;
  let cMax = -Infinity;
  if (showCandles) {
    for (const c of chart.candles) {
      if (c.low < cMin) cMin = c.low;
      if (c.high > cMax) cMax = c.high;
    }
  }
  const cSpan = cMax - cMin || 1;
  const slot = w / Math.max(cn_, 1);
  const bodyW = Math.max(Math.min(slot * 0.7, 14), 1);
  const cx_ = (i: number) => slot * (i + 0.5);
  const yC = (v: number) => PAD_TOP + (1 - (v - cMin) / cSpan) * plotH;

  const line = linePath(data.map((p) => p.price), x, y);
  const spyLine = compare ? linePath(data.map((p) => p.spyPrice), x, y) : "";
  const area = n > 1 && !showCandles ? `${line} L${x(n - 1).toFixed(1)} ${h} L${x(0).toFixed(1)} ${h} Z` : "";
  const baseY = y(first);
  const m = showCandles ? cn_ : n;
  const active = Math.min(hover ?? m - 1, m - 1);
  const ap = showCandles
    ? { date: chart.candles[active].date, price: chart.candles[active].close, spyPrice: null }
    : data[active];
  const ax = showCandles ? cx_(active) : x(active);
  const ay = showCandles ? yC(ap.price) : y(ap.price);
  const bar = showCandles ? chart.candles[active] : null;

  const indexAt = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || m < 2) return null;
    const ratio = (clientX - rect.left) / Math.max(rect.width, 1);
    return Math.max(0, Math.min(m - 1, Math.round(ratio * (m - 1))));
  };
  const setFromClientX = (clientX: number) => {
    const i = indexAt(clientX);
    if (i !== null) setHover(i);
  };

  const valueAt = (i: number) => (showCandles ? chart.candles[i].close : data[i].price);
  const dateAt = (i: number) => (showCandles ? chart.candles[i].date : data[i].date);
  const px = (i: number) => (showCandles ? cx_(i) : x(i));
  const sMin = showCandles ? cMin : min;
  const sMax = showCandles ? cMax : max;
  const yS = showCandles ? yC : y;
  const fmtAxis = (v: number, step: number) =>
    compare
      ? `${v.toFixed(step >= 1 ? 0 : 1)}%`
      : v.toLocaleString(undefined, {
          minimumFractionDigits: step >= 1 ? 0 : step >= 0.1 ? 1 : 2,
          maximumFractionDigits: step >= 1 ? 0 : step >= 0.1 ? 1 : 2,
        });

  const { ticks: yTicks, step: yStep } = advanced && w > 0 ? niceTicks(sMin, sMax) : { ticks: [], step: 1 };
  const xCount = w < 420 ? 3 : 5;
  const xTicks =
    advanced && m > 1
      ? Array.from({ length: xCount }, (_, k) => Math.round((k * (m - 1)) / (xCount - 1)))
      : [];
  let hiIdx = 0;
  let loIdx = 0;
  let hiVal = -Infinity;
  let loVal = Infinity;
  if (advanced) {
    for (let i = 0; i < m; i++) {
      const hi = showCandles ? chart.candles[i].high : data[i].price;
      const lo = showCandles ? chart.candles[i].low : data[i].price;
      if (hi > hiVal) {
        hiVal = hi;
        hiIdx = i;
      }
      if (lo < loVal) {
        loVal = lo;
        loIdx = i;
      }
    }
  }
  const avgWindow = Math.max(3, Math.min(50, Math.round(n / 6)));
  const avgOn = advanced && showAverage && !compare && !showCandles && n > avgWindow;
  let avgLine = "";
  if (avgOn) {
    let sum = 0;
    const avg = data.map((p, i) => {
      sum += p.price;
      if (i >= avgWindow) sum -= data[i - avgWindow].price;
      return i >= avgWindow - 1 ? sum / avgWindow : null;
    });
    avgLine = linePath(avg, x, y);
  }

  const measuring = advanced && anchor !== null && hover !== null && hover !== anchor && anchor < m;
  const mFrom = measuring ? Math.min(anchor, hover) : 0;
  const mTo = measuring ? Math.max(anchor, hover) : 0;
  const mDelta = measuring ? valueAt(mTo) - valueAt(mFrom) : 0;
  const mPct = measuring && valueAt(mFrom) !== 0 ? (mDelta / Math.abs(valueAt(mFrom))) * 100 : 0;
  const signed = (v: number, digits = 2) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
  const mColor = mDelta >= 0 ? GAIN : LOSS;
  const hoverPct = !compare && !bar && first !== 0 ? ((ap.price - first) / first) * 100 : null;
  const labelAnchor = (px_: number) => (px_ < 44 ? "start" : px_ > w - 44 ? "end" : "middle");

  const tagShift = w > 0 ? (ax / w) * 100 : 50;

  // New data (asset or range change) remounts the plot so the line redraws
  const drawKey = `${ticker}|${range}|${kind}|${n}|${data[0].date}|${data[n - 1].date}`;

  return (
    <div
      className={cn(
        "h-full w-full min-h-48 transition-opacity duration-75",
        loading ? "opacity-60" : "opacity-100",
        className,
      )}
    >
      <motion.div
        key={drawKey}
        ref={drawRef}
        className="h-full w-full"
        initial={reduce ? false : { clipPath: "inset(-8px 100% -8px 0px)" }}
        animate={{ clipPath: "inset(-8px -8px -8px 0px)" }}
        transition={{ duration: 0.9, ease: EASE }}
        onAnimationComplete={() => {
          // Release the clip so the hover tag is never cut off
          if (drawRef.current) drawRef.current.style.clipPath = "none";
        }}
      >
        <div
          ref={setPlotEl}
          className="relative h-full w-full select-none touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-compass rounded-lg"
          tabIndex={0}
          role="group"
          aria-label={`${ticker} price chart. Use arrow keys to inspect values.`}
          onPointerMove={(e) => setFromClientX(e.clientX)}
          onPointerDown={(e) => {
            // Touch keeps plain scrubbing; only a mouse drag measures a span
            if (advanced && e.pointerType === "mouse") setAnchor(indexAt(e.clientX));
            setFromClientX(e.clientX);
          }}
          onPointerUp={() => setAnchor(null)}
          onPointerCancel={() => setAnchor(null)}
          onPointerLeave={() => {
            setHover(null);
            setAnchor(null);
          }}
          onBlur={() => {
            setHover(null);
            setAnchor(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setHover(Math.max(0, (hover ?? m - 1) - 1));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              setHover(Math.min(m - 1, (hover ?? m - 1) + 1));
            } else if (e.key === "Home") {
              e.preventDefault();
              setHover(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setHover(m - 1);
            } else if (e.key === "Escape") {
              setHover(null);
            }
          }}
        >
          {w > 0 && h > 0 && (
            <svg width={w} height={h} className="block overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <motion.stop
                    offset="0%"
                    stopColor={color}
                    initial={reduce ? false : { stopOpacity: 0 }}
                    animate={{ stopOpacity: 0.12 }}
                    transition={{ delay: 0.7, duration: 0.5 }}
                  />
                  <stop offset="70%" stopColor={color} stopOpacity={0} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {kind === "area" && n > 1 && <path d={area} fill={`url(#${gradientId})`} />}
              {advanced &&
                yTicks.map((t) => (
                  <g key={`y-${t}`}>
                    <line
                      x1={0}
                      x2={w}
                      y1={yS(t)}
                      y2={yS(t)}
                      stroke="var(--ink)"
                      strokeOpacity="0.07"
                      strokeWidth="1"
                    />
                    <text
                      x={w - 6}
                      y={yS(t) - 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="var(--ink)"
                      fillOpacity="0.45"
                      className="tabular-nums"
                    >
                      {fmtAxis(t, yStep)}
                    </text>
                  </g>
                ))}
              {advanced &&
                xTicks.map((i, k) => (
                  <text
                    key={`x-${k}`}
                    x={px(i)}
                    y={h - 8}
                    textAnchor={k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"}
                    fontSize="10"
                    fill="var(--ink)"
                    fillOpacity="0.45"
                  >
                    {formatAxisDate(dateAt(i), range)}
                  </text>
                ))}
              {measuring && (
                <rect
                  x={px(mFrom)}
                  y={PAD_TOP}
                  width={Math.max(px(mTo) - px(mFrom), 1)}
                  height={plotH}
                  fill={mColor}
                  fillOpacity="0.1"
                />
              )}
              <line
                x1={0}
                x2={w}
                y1={baseY}
                y2={baseY}
                stroke="var(--ink)"
                strokeOpacity="0.2"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              {compare && spyLine && (
                <path
                  d={spyLine}
                  fill="none"
                  stroke={MUTED}
                  strokeWidth="1.25"
                  strokeDasharray="4 4"
                  strokeLinejoin="round"
                />
              )}
              {showCandles ? (
                <g>
                  {chart.candles.map((c, i) => {
                    const cx = cx_(i);
                    const up = c.close >= c.open;
                    const col = up ? GAIN : LOSS;
                    const top = yC(Math.max(c.open, c.close));
                    const bodyH = Math.max(Math.abs(yC(c.open) - yC(c.close)), 1);
                    return (
                      <g key={c.date}>
                        <line x1={cx} x2={cx} y1={yC(c.high)} y2={yC(c.low)} stroke={col} strokeWidth="1" />
                        <rect x={cx - bodyW / 2} y={top} width={bodyW} height={bodyH} fill={col} />
                      </g>
                    );
                  })}
                </g>
              ) : (
                <path
                  d={line}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {avgOn && avgLine && (
                <path
                  d={avgLine}
                  fill="none"
                  stroke="var(--ink)"
                  strokeOpacity="0.6"
                  strokeWidth="1.25"
                  strokeLinejoin="round"
                />
              )}
              {advanced && m > 1 && hiIdx !== loIdx && (
                <>
                  <text
                    x={px(hiIdx)}
                    y={yS(hiVal) - 6}
                    textAnchor={labelAnchor(px(hiIdx))}
                    fontSize="10"
                    fontWeight="600"
                    fill="var(--ink)"
                    fillOpacity="0.7"
                    className="tabular-nums"
                  >
                    High {fmtAxis(hiVal, 0.01)}
                  </text>
                  <text
                    x={px(loIdx)}
                    y={yS(loVal) + 14}
                    textAnchor={labelAnchor(px(loIdx))}
                    fontSize="10"
                    fontWeight="600"
                    fill="var(--ink)"
                    fillOpacity="0.7"
                    className="tabular-nums"
                  >
                    Low {fmtAxis(loVal, 0.01)}
                  </text>
                </>
              )}
              {hover === null ? (
                <motion.circle
                  key={`last-${drawKey}`}
                  cx={ax}
                  cy={ay}
                  r="3"
                  fill={color}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.8 }}
                />
              ) : (
                <>
                  <line
                    x1={ax}
                    x2={ax}
                    y1={0}
                    y2={h}
                    stroke="var(--ink)"
                    strokeOpacity="0.3"
                    strokeWidth="1"
                  />
                  <circle cx={ax} cy={ay} r="5" fill="var(--panel)" />
                  <circle cx={ax} cy={ay} r="3" fill={color} />
                </>
              )}
            </svg>
          )}
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md bg-[var(--panel)] px-2 py-0.5 text-xs leading-4 ring-1 ring-hairline"
              style={{ left: ax, transform: `translateX(-${tagShift}%)` }}
            >
              {measuring ? (
                <>
                  <span className="font-semibold tabular-nums" style={{ color: mColor }}>
                    {compare
                      ? `${signed(mDelta)} pts`
                      : `${signed(mPct)}% (${mDelta >= 0 ? "+" : "−"}${formatCurrency(Math.abs(mDelta), currency)})`}
                  </span>
                  <span className="ml-2 text-muted">
                    {formatTag(dateAt(mFrom), range)} → {formatTag(dateAt(mTo), range)}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink tabular-nums">
                    {compare
                      ? `${ticker} ${ap.price.toFixed(2)}%`
                      : bar
                        ? `O ${formatCurrency(bar.open, currency)} H ${formatCurrency(bar.high, currency)} L ${formatCurrency(bar.low, currency)} C ${formatCurrency(bar.close, currency)}`
                        : formatCurrency(ap.price, currency)}
                  </span>
                  {hoverPct !== null && advanced && active > 0 && (
                    <span
                      className="ml-2 tabular-nums"
                      style={{ color: hoverPct >= 0 ? GAIN : LOSS }}
                    >
                      {signed(hoverPct)}%
                    </span>
                  )}
                  {compare && ap.spyPrice != null && (
                    <span className="ml-2 text-muted tabular-nums">
                      SPY {ap.spyPrice.toFixed(2)}%
                    </span>
                  )}
                  <span className="ml-2 text-muted">{formatTag(ap.date, range)}</span>
                </>
              )}
            </div>
          )}
          <span className="sr-only" aria-live="polite">
            {hover !== null
              ? `${compare ? `${ap.price.toFixed(2)}%` : formatCurrency(ap.price, currency)} on ${formatTag(ap.date, range)}`
              : ""}
          </span>
        </div>
      </motion.div>
      <table className="sr-only">
        <caption>Price History for {ticker}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{compare ? "Change" : "Price"}</th>
            {compare && <th scope="col">SPY Change</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index}>
              <td>{new Date(item.date).toLocaleDateString()}</td>
              <td>
                {compare
                  ? `${item.price.toFixed(2)}%`
                  : formatCurrency(item.price, currency)}
              </td>
              {compare && (
                <td>{item.spyPrice != null ? `${item.spyPrice.toFixed(2)}%` : "N/A"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartRangeBar({
  chart,
  className,
}: {
  chart: AssetChartState;
  className?: string;
}) {
  const pillId = `range-pill-${useId()}`;
  return (
    <div
      role="group"
      aria-label="Chart range"
      className={cn("flex items-center gap-1", className)}
    >
      {TIME_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => chart.setRange(r)}
          aria-pressed={chart.range === r}
          className={cn(
            "relative rounded-lg px-2.5 min-h-11 lg:min-h-7 text-xs font-medium transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-compass",
            chart.range === r
              ? "text-ink"
              : "text-muted hover:text-ink",
          )}
        >
          {chart.range === r && (
            <motion.span
              layoutId={pillId}
              aria-hidden="true"
              className="absolute inset-0 rounded-lg bg-ink/10"
              transition={{ duration: 0.28, ease: EASE }}
            />
          )}
          <span className="relative">{r}</span>
        </button>
      ))}
    </div>
  );
}
