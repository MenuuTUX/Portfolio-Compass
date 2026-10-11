"use client";

import { useState } from "react";
import InteractiveSlider from "./InteractiveSlider";
import { projectContributionScenario } from "@/lib/math/scenario";

interface HeroProps {
  onStart?: () => void;
  onViewMarket?: () => void;
}

const startingBalance = 10_000;
const dollars = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});
const axisNumbers = new Intl.NumberFormat("en-CA", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function Hero({ onStart, onViewMarket }: HeroProps) {
  const [annualReturn, setAnnualReturn] = useState(7);
  const [years, setYears] = useState(10);
  const projection = projectContributionScenario(startingBalance, 0, years, annualReturn / 100);
  const endingBalance = projection[projection.length - 1].balance;
  const growth = (endingBalance / startingBalance - 1) * 100;
  const chartMaximum = Math.ceil(Math.max(startingBalance, endingBalance) / 5_000) * 5_000;
  const barWidth = Math.min(24, 328 / projection.length - 3);
  const startingY = 150 - (startingBalance / chartMaximum) * 128;

  return (
    <section className="min-h-screen flex items-center bg-canvas text-ink selection:bg-compass/20" aria-labelledby="landing-title">
      <div className="w-full max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 lg:py-12">
        <div>
          <h1 id="landing-title" className="text-4xl sm:text-5xl xl:text-6xl 2xl:text-7xl font-display font-bold leading-tight">
            Build a portfolio, then test the{" "}
            <span className="text-compass">assumptions behind it.</span>
          </h1>
          <p className="text-base sm:text-lg text-body max-w-xl leading-relaxed mt-6">
            Compare funds and stocks, then test an allocation with historical
            data and simulated paths.
            <span className="text-xs text-muted mt-2 block">For research and education, not financial advice.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button onClick={onStart} className="px-6 py-3.5 rounded-lg bg-compass-action hover:bg-compass-action-hover text-white font-medium transition-colors cursor-pointer flex items-center justify-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-compass">
              Get started <span aria-hidden="true">→</span>
            </button>
            <button onClick={onViewMarket} className="px-6 py-3.5 rounded-lg bg-surface-card border border-hairline-strong text-ink font-medium transition-colors cursor-pointer hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-compass">
              Browse market
            </button>
          </div>
          <dl className="grid grid-cols-3 gap-4 sm:gap-6 pt-6 border-t border-hairline mt-10">
            {[
              { label: "Market data", value: "Quotes & history" },
              { label: "Coverage", value: "ETFs + stocks" },
              { label: "Storage", value: "Browser only" },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[10px] sm:text-xs text-muted uppercase tracking-wider mb-2">{item.label}</dt>
                <dd className="text-sm sm:text-base text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section className="w-full max-w-md bg-surface-card border border-hairline-strong rounded-2xl p-6 sm:p-8 mx-auto" aria-labelledby="growth-title">
          <h2 id="growth-title" className="text-lg sm:text-xl font-display font-normal text-ink">Illustrative compound growth</h2>
          <p className="text-xs text-muted mt-2">Starting balance: {dollars.format(startingBalance)} CAD</p>
          <div className="mt-5" aria-live="polite" aria-atomic="true">
            <p className="text-xs text-body">Balance after {years} {years === 1 ? "year" : "years"}</p>
            <p className="text-2xl sm:text-3xl tabular-nums mt-1">{dollars.format(endingBalance)} <span className="text-xs text-muted">CAD</span></p>
          </div>
          <figure className="mt-5 mb-6 bg-canvas rounded-lg border border-hairline p-3">
            <svg viewBox="0 0 380 178" className="w-full h-auto" role="img" aria-labelledby="growth-chart-title growth-chart-description">
              <title id="growth-chart-title">Illustrative compound growth chart</title>
              <desc id="growth-chart-description">
                {startingBalance} Canadian dollars becomes {Math.round(endingBalance)} after {years} years
                at a constant {annualReturn} percent annual return, with no contributions.
              </desc>
              {[0, chartMaximum / 2, chartMaximum].map((value) => {
                const y = 150 - (value / chartMaximum) * 128;
                return (
                  <g key={value}>
                    <line x1="40" y1={y} x2="368" y2={y} className="stroke-hairline" />
                    <text x="32" y={y + 3} textAnchor="end" className="fill-muted text-[9px]">{axisNumbers.format(value)}</text>
                  </g>
                );
              })}
              {projection.map((point, index) => {
                const height = (point.balance / chartMaximum) * 128;
                return <rect key={point.year} x={40 + ((index + 0.5) / projection.length) * 328 - barWidth / 2} y={150 - height} width={barWidth} height={height} rx="1" className="fill-compass" />;
              })}
              <line x1="40" y1={startingY} x2="368" y2={startingY} className="stroke-body" strokeDasharray="3 3" />
              <text x="40" y="170" className="fill-muted text-[9px]">Year 0</text>
              <text x="368" y="170" textAnchor="end" className="fill-muted text-[9px]">Year {years}</text>
            </svg>
            <figcaption className="text-[10px] text-body mt-2">Modeled change: {growth >= 0 ? "+" : ""}{growth.toFixed(0)}%. Dashed line marks the starting balance.</figcaption>
          </figure>
          <div className="space-y-4">
            <InteractiveSlider label="Time horizon" min={1} max={50} defaultValue={10} unit=" years" onChange={setYears} />
            <InteractiveSlider label="Assumed annual return" min={-10} max={15} defaultValue={7} onChange={setAnnualReturn} />
          </div>
          <p className="mt-5 pt-4 text-[10px] leading-relaxed text-muted border-t border-hairline">Constant return, no contributions, fees, taxes or inflation. This illustration does not model market volatility.</p>
        </section>
      </div>
    </section>
  );
}
