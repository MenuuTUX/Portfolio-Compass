"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Reveal, { EASE } from "@/components/motion/Reveal";

type Risk = "Low" | "Medium" | "High";
type SortKey = "weight" | "change" | "fee";

interface Holding {
  ticker: string;
  name: string;
  weight: number;
  change: number;
  fee: number;
  yld: number;
  risk: Risk;
  oneYear: number;
  series: number[];
}

const HOLDINGS: Holding[] = [
  { ticker: "VEQT", name: "All-equity ETF", weight: 40, change: 0.8, fee: 0.24, yld: 1.9, risk: "High", oneYear: 14.2, series: [10, 11, 10.6, 12, 12.8, 12.4, 13.6, 14.2, 13.9, 15, 15.8, 16.4] },
  { ticker: "XBB", name: "Canadian bonds", weight: 25, change: -0.2, fee: 0.1, yld: 3.6, risk: "Low", oneYear: 3.1, series: [12, 11.8, 11.9, 11.5, 11.7, 12, 12.1, 11.9, 12.3, 12.4, 12.3, 12.6] },
  { ticker: "GLD", name: "Gold", weight: 10, change: 0.4, fee: 0.4, yld: 0, risk: "Medium", oneYear: 9.4, series: [9, 9.4, 9.2, 10, 10.6, 10.3, 11, 11.4, 11.1, 12, 12.2, 12.7] },
  { ticker: "XEQT", name: "All-equity ETF", weight: 15, change: 0.7, fee: 0.2, yld: 1.8, risk: "High", oneYear: 13.8, series: [10, 10.5, 10.3, 11.6, 12.2, 12, 13, 13.6, 13.2, 14.4, 15, 15.6] },
  { ticker: "ZAG", name: "Canadian bonds", weight: 10, change: -0.1, fee: 0.09, yld: 3.5, risk: "Low", oneYear: 2.8, series: [12, 11.9, 12, 11.7, 11.8, 12.1, 12.2, 12, 12.4, 12.5, 12.4, 12.7] },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "weight", label: "Weight" },
  { key: "change", label: "Change" },
  { key: "fee", label: "Fee" },
];

