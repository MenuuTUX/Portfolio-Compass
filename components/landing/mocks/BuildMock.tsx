"use client";

import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { EASE, RevealGroup, RevealItem } from "../../motion/Reveal";
import PhoneMock from "../PhoneMock";

type AssetKey = "Equity" | "Bonds" | "Cash" | "Gold";
type Mix = [number, number, number];

const ASSETS: { key: AssetKey; cls: string; blurb: string }[] = [
  { key: "Equity", cls: "bg-ink", blurb: "Stocks. Higher long-run growth, bigger swings." },
  { key: "Bonds", cls: "bg-muted", blurb: "Loans to governments and companies. Steadier, lower growth." },
  { key: "Cash", cls: "bg-muted-soft", blurb: "Savings and short-term deposits. Stable, but it can lag inflation." },
  { key: "Gold", cls: "bg-gold", blurb: "A real asset. It can diversify, but it pays no income." },
];

const PRESETS = {
  Conservative: { equity: 30, mix: [50, 15, 5] as Mix },
  Balanced: { equity: 60, mix: [25, 10, 5] as Mix },
  Growth: { equity: 85, mix: [8, 2, 5] as Mix },
};
type PresetName = keyof typeof PRESETS | "Custom";
const PRESET_NAMES: PresetName[] = ["Conservative", "Balanced", "Growth", "Custom"];

const RANGES = ["1M", "6M", "1Y", "5Y", "Max"] as const;
type RangeKey = (typeof RANGES)[number];
const RANGE_META: Record<RangeKey, { n: number; years: number; seed: number }> = {
  "1M": { n: 12, years: 1 / 12, seed: 11 },
  "6M": { n: 16, years: 0.5, seed: 23 },
  "1Y": { n: 20, years: 1, seed: 37 },
  "5Y": { n: 24, years: 5, seed: 41 },
  Max: { n: 24, years: 15, seed: 59 },
};

const START_VALUE = 10000;
const W = 320;
const H = 120;

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass-action";
const TOUCH = "min-h-11 [@media(pointer:fine)]:min-h-9";

/** Whole-number allocation that always sums to 100 and keeps gold at or above zero. */
function allocate(equity: number, mix: Mix): Record<AssetKey, number> {
  const rest = 100 - equity;
  const sum = mix[0] + mix[1] + mix[2];
  let bonds = Math.round((rest * mix[0]) / sum);
  const cash = Math.round((rest * mix[1]) / sum);
  let gold = rest - bonds - cash;
  if (gold < 0) {
    bonds = Math.max(0, bonds + gold);
    gold = 0;
  }
  return { Equity: equity, Bonds: bonds, Cash: cash, Gold: gold };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic illustrative balance series: same noise per range, drift and volatility scale with equity. */
function buildSeries(range: RangeKey, equity: number): number[] {
  const { n, years, seed } = RANGE_META[range];
  const rnd = mulberry32(seed);
  const e = equity / 100;
  const annualReturn = 0.025 + e * 0.055;
  const annualVol = 0.03 + e * 0.14;
  const dt = years / (n - 1);
  const out = [START_VALUE];
  for (let i = 1; i < n; i++) {
    const z = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    out.push(out[i - 1] * (1 + annualReturn * dt + annualVol * Math.sqrt(dt) * z));
  }
  return out;
}

function useTween(target: number, duration: number) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (reduce) {
      current.current = target;
      setValue(target);
      return;
    }
    const controls = animate(current.current, target, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        current.current = v;
        setValue(v);
      },
    });
    return () => controls.stop();
  }, [target, duration, reduce]);
  return value;
}

const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

function Pct({ value, duration, className }: { value: number; duration: number; className?: string }) {
  const v = useTween(value, duration);
  return <span className={className}>{Math.round(v)}%</span>;
}

