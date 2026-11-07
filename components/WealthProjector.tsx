"use client";

import { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { Portfolio } from "@/types";
import { m as motion } from "framer-motion";
import { ArrowLeft, Sparkles, RefreshCw } from "lucide-react";
import MonteCarloSimulator from "./simulation/MonteCarloSimulator";
import SimulatorExplainer from "./simulation/SimulatorExplainer";
import {
  getPortfolioMarketValue,
  getPortfolioCurrency,
  gainOnInvestedPercent,
  type BankOfCanadaFxRate,
} from "@/lib/math/portfolio-returns";
import { projectContributionScenario } from "@/lib/math/scenario";
import { PortfolioShareButton } from "./PortfolioShareButton";
import { GAIN, HAIRLINE, HAIRLINE_STRONG, MUTED } from "@/lib/chart-colors";
import { horizonYearsFromAge, loadRiskProfile } from "@/lib/risk-profile";
import { fxSourceLabel } from "@/lib/fx-copy";
import { EASE } from "./motion/Reveal";

const NOTE = "Started from your quiz answers";

/** The quiz answers that seed the projector, or null when none were saved. */
function readQuizPrefill(): { monthlyContribution?: number; goalInput?: string; years?: number } | null {
  const saved = loadRiskProfile();
  if (!saved) return null;
  const prefill: { monthlyContribution?: number; goalInput?: string; years?: number } = {};
  if (saved.monthlyContribution !== undefined) prefill.monthlyContribution = saved.monthlyContribution;
  if (saved.goalAmount !== undefined && saved.goalAmount > 0) prefill.goalInput = String(saved.goalAmount);
  if (saved.ageBand) prefill.years = horizonYearsFromAge(saved.ageBand);
  return Object.keys(prefill).length > 0 ? prefill : null;
}

interface WealthProjectorProps {
  portfolio: Portfolio;
  startingValue?: number;
  baseCurrency?: string;
  fxProvenance?: BankOfCanadaFxRate;
  onBack?: () => void;
}

export default function WealthProjector({
  portfolio,
  startingValue,
  baseCurrency,
  fxProvenance,
  onBack,
}: WealthProjectorProps) {
  const [mode, setMode] = useState<"SIMPLE" | "MONTE_CARLO">("SIMPLE");
  const currency = baseCurrency ?? getPortfolioCurrency(portfolio) ?? undefined;
  const mixedCurrency = new Set(portfolio.filter((item) => item.shares > 0).map((item) => item.currency)).size > 1;

  const currentPortfolioValue = useMemo(
    () => startingValue ?? getPortfolioMarketValue(portfolio),
    [portfolio, startingValue],
  );

  // Use the actual held value, including zero, rather than seed a fictitious balance.
  const [initialInvestment, setInitialInvestment] = useState<number>(() => {
    return Number.isFinite(currentPortfolioValue) && currentPortfolioValue >= 0
      ? currentPortfolioValue
      : 0;
  });
  const [startingBalanceEdited, setStartingBalanceEdited] = useState(false);

  // Start from the quiz answers once, on the first render. Later edits are never overwritten.
  const [quizPrefill] = useState(readQuizPrefill);
  const prefilled = quizPrefill !== null;

  const [monthlyContribution, setMonthlyContribution] = useState<number>(quizPrefill?.monthlyContribution ?? 500);
  const [years, setYears] = useState<number>(quizPrefill?.years ?? 20);
  const [annualReturnInput, setAnnualReturnInput] = useState("7");
  const enteredReturn = Number(annualReturnInput);
  const annualReturnAssumption = Number.isFinite(enteredReturn)
    ? Math.max(-0.99, Math.min(1, enteredReturn / 100))
    : 0;

  // Monte Carlo only inputs. Inflation 0 means off; an empty goal means none.
  const [inflationPercent, setInflationPercent] = useState<number>(2);
  const [goalInput, setGoalInput] = useState(quizPrefill?.goalInput ?? "");
  const goalValue = Number(goalInput);
  const goalAmount = goalInput.trim() !== "" && Number.isFinite(goalValue) && goalValue > 0
    ? goalValue
    : undefined;


  // Follow quote updates until the user enters their own starting balance.
  // Object.is treats NaN as equal to itself, so a NaN value cannot loop renders.
  const hasCurrentValue = Number.isFinite(currentPortfolioValue) && currentPortfolioValue >= 0;
  const [prevPortfolioValue, setPrevPortfolioValue] = useState(
    currentPortfolioValue,
  );
  if (!Object.is(currentPortfolioValue, prevPortfolioValue)) {
    setPrevPortfolioValue(currentPortfolioValue);
    if (hasCurrentValue && !startingBalanceEdited) {
      setInitialInvestment(currentPortfolioValue);
    }
  }

  // Amounts past this are not meaningful to project and can overflow to Infinity.
  const MAX_AMOUNT = 1_000_000_000_000;
  const amountTooLarge = [initialInvestment, monthlyContribution]
    .some((v) => !Number.isFinite(v) || v > MAX_AMOUNT);

  const projectionData = useMemo(
    () => amountTooLarge ? [] : projectContributionScenario(
      initialInvestment, monthlyContribution, years, annualReturnAssumption,
    ),
    [amountTooLarge, initialInvestment, monthlyContribution, years, annualReturnAssumption],
  );

  const finalAmount =
    projectionData.length > 0
      ? projectionData[projectionData.length - 1].balance
      : 0;
  const totalInvested =
    projectionData.length > 0
      ? projectionData[projectionData.length - 1].invested
      : 0;
  const modeledGain = finalAmount - totalInvested;

  // Gain relative to all paid-in capital, not contributions mistaken for growth.
  const percentageGrowth = gainOnInvestedPercent(finalAmount, totalInvested);

  if (!Number.isFinite(currentPortfolioValue) || !currency ||
    (mixedCurrency && (!fxProvenance || !Number.isFinite(fxProvenance.usdCad) || fxProvenance.usdCad <= 0))) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-12" role="status">
        <h2 className="text-2xl font-semibold text-ink">Scenario unavailable</h2>
        <p className="mt-3 text-muted">
          {mixedCurrency
            ? "A mixed-currency starting balance needs a fresh, dated USD/CAD rate and valid quotes for every held asset."
            : "Add a holding with a valid price and currency. Every held asset needs a valid quote before its value can be used as the starting balance."}
        </p>
      </section>
    );
  }

  if (mode === "MONTE_CARLO") {
    return (
      <section className="py-12 px-4 max-w-7xl mx-auto h-full overflow-y-auto">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setMode("SIMPLE")}
            className="text-sm text-muted hover:text-ink underline"
          >
            Switch to Simple Projection
          </button>
        </div>
        {prefilled && <p className="mb-4 text-xs text-muted">{NOTE}</p>}
        <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
          <div>
            <label htmlFor="mc-monthly-contribution" className="text-sm text-muted block mb-2">
              Monthly Contribution ({currency})
            </label>
            <input
              id="mc-monthly-contribution"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(Math.max(0, Number(e.target.value) || 0))}
              className="w-full bg-surface-soft border border-hairline rounded-lg px-3 py-2 text-ink focus:border-hairline focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="mc-inflation" className="text-sm text-muted block mb-2">
              Inflation (%)
            </label>
            <input
              id="mc-inflation"
              type="number"
              min={0}
              step="0.1"
              inputMode="decimal"
              value={inflationPercent}
              onChange={(e) => setInflationPercent(Math.max(0, Number(e.target.value) || 0))}
              className="w-full bg-surface-soft border border-hairline rounded-lg px-3 py-2 text-ink focus:border-hairline focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="mc-goal" className="text-sm text-muted block mb-2">
              Goal Amount ({currency})
            </label>
            <input
              id="mc-goal"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder="Optional"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="w-full bg-surface-soft border border-hairline rounded-lg px-3 py-2 text-ink focus:border-hairline focus:outline-none"
            />
          </div>
        </div>
        {amountTooLarge ? (
          <p role="status" className="text-muted">Enter an amount below 1,000,000,000,000</p>
        ) : initialInvestment <= 0 ? (
          <p role="status" className="text-muted">Enter a starting balance above 0</p>
        ) : (
          <MonteCarloSimulator
            portfolio={portfolio}
            baseCurrency={currency}
            startingValue={initialInvestment}
            monthlyContribution={monthlyContribution}
            inflationPercent={inflationPercent}
            goalAmount={goalAmount}
            fxProvenance={mixedCurrency ? fxProvenance : undefined}
            onBack={onBack}
          />
        )}
      </section>
    );
  }

  return (
    <section className="w-full ws-panel bg-surface-card rounded-lg ring-1 ring-hairline px-4 md:px-8 py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <div className="mb-12 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-1 basis-80 items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="w-11 h-11 md:w-9 md:h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-soft text-muted hover:text-ink transition-colors"
                title="Back to Portfolio"
                aria-label="Back to Portfolio"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div>
              <h2 className="text-[32px] font-bold text-ink mb-2">
                Growth Projection
              </h2>
              <p className="text-muted">
                See how a starting balance and monthly contributions compound
                under a return assumption you choose. The starting balance uses
                the current value of held shares when available.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <PortfolioShareButton
              portfolio={portfolio}
              currency={currency}
              fxProvenance={mixedCurrency ? fxProvenance : undefined}
              metrics={{
                totalValue: currentPortfolioValue,
                annualReturn: annualReturnAssumption,
                projectedValue: finalAmount,
                totalInvested: totalInvested,
                dividends: null,
                years: years,
                scenario: "Simple Projection",
                growthType: "Simple",
                percentageGrowth: percentageGrowth,
              }}
              history={projectionData.map((d) => ({
                date: d.year,
                value: d.balance,
              }))}
            />

            <button
              onClick={() => setMode("MONTE_CARLO")}
              className="flex items-center gap-2 whitespace-nowrap px-4 py-2 bg-surface-soft hover:bg-hairline-strong rounded-full font-medium transition-colors duration-75 min-h-[44px] md:min-h-0"
            >
              <Sparkles className="w-4 h-4" />
              Use Monte Carlo model
            </button>
          </div>
        </div>
        {prefilled && <p className="mb-6 text-xs text-muted">{NOTE}</p>}
        {fxProvenance && mixedCurrency && (
          <p className="mb-6 text-xs text-muted">
            Starting value converted to {currency} using {fxSourceLabel(fxProvenance.date)} ({fxProvenance.usdCad} CAD per USD). Future FX changes are not modeled.
          </p>
        )}
        {mixedCurrency && (
          <p className="mb-6 text-xs text-muted">
            Monte Carlo converts historical USD prices to CAD using dated Bank of Canada daily FX averages. Future exchange rate changes are excluded; simulated results remain illustrative model assumptions.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12">
          <div className="p-6 rounded-2xl space-y-6 h-fit bg-surface-card ring-1 ring-hairline">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="initial-investment"
                  className="text-sm text-muted block"
                >
                  Starting Balance ({currency})
                </label>
                {Number.isFinite(currentPortfolioValue) && currentPortfolioValue >= 0 &&
                  initialInvestment !== currentPortfolioValue && (
                    <button
                      onClick={() => {
                        setInitialInvestment(currentPortfolioValue);
                        setStartingBalanceEdited(false);
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-400 flex items-center gap-1"
                      title="Reset to current portfolio value"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Sync
                    </button>
                  )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted">
                  {currency}
                </span>
                <input
                  id="initial-investment"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={initialInvestment}
                  onChange={(e) => {
                    setInitialInvestment(Math.max(0, Number(e.target.value) || 0));
                    setStartingBalanceEdited(true);
                  }}
                  className="w-full bg-surface-soft border border-hairline rounded-lg pl-14 pr-4 py-2 text-ink focus:border-hairline focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="monthly-contribution"
                className="text-sm text-muted block mb-2"
              >
                Monthly Contribution ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted">
                  {currency}
                </span>
                <input
                  id="monthly-contribution"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={monthlyContribution}
                  onChange={(e) =>
                    setMonthlyContribution(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full bg-surface-soft border border-hairline rounded-lg pl-14 pr-4 py-2 text-ink focus:border-hairline focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="time-horizon"
                className="text-sm text-muted block mb-2"
              >
                Time Horizon (Years): {years}
              </label>
              <input
                id="time-horizon"
                type="range"
                min="5"
                max="50"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full accent-[var(--compass)]"
              />
            </div>

            <div>
              <label
                htmlFor="annual-return-assumption"
                className="text-sm text-muted block mb-2"
              >
                Assumed Annual Total Return (%)
              </label>
              <input
                id="annual-return-assumption"
                type="number"
                min="-99"
                max="100"
                step="0.1"
                value={annualReturnInput}
                onChange={(e) => setAnnualReturnInput(e.target.value)}
                onBlur={() => setAnnualReturnInput(String(+(annualReturnAssumption * 100).toFixed(4)))}
                className="w-full bg-surface-soft border border-hairline rounded-lg px-3 py-2 text-ink focus:border-hairline focus:outline-none"
              />
            </div>

            <div className="pt-6 border-t border-hairline space-y-4">
              <div>
                <div className="text-sm text-muted mb-1">
                  Assumed Annual Total Return
                </div>
                <div className="text-base font-bold text-ink tabular-nums">
                  {(annualReturnAssumption * 100).toFixed(2)}%
                </div>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                This is a constant nominal total-return assumption, not a
                forecast. Contributions are added at the start of each month.
                Enter a return after fees if you want fees included. Inflation,
                taxes, and dividends are not modeled separately.
              </p>
            </div>
          </div>

          <div className="lg:col-span-3 p-6 rounded-2xl flex flex-col bg-surface-card ring-1 ring-hairline">
            {amountTooLarge && (
              <p role="status" className="mb-6 text-muted">Enter an amount below 1,000,000,000,000</p>
            )}
            {!amountTooLarge && (<>
            <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-x-6 gap-y-4">
              <div>
                <div className="text-sm text-muted">
                  Ending Balance Under Assumptions
                </div>
                <div className="text-2xl font-bold text-ink tabular-nums break-words xl:text-3xl">
                  {formatCurrency(finalAmount, currency)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted">
                  Modeled Gain or Loss
                </div>
                <div className="text-2xl font-bold text-body-strong tabular-nums break-words xl:text-3xl">
                  {formatCurrency(modeledGain, currency)}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  Ending balance minus starting balance and contributions
                </div>
              </div>
              <div>
                <div className="text-sm text-muted">Total Invested</div>
                <div className="text-xl font-medium text-neutral-300 tabular-nums break-words">
                  {formatCurrency(totalInvested, currency)}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GAIN} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={GAIN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={HAIRLINE}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="year"
                    stroke={HAIRLINE_STRONG}
                    tick={{ fill: MUTED, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={HAIRLINE_STRONG}
                    tick={{ fill: MUTED, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={88}
                    tickFormatter={(value) => `${currency} ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface-card)",
                      borderColor: "var(--hairline)",
                      color: "var(--ink)",
                    }}
                    formatter={(value) => formatCurrency(Number(value), currency)}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    name="Balance Under Assumptions"
                    stroke={GAIN}
                    fillOpacity={1}
                    fill="url(#colorBalance)"
                    animationDuration={1100}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    name="Total Invested"
                    stroke={MUTED}
                    strokeDasharray="5 5"
                    fill="transparent"
                    animationBegin={200}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <table className="sr-only">
                <caption>Growth Projection</caption>
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Balance Under Assumptions</th>
                    <th scope="col">Total Invested</th>
                    <th scope="col">Modeled Gain or Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {projectionData.map((item, index) => (
                    <tr key={index}>
                      <td>{item.year}</td>
                      <td>{formatCurrency(item.balance, currency)}</td>
                      <td>{formatCurrency(item.invested, currency)}</td>
                      <td>{formatCurrency(item.gain, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>)}
          </div>
        </div>

        <div className="mb-12">
          <SimulatorExplainer mode="SIMPLE" />
        </div>
      </motion.div>
    </section>
  );
}