const RISK_RANK: Record<Risk, number> = { Low: 0, Medium: 1, High: 2 };
const TWEEN = { duration: 0.4, ease: EASE };

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(1)}%`;
const tone = (n: number) => (n >= 0 ? "text-emerald-400" : "text-rose-400");

function sparkPath(series: number[], w: number, h: number) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function Sparkline({ series }: { series: number[] }) {
  return (
    <svg viewBox="0 0 120 32" className="h-8 w-full max-w-[160px]" role="presentation" aria-hidden="true">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        d={sparkPath(series, 120, 32)}
        fill="none"
        className="stroke-ink"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Detail({ h }: { h: Holding }) {
  return (
    <div className="grid gap-4 px-5 pb-4 pt-1 sm:grid-cols-2">
      <div>
        <p className="text-xs text-muted">12 month trend</p>
        <Sparkline series={h.series} />
        <p className="mt-3 text-xs text-muted">Portfolio weight</p>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
            <motion.div
              className="h-full rounded-full bg-ink"
              initial={{ width: 0 }}
              animate={{ width: `${h.weight}%` }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            />
          </div>
          <span className="text-xs text-body tabular-nums">{h.weight}%</span>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3 sm:grid-cols-1 sm:gap-2">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
          <dt className="text-xs text-muted">Expense ratio</dt>
          <dd className="text-sm text-ink tabular-nums">{h.fee.toFixed(2)}%</dd>
        </div>
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
          <dt className="text-xs text-muted">Yield</dt>
          <dd className="text-sm text-ink tabular-nums">{h.yld.toFixed(1)}%</dd>
        </div>
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
          <dt className="text-xs text-muted">Risk</dt>
          <dd>
            <span className="inline-block rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-body">{h.risk}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

interface Metric {
  label: string;
  a: string;
  b: string;
  /** Which side wins: -1 a, 1 b, 0 tie. */
  win: -1 | 0 | 1;
}

function buildMetrics(a: Holding, b: Holding): Metric[] {
  const cmp = (x: number, y: number, lowerBetter: boolean): -1 | 0 | 1 => {
    if (x === y) return 0;
    return (x < y) === lowerBetter ? -1 : 1;
  };
  return [
    { label: "Fee", a: `${a.fee.toFixed(2)}%`, b: `${b.fee.toFixed(2)}%`, win: cmp(a.fee, b.fee, true) },
    { label: "Yield", a: `${a.yld.toFixed(1)}%`, b: `${b.yld.toFixed(1)}%`, win: cmp(a.yld, b.yld, false) },
    { label: "Risk", a: a.risk, b: b.risk, win: cmp(RISK_RANK[a.risk], RISK_RANK[b.risk], true) },
    { label: "1y change", a: signed(a.oneYear), b: signed(b.oneYear), win: cmp(a.oneYear, b.oneYear, false) },
  ];
}

export default function CompareMock() {
  const [sort, setSort] = useState<SortKey>("weight");
  const [open, setOpen] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);

  const rows = useMemo(() => {
    const copy = [...HOLDINGS];
    if (sort === "weight") copy.sort((x, y) => y.weight - x.weight);
    if (sort === "change") copy.sort((x, y) => y.change - x.change);
    if (sort === "fee") copy.sort((x, y) => x.fee - y.fee);
    return copy;
  }, [sort]);

  const pair = checked.length === 2 ? checked.map((t) => HOLDINGS.find((h) => h.ticker === t)!) : null;
  const metrics = pair ? buildMetrics(pair[0], pair[1]) : null;

  const toggleCheck = (ticker: string) =>
    setChecked((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      return prev.length >= 2 ? [prev[1], ticker] : [...prev, ticker];
    });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && open) setOpen(null);
  };

  const summary =
    pair && metrics
      ? `Comparing ${pair[0].ticker} and ${pair[1].ticker}. ` +
        metrics
          .map((m) => `${m.label}: ${m.win === 0 ? "tied" : `${m.win === -1 ? pair[0].ticker : pair[1].ticker} is better`}`)
          .join(". ") +
        "."
      : checked.length === 1
        ? `${checked[0]} selected. Pick one more to compare.`
        : "";

  return (
    <div onKeyDown={onKeyDown}>
      <Reveal y={20} duration={0.7} className="rounded-xl bg-surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <p className="text-sm font-medium text-ink">Compare holdings</p>
          <div className="flex items-center gap-2" role="group" aria-label="Sort holdings">
            <span className="text-xs text-muted">Sort by:</span>
            <div className="flex gap-1">
              {SORTS.map((s) => {
                const active = sort === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSort(s.key)}
                    className={`relative rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass ${
                      active ? "text-canvas" : "bg-surface-soft text-body hover:text-ink"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="compare-mock-sort-pill"
                        className="absolute inset-0 rounded-full bg-ink"
                        transition={{ duration: 0.3, ease: EASE }}
                      />
                    )}
                    <span className="relative">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <ul className="mt-2 divide-y divide-hairline">
          {rows.map((h) => {
            const isOpen = open === h.ticker;
            const isChecked = checked.includes(h.ticker);
            return (
              <motion.li
                key={h.ticker}
                layout="position"
                transition={{ layout: TWEEN }}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="flex items-stretch transition-colors duration-150 hover:bg-surface-soft/40">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`compare-mock-${h.ticker}`}
                    onClick={() => setOpen(isOpen ? null : h.ticker)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-4 py-4 pl-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-compass"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-ink">{h.ticker}</span>
                      <span className="block text-sm text-muted">{h.name}</span>
                    </span>
                    <span className="text-sm text-body tabular-nums">{h.weight}%</span>
                    <span className={`w-14 text-right text-sm tabular-nums ${tone(h.change)}`}>{signed(h.change)}</span>
                  </button>
                  <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-3 focus-within:ring-2 focus-within:ring-inset focus-within:ring-compass">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(h.ticker)}
                      aria-label={`Add ${h.ticker} to comparison`}
                      className="h-4 w-4 cursor-pointer accent-compass"
                    />
                  </label>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`compare-mock-${h.ticker}`}
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <Detail h={h} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>

        <AnimatePresence initial={false}>
          {pair && metrics && (
            <motion.div
              key="strip"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="overflow-hidden border-t border-hairline"
            >
              <div className="px-5 py-4">
                <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs text-muted">
                  <span />
                  <span className="text-right font-semibold text-ink">{pair[0].ticker}</span>
                  <span className="text-right font-semibold text-ink">{pair[1].ticker}</span>
                </div>
                <dl className="mt-1">
                  {metrics.map((m) => (
                    <div key={m.label} className="grid grid-cols-[1fr_1fr_1fr] gap-2 py-1.5 text-sm tabular-nums">
                      <dt className="text-xs text-muted">{m.label}</dt>
                      <dd className={`text-right ${m.win === -1 || m.win === 0 ? "font-medium text-ink" : "text-muted"}`}>{m.a}</dd>
                      <dd className={`text-right ${m.win === 1 || m.win === 0 ? "font-medium text-ink" : "text-muted"}`}>{m.b}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="px-5 pb-4 pt-3 text-xs text-muted-soft">Example data</p>
        <div aria-live="polite" role="status" className="sr-only">
          {summary}
        </div>
      </Reveal>
    </div>
  );
}