function Chips<T extends string>({
  label,
  items,
  value,
  onChange,
  pillId,
}: {
  label: string;
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
  pillId: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const active = item === value;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item)}
            className={`relative rounded-full px-3.5 text-xs font-medium transition-colors ${TOUCH} ${FOCUS} ${active ? "text-canvas" : "bg-surface-soft text-body hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ duration: 0.4, ease: EASE }}
              />
            )}
            <span className="relative">{item}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function BuildMock() {
  const [preset, setPreset] = useState<PresetName>("Balanced");
  const [equity, setEquity] = useState(60);
  const [mix, setMix] = useState<Mix>(PRESETS.Balanced.mix);
  const [selected, setSelected] = useState<AssetKey | null>(null);
  const [range, setRange] = useState<RangeKey>("1Y");
  const [cursor, setCursor] = useState<number | null>(null);
  const [kbdText, setKbdText] = useState("");

  const anchor = useRef<HTMLDivElement>(null);
  const inView = useInView(anchor, { once: true, margin: "0px 0px -40px 0px" });
  const dur = preset === "Custom" ? 0.12 : 0.6;

  const alloc = useMemo(() => allocate(equity, mix), [equity, mix]);
  const series = useMemo(() => buildSeries(range, equity), [range, equity]);
  const end = series[series.length - 1];
  const headline = useTween(end, dur);
  const change = (end / START_VALUE - 1) * 100;

  const { d, ys } = useMemo(() => {
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    const top = 14;
    const bottom = H - 12;
    const pts = series.map((v, i) => ({ x: (i / (series.length - 1)) * W, y: bottom - ((v - min) / span) * (bottom - top) }));
    return { d: pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "), ys: pts.map((p) => p.y) };
  }, [series]);

  const summary = `${preset}: ${alloc.Equity}% equity, ${alloc.Bonds}% bonds, ${alloc.Cash}% cash, ${alloc.Gold}% gold`;

  const pickPreset = (name: PresetName) => {
    setPreset(name);
    if (name !== "Custom") {
      setEquity(PRESETS[name].equity);
      setMix(PRESETS[name].mix);
    }
  };
  const toggle = (k: AssetKey) => setSelected((s) => (s === k ? null : k));
  const dim = (k: AssetKey) => (selected && selected !== k ? 0.4 : 1);

  const pointValue = (i: number) => `${money(series[i])}, ${((series[i] / START_VALUE - 1) * 100).toFixed(1)}% from start`;
  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setCursor(Math.round(t * (series.length - 1)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const last = series.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = Math.min(last, (cursor ?? -1) + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, (cursor ?? last + 1) - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else if (e.key === "Escape") {
      setCursor(null);
      setKbdText("");
      return;
    }
    if (next === null) return;
    e.preventDefault();
    setCursor(next);
    setKbdText(`Point ${next + 1} of ${series.length}: ${pointValue(next)}`);
  };

  const tagLeft = cursor === null ? 0 : Math.min(82, Math.max(18, (cursor / (series.length - 1)) * 100));
  const cx = cursor === null ? 0 : (cursor / (series.length - 1)) * W;

  const shown = ASSETS.find((a) => a.key === selected);

  return (
    <RevealGroup stagger={0.08} className="grid items-center gap-4 sm:grid-cols-[minmax(0,280px)_1fr]">
      <p className="sr-only" aria-live="polite">{summary}</p>

      <RevealItem>
        <PhoneMock interactive>
          <p className="text-xs font-bold text-ink">Model allocation</p>
          <div className="mt-4 flex h-28 items-end gap-2">
            {ASSETS.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-pressed={selected === a.key}
                aria-label={`${a.key} ${alloc[a.key]}%`}
                onClick={() => toggle(a.key)}
                className={`flex h-full flex-1 items-end rounded-t-lg ${FOCUS}`}
              >
                <motion.span
                  className={`block w-full origin-bottom rounded-t-lg ${a.cls}`}
                  initial={{ height: "0%" }}
                  animate={{ height: inView ? `${Math.max(alloc[a.key], 3)}%` : "0%", opacity: dim(a.key) }}
                  transition={{ duration: dur, ease: EASE }}
                />
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-1">
            {ASSETS.map((a) => (
              <li key={a.key}>
                <button
                  type="button"
                  aria-pressed={selected === a.key}
                  onClick={() => toggle(a.key)}
                  style={{ opacity: dim(a.key) }}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md text-xs transition-opacity ${FOCUS}`}
                >
                  <span className={`h-2 w-2 rounded-full ${a.cls}`} />
                  <span className="flex-1 text-left text-body">{a.key}</span>
                  <Pct value={alloc[a.key]} duration={dur} className="font-bold text-ink tabular-nums" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-xs text-muted-soft">Example data</p>
        </PhoneMock>
      </RevealItem>

      <div ref={anchor} className="space-y-4">
        <RevealItem className="rounded-xl bg-surface-card p-5 text-left">
          <p className="text-sm font-medium text-ink">Model allocation</p>
          <div className="mt-3">
            <Chips label="Portfolio preset" items={PRESET_NAMES} value={preset} onChange={pickPreset} pillId="build-preset-pill" />
          </div>

          <div className="mt-5 flex h-3 w-full items-center">
            {ASSETS.map((a, i) => (
              <motion.button
                key={a.key}
                type="button"
                aria-pressed={selected === a.key}
                aria-label={`${a.key} ${alloc[a.key]}%`}
                onClick={() => toggle(a.key)}
                initial={{ width: "0%" }}
                animate={{ width: inView ? `${alloc[a.key]}%` : "0%", scaleY: selected === a.key ? 1.4 : 1, opacity: dim(a.key) }}
                transition={{ duration: dur, ease: EASE }}
                className={`relative block h-3 ${a.cls} ${i === 0 ? "rounded-l-full" : ""} ${i === ASSETS.length - 1 ? "rounded-r-full" : ""} ${FOCUS} after:absolute after:inset-x-0 after:-inset-y-3 after:content-['']`}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-1">
            {ASSETS.map((a) => (
              <li key={a.key}>
                <button
                  type="button"
                  aria-pressed={selected === a.key}
                  onClick={() => toggle(a.key)}
                  style={{ opacity: dim(a.key) }}
                  className={`flex w-full items-center gap-3 rounded-md text-sm transition-opacity ${TOUCH} ${FOCUS}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${a.cls}`} />
                  <span className="flex-1 text-left text-body">{a.key}</span>
                  <Pct value={alloc[a.key]} duration={dur} className="text-ink tabular-nums" />
                </button>
              </li>
            ))}
          </ul>

          <div className="min-h-10 pt-2">
            <AnimatePresence mode="wait" initial={false}>
              {shown && (
                <motion.p
                  key={shown.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="text-sm text-muted"
                >
                  {shown.key}: {shown.blurb}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-2 border-t border-hairline pt-4">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="build-equity" className="text-body">Equity</label>
              <span className="text-ink tabular-nums">{equity}%</span>
            </div>
            <input
              id="build-equity"
              type="range"
              min={0}
              max={100}
              step={1}
              value={equity}
              onChange={(e) => {
                setEquity(Number(e.target.value));
                setPreset("Custom");
              }}
              className={`mt-2 h-11 w-full cursor-pointer accent-compass-action ${FOCUS}`}
            />
          </div>
        </RevealItem>

        <RevealItem className="rounded-xl bg-surface-card p-5 text-left">
          <p className="text-sm text-muted">Illustrative value</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <p className="text-3xl font-semibold tracking-tight text-ink tabular-nums">{money(headline)}</p>
            <p className={`text-sm tabular-nums ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}% over {range}
            </p>
          </div>

          <div className="relative mt-4">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className={`h-auto w-full touch-pan-y rounded-md ${FOCUS}`}
              role="img"
              tabIndex={0}
              aria-label={`Illustrative balance over ${range} for a ${alloc.Equity}% equity mix, starting at $10,000. Use left and right arrow keys to inspect points.`}
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={() => setCursor(null)}
              onKeyDown={onKey}
              onBlur={() => {
                setCursor(null);
                setKbdText("");
              }}
            >
              <line x1="0" y1={H - 4} x2={W} y2={H - 4} className="stroke-hairline" />
              <motion.path
                key={`${range}-${preset === "Custom" ? "c" : preset}`}
                d={d}
                fill="none"
                className="stroke-ink"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: inView ? 1 : 0 }}
                transition={{ duration: 0.9, ease: EASE }}
              />
              {cursor !== null && (
                <g pointerEvents="none">
                  <line x1={cx} y1="0" x2={cx} y2={H - 4} className="stroke-muted-soft" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  <circle cx={cx} cy={ys[cursor]} r="4" className="fill-ink stroke-surface-card" strokeWidth="2" />
                </g>
              )}
            </svg>
            {cursor !== null && (
              <div
                className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-canvas tabular-nums"
                style={{ left: `${tagLeft}%` }}
              >
                {money(series[cursor])}
              </div>
            )}
            <p className="sr-only" aria-live="polite">{kbdText}</p>
          </div>

          <div className="mt-4">
            <Chips label="Time range" items={RANGES} value={range} onChange={(r) => { setRange(r); setCursor(null); }} pillId="build-range-pill" />
          </div>
          <p className="mt-4 text-xs text-muted">Example data. Illustrative only, not a forecast.</p>
        </RevealItem>
      </div>
    </RevealGroup>
  );
}
