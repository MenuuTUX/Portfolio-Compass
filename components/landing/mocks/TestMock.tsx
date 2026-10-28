"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import CountUp from "../../motion/CountUp";
import { EASE } from "../../motion/Reveal";
import PhoneMock from "../PhoneMock";

type Scenario = "Low" | "Median" | "High";
type Spread = "Calm" | "Typical" | "Rough";

const SCENARIOS: Scenario[] = ["Low", "Median", "High"];
const YEARS: number[] = [10, 20, 30];
const SPREADS: Spread[] = ["Calm", "Typical", "Rough"];
const VOL: Record<Spread, number> = { Calm: 0.08, Typical: 0.14, Rough: 0.2 };
const IDX: Record<Scenario, 0 | 1 | 2> = { Low: 0, Median: 1, High: 2 };
const PATHS = 40;
const MAX_YEARS = 30;
const START = 10000;
const MEAN = 0.06;
const RUN_MS = 900;

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Model {
  paths: number[][];
  /** Per year: [p10, p50, p90]. */
  bands: [number, number, number][];
}

function simulate(seed: number, spread: Spread): Model {
  const rand = mulberry32(seed * 7919 + SPREADS.indexOf(spread) * 104729 + 17);
  const sigma = VOL[spread];
  const drift = MEAN - (sigma * sigma) / 2;
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const paths: number[][] = [];
  for (let p = 0; p < PATHS; p++) {
    const row = [START];
    for (let y = 1; y <= MAX_YEARS; y++) row.push(row[y - 1] * Math.exp(drift + sigma * normal()));
    paths.push(row);
  }
  const bands: [number, number, number][] = [];
  for (let y = 0; y <= MAX_YEARS; y++) {
    const col = paths.map((r) => r[y]).sort((a, b) => a - b);
    const at = (q: number) => {
      const pos = q * (col.length - 1);
      const lo = Math.floor(pos);
      return col[lo] + (col[Math.min(lo + 1, col.length - 1)] - col[lo]) * (pos - lo);
    };
    bands.push([at(0.1), at(0.5), at(0.9)]);
  }
  return { paths, bands };
}

const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

