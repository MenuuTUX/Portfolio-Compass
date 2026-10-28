"use client";

import { motion } from "framer-motion";
import InteractiveSlider from "../InteractiveSlider";
import CountUp from "../motion/CountUp";
import { EASE } from "../motion/Reveal";
import { projectContributionScenario } from "@/lib/math/scenario";

export const STARTING_BALANCE = 10_000;
const dollars = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const axisNumbers = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 1 });

const YEAR_CHIPS = [5, 10, 20, 30];
const RETURN_CHIPS = [3, 5, 7, 10];

function Chips({ label, values, current, suffix, onPick }: {
  label: string;
  values: number[];
  current: number;
  suffix: string;
  onPick: (value: number) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={current === value}
          onClick={() => onPick(value)}
          className={`relative min-h-11 rounded-full px-3.5 text-sm tabular-nums transition-colors duration-[70ms] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass ${
            current === value ? "text-canvas" : "bg-surface-soft text-body hover:text-ink"
          }`}
        >
          {current === value && (
            <motion.span
              layoutId={`chip-pill-${label}`}
              className="absolute inset-0 rounded-full bg-ink"
              transition={{ duration: 0.35, ease: EASE }}
            />
          )}
          <span className="relative">
            {value}
            {suffix}
          </span>
        </button>
      ))}
    </div>
  );
}

/** The illustrative compound growth card, laid out to live on a phone screen. */
export default function GrowthScreen({ years, annualReturn, onYears, onReturn, idPrefix }: {
  years: number;
  annualReturn: number;
  onYears: (value: number) => void;
  onReturn: (value: number) => void;
  idPrefix: string;
}) {
  const projection = projectContributionScenario(STARTING_BALANCE, 0, years, annualReturn / 100);
  const endingBalance = projection[projection.length - 1].balance;
  const growth = (endingBalance / STARTING_BALANCE - 1) * 100;
  const chartMaximum = Math.ceil(Math.max(STARTING_BALANCE, endingBalance) / 5_000) * 5_000;
  const barWidth = Math.min(24, 328 / projection.length - 3);
  const startingY = 150 - (STARTING_BALANCE / chartMaximum) * 128;
  const titleId = `${idPrefix}-title`;
  const chartTitleId = `${idPrefix}-chart-title`;
  const chartDescId = `${idPrefix}-chart-desc`;

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="text-sm font-semibold text-ink">Illustrative compound growth</h2>
      <p className="mt-1 text-xs text-muted">Starting balance: {dollars.format(STARTING_BALANCE)} CAD</p>
      <div className="mt-4" aria-live="polite" aria-atomic="true">
        <p className="text-xs text-body">Balance after {years} {years === 1 ? "year" : "years"}</p>
        <p className="mt-1 text-[32px] font-bold leading-[38px] tabular-nums text-ink">
          <span className="sr-only">{dollars.format(endingBalance)}</span>
          <span aria-hidden="true"><CountUp value={endingBalance} format={(v) => dollars.format(v)} duration={1.2} /></span>{" "}
          <span className="text-xs font-normal text-muted">CAD</span>
        </p>
      </div>
      <figure className="mt-4">
        <svg viewBox="0 0 380 178" className="h-auto w-full" role="img" aria-labelledby={`${chartTitleId} ${chartDescId}`}>
          <title id={chartTitleId}>Illustrative compound growth chart</title>
          <desc id={chartDescId}>
            {STARTING_BALANCE} Canadian dollars becomes {Math.round(endingBalance)} after {years} years at a constant {annualReturn} percent annual return, with no contributions.
          </desc>
          {[0, chartMaximum / 2, chartMaximum].map((value) => {
            const y = 150 - (value / chartMaximum) * 128;
            return (
              <g key={value}>
                <line x1="40" y1={y} x2="368" y2={y} className="stroke-hairline" />
                <text x="32" y={y + 4} textAnchor="end" className="fill-muted text-xs">{axisNumbers.format(value)}</text>
              </g>
            );
          })}
          {projection.map((point, index) => {
            const height = (point.balance / chartMaximum) * 128;
            return (
              <motion.rect
                key={point.year}
                x={40 + ((index + 0.5) / projection.length) * 328 - barWidth / 2}
                y={150 - height}
                width={barWidth}
                height={height}
                rx="2"
                className="fill-ink"
                style={{ originY: 1, transformBox: "fill-box" }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.7, delay: Math.min(index * 0.03, 0.6) + 0.4, ease: EASE }}
              />
            );
          })}
          <line x1="40" y1={startingY} x2="368" y2={startingY} className="stroke-muted" strokeDasharray="3 3" />
          <text x="40" y="172" className="fill-muted text-xs">Year 0</text>
          <text x="368" y="172" textAnchor="end" className="fill-muted text-xs">Year {years}</text>
        </svg>
        <figcaption className="mt-2 text-xs text-muted">
          Modeled change: {growth >= 0 ? "+" : ""}{growth.toFixed(0)}%. Dashed line marks the starting balance.
        </figcaption>
      </figure>

      <div className="mt-4 divide-y divide-hairline border-t border-hairline">
        <div className="space-y-3 py-4">
          <p className="text-sm text-body">Time horizon</p>
          <Chips label={`${idPrefix} time horizon presets`} values={YEAR_CHIPS} current={years} suffix=" yr" onPick={onYears} />
          <InteractiveSlider key={`y-${years}`} label="Time horizon" min={1} max={50} defaultValue={years} unit=" years" onChange={onYears} />
        </div>
        <div className="space-y-3 py-4">
          <p className="text-sm text-body">Assumed annual return</p>
          <Chips label={`${idPrefix} return presets`} values={RETURN_CHIPS} current={annualReturn} suffix="%" onPick={onReturn} />
          <InteractiveSlider key={`r-${annualReturn}`} label="Assumed annual return" min={-10} max={15} defaultValue={annualReturn} onChange={onReturn} />
        </div>
      </div>
      <p className="border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
        Constant return, no contributions, fees, taxes or inflation. This illustration does not model market volatility.
      </p>
    </section>
  );
}