function linePath(values: number[], w: number, h: number, pad: number, lo: number, hi: number) {
  const n = values.length - 1;
  return values
    .map((v, i) => {
      const x = (i / n) * w;
      const y = pad + (1 - (Math.log(v) - lo) / (hi - lo)) * (h - pad * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  group,
  label,
  render = (o) => String(o),
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  group: string;
  label: string;
  render?: (o: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1.5">
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={String(o)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o)}
            className="relative min-h-11 rounded-full bg-surface-soft px-3 text-xs font-medium text-body outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-compass"
          >
            {active && (
              <motion.span
                layoutId={`pill-${group}`}
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ duration: 0.35, ease: EASE }}
              />
            )}
            <span className={`relative ${active ? "text-canvas" : ""}`}>{render(o)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function TestMock() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "0px 0px -80px 0px" });
  const reduce = useReducedMotion();

  const [seed, setSeed] = useState(1);
  const [years, setYears] = useState(20);
  const [scenario, setScenario] = useState<Scenario>("Median");
  const [spread, setSpread] = useState<Spread>("Typical");
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [kbd, setKbd] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const model = useMemo(() => simulate(seed, spread), [seed, spread]);

  const run = () => {
    if (timer.current) clearTimeout(timer.current);
    setSeed((s) => s + 1);
    setRunning(true);
    timer.current = setTimeout(() => setRunning(false), RUN_MS);
  };

  useEffect(() => {
    if (!inView) return;
    setStarted(true);
    setRunning(true);
    timer.current = setTimeout(() => setRunning(false), RUN_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [inView]);

  const bands = model.bands.slice(0, years + 1);
  const series = [0, 1, 2].map((k) => bands.map((b) => b[k]));
  const all = model.paths.flatMap((p) => p.slice(0, years + 1));
  const lo = Math.log(Math.min(...all));
  const hi = Math.log(Math.max(...all));

  const W = 320;
  const H = 150;
  const PW = 154;
  const PH = 64;
  const drawKey = `${seed}-${years}-${spread}`;

  const idx = IDX[scenario];
  const ends = bands[years];
  const selectedEnd = ends[idx];
  const others = SCENARIOS.filter((s) => s !== scenario);

  const lineClass = (k: number) => (k === idx ? "stroke-ink" : "stroke-muted-soft");
  const lineWidth = (k: number, big: number, small: number) => (k === idx ? big : small);
  const lineOpacity = (k: number) => (k === idx ? 1 : 0.55);

  const draw = (delay: number, duration: number) =>
    reduce
      ? { initial: false as const, animate: { pathLength: 1 } }
      : {
          initial: { pathLength: 0 },
          animate: { pathLength: started ? 1 : 0 },
          transition: { duration, delay, ease: EASE },
        };

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setKbd(false);
    setHover(Math.round(t * years));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setKbd(true);
    const step = e.key === "ArrowRight" ? 1 : -1;
    setHover((h) => Math.min(years, Math.max(0, (h ?? years) + step)));
  };

  const hoverBand = hover !== null ? bands[Math.min(hover, years)] : null;
  const hoverPct = hover !== null ? (hover / years) * 100 : 0;
  const readout = hoverBand
    ? `Year ${hover}. Low ${money(hoverBand[0])}, median ${money(hoverBand[1])}, high ${money(hoverBand[2])}.`
    : "";
  const announce = `${scenario} after ${years} years: ${money(selectedEnd)}`;

  const resultLine = (
    <span aria-hidden="true">
      {scenario} after {years} years:{" "}
      <CountUp value={selectedEnd} format={money} duration={0.6} className="tabular-nums" />
    </span>
  );

  return (
    <div ref={rootRef} className="grid items-start gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
      <PhoneMock interactive tilt={-3} maxWidth={260} screenHeight={520}>
        <p className="text-xs font-bold text-ink">Simulated paths</p>
        <p className="mt-1 text-xs text-muted">
          {running ? (
            <>
              <CountUp key={seed} value={PATHS * 25} duration={RUN_MS / 1000} className="tabular-nums" /> runs, {years} years
            </>
          ) : (
            <>1,000 runs, {years} years</>
          )}
        </p>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="mt-4 h-28 w-full" fill="none" preserveAspectRatio="none" aria-hidden="true">
          {series.map((s, k) => (
            <motion.path
              key={`${drawKey}-${k}`}
              d={linePath(s, PW, PH, 4, lo, hi)}
              className={`${lineClass(k)} transition-[stroke-width,opacity] duration-300`}
              strokeWidth={lineWidth(k, 2.2, 1.2)}
              style={{ opacity: lineOpacity(k) }}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              {...draw(0.1 + k * 0.12, 0.9)}
            />
          ))}
        </svg>
        <div className="mt-3">
          <Chips options={SCENARIOS} value={scenario} onChange={setScenario} group="phone-scenario" label="Scenario" />
        </div>
        <p className="mt-4 text-center text-sm font-semibold text-ink">{resultLine}</p>
        <p className="mt-2 text-center text-xs text-muted-soft">Model scenarios, not forecasts</p>
      </PhoneMock>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={inView || reduce ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.8, ease: EASE }}
        className="rounded-xl bg-surface-card p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink">Simulated paths</p>
          <button
            type="button"
            onClick={run}
            disabled={running}
            aria-label="Run simulation"
            className="min-h-11 rounded-full bg-surface-soft px-5 text-sm font-medium text-ink outline-none transition-colors hover:bg-hairline focus-visible:ring-2 focus-visible:ring-compass disabled:cursor-default disabled:text-muted"
          >
            {running ? (
              <>
                Running <CountUp key={seed} value={1000} duration={RUN_MS / 1000} className="tabular-nums" />
              </>
            ) : (
              "Run simulation"
            )}
          </button>
        </div>

        <div className="relative mt-4">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-pan-y rounded-md outline-none focus-visible:ring-2 focus-visible:ring-compass"
            role="img"
            tabIndex={0}
            aria-label={`Simulated portfolio paths over ${years} years. Use left and right arrow keys to read values by year.`}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={onKey}
          >
            {model.paths.map((p, i) => (
              <motion.path
                key={`${drawKey}-p${i}`}
                d={linePath(p.slice(0, years + 1), W, H, 8, lo, hi)}
                fill="none"
                className="stroke-muted-soft"
                strokeWidth={1}
                strokeLinejoin="round"
                style={{ opacity: 0.35 }}
                {...draw(i * 0.015, 0.7)}
              />
            ))}
            {series.map((s, k) => (
              <motion.path
                key={`${drawKey}-l${k}`}
                d={linePath(s, W, H, 8, lo, hi)}
                fill="none"
                className={`${lineClass(k)} transition-[stroke-width,opacity] duration-300`}
                strokeWidth={lineWidth(k, 3, 1.5)}
                strokeLinejoin="round"
                style={{ opacity: lineOpacity(k) }}
                {...draw(0.75 + k * 0.1, 0.8)}
              />
            ))}
            <line x1="0" y1={H - 1} x2={W} y2={H - 1} className="stroke-hairline" />
            {hover !== null && (
              <line x1={(hover / years) * W} y1="0" x2={(hover / years) * W} y2={H} className="stroke-ink" strokeWidth="1" strokeDasharray="3 3" />
            )}
          </svg>
          {hoverBand && hover !== null && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1 z-10 w-max rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-snug text-canvas shadow-lg"
              style={{ left: `${hoverPct}%`, transform: `translateX(${hoverPct > 60 ? "calc(-100% - 8px)" : "8px"})` }}
            >
              <p className="font-semibold">Year {hover}</p>
              <p className="tabular-nums">High {money(hoverBand[2])}</p>
              <p className="tabular-nums">Median {money(hoverBand[1])}</p>
              <p className="tabular-nums">Low {money(hoverBand[0])}</p>
            </div>
          )}
          <div className="mt-1 flex justify-between text-xs text-muted-soft" aria-hidden="true">
            <span>Today</span>
            <span>{years} years</span>
          </div>
        </div>

        <p className="sr-only" aria-live="polite">{kbd ? readout : announce}</p>

        <div className="mt-4">
          <p className="text-lg font-semibold text-ink">{resultLine}</p>
          <p className="mt-1 text-xs text-muted">
            {others.map((s) => `${s} ${money(ends[IDX[s]])}`).join(" · ")}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {[
            { name: "Scenario", node: <Chips options={SCENARIOS} value={scenario} onChange={setScenario} group="scenario" label="Scenario" /> },
            { name: "Years", node: <Chips options={YEARS} value={years} onChange={setYears} group="years" label="Years" render={(y) => `${y} yrs`} /> },
            { name: "Volatility", node: <Chips options={SPREADS} value={spread} onChange={setSpread} group="spread" label="Volatility" /> },
          ].map((row) => (
            <div key={row.name} className="grid items-center gap-2 sm:grid-cols-[5.5rem_1fr]">
              <p className="text-xs text-muted">{row.name}</p>
              {row.node}
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted">Model scenarios, not forecasts.</p>
        <p className="mt-1 text-xs text-muted">Example data, 1,000 runs shown as {PATHS} paths</p>
      </motion.div>
    </div>
  );
}
