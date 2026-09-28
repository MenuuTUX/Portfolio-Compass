"use client";

import { useState, useMemo } from "react";
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
import { motion } from "framer-motion";
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

  // Market value from *all* holdings (shares × price)
  const currentPortfolioValue = useMemo(
    () => startingValue ?? getPortfolioMarketValue(portfolio),
    [portfolio, startingValue],
  );

  // Simple Projection Logic
  // Use the actual held value, including zero, rather than seed a fictitious balance.
  const [initialInvestment, setInitialInvestment] = useState<number>(() => {
    return Number.isFinite(currentPortfolioValue) && currentPortfolioValue >= 0
      ? currentPortfolioValue
      : 0;
  });
  const [startingBalanceEdited, setStartingBalanceEdited] = useState(false);

  const [monthlyContribution, setMonthlyContribution] = useState<number>(500);
  const [years, setYears] = useState<number>(20);
  const [annualReturnInput, setAnnualReturnInput] = useState("7");
  const enteredReturn = Number(annualReturnInput);
  const annualReturnAssumption = Number.isFinite(enteredReturn)
    ? Math.max(-0.99, Math.min(1, enteredReturn / 100))
    : 0;

  // Follow quote updates until the user enters their own starting balance.
  const [prevPortfolioValue, setPrevPortfolioValue] = useState(
    currentPortfolioValue,
  );
  if (currentPortfolioValue !== prevPortfolioValue) {
    setPrevPortfolioValue(currentPortfolioValue);
    if (Number.isFinite(currentPortfolioValue) && currentPortfolioValue >= 0 && !startingBalanceEdited) {
      setInitialInvestment(currentPortfolioValue);
    }
  }

  const projectionData = useMemo(
    () => projectContributionScenario(
      initialInvestment, monthlyContribution, years, annualReturnAssumption,
    ),
    [initialInvestment, monthlyContribution, years, annualReturnAssumption],
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
        <p className="mt-3 text-neutral-400">
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
            className="text-sm text-neutral-400 hover:text-ink underline"
          >
            Switch to Simple Projection
          </button>
        </div>
        <MonteCarloSimulator
          portfolio={portfolio}
          baseCurrency={currency}
          startingValue={initialInvestment}
          fxProvenance={mixedCurrency ? fxProvenance : undefined}
          onBack={onBack}
        />
      </section>
    );
  }

  return (
    <section className="py-24 px-4 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-full hover:bg-surface-soft text-neutral-400 hover:text-ink transition-colors"
                title="Back to Portfolio"
                aria-label="Back to Portfolio"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div>
              <h2 className="text-3xl font-bold text-ink mb-2">
                Growth Projection
              </h2>
              <p className="text-neutral-400">
                See how a starting balance and monthly contributions compound
                under a return assumption you choose. The starting balance uses
                the current value of held shares when available.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-purple-900/20 border border-hairline"
            >
              <Sparkles className="w-4 h-4" />
              Use Monte Carlo model
            </button>
          </div>
        </div>
        {fxProvenance && mixedCurrency && (
          <p className="mb-6 text-xs text-neutral-500">
            Starting value converted to {currency} using Bank of Canada FXUSDCAD daily average dated {fxProvenance.date} ({fxProvenance.usdCad} CAD per USD). Future FX changes are not modeled.
          </p>
        )}
        {mixedCurrency && (
          <p className="mb-6 text-xs text-neutral-500">
            Monte Carlo converts historical USD prices to CAD using dated Bank of Canada daily FX averages. Future exchange rate changes are excluded; simulated results remain illustrative price-only model assumptions.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12">
          {/* Controls */}
          <div className="glass-panel p-6 rounded-xl space-y-6 h-fit bg-surface-card border border-hairline">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="initial-investment"
                  className="text-sm text-neutral-400 block"
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
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      title="Reset to current portfolio value"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Sync
                    </button>
                  )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400">
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
                  className="w-full bg-black/50 border border-hairline rounded-lg pl-8 pr-4 py-2 text-ink focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="monthly-contribution"
                className="text-sm text-neutral-400 block mb-2"
              >
                Monthly Contribution ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400">
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
                  className="w-full bg-black/50 border border-hairline rounded-lg pl-8 pr-4 py-2 text-ink focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="time-horizon"
                className="text-sm text-neutral-400 block mb-2"
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
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="annual-return-assumption"
                className="text-sm text-neutral-400 block mb-2"
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
                onBlur={() => setAnnualReturnInput(String(annualReturnAssumption * 100))}
                className="w-full bg-black/50 border border-hairline rounded-lg px-3 py-2 text-ink focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="pt-6 border-t border-hairline space-y-4">
              <div>
                <div className="text-sm text-neutral-400 mb-1">
                  Assumed Annual Total Return
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                  {(annualReturnAssumption * 100).toFixed(2)}%
                </div>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">
                This is a constant nominal total-return assumption, not a
                forecast. Contributions are added at the start of each month.
                Enter a return after fees if you want fees included. Inflation,
                taxes, and dividends are not modeled separately.
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-3 glass-panel p-6 rounded-xl flex flex-col bg-surface-card border border-hairline">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-sm text-neutral-400">
                  Ending Balance Under Assumptions
                </div>
                <div className="text-3xl font-bold text-ink">
                  {formatCurrency(finalAmount, currency)}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">
                  Modeled Gain or Loss
                </div>
                <div className="text-3xl font-bold text-blue-400">
                  {formatCurrency(modeledGain, currency)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Ending balance minus starting balance and contributions
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm text-neutral-400">Total Invested</div>
                <div className="text-xl font-medium text-neutral-300">
                  {formatCurrency(totalInvested, currency)}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#333"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="year"
                    stroke="#666"
                    tick={{ fill: "#666" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: "#666" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${currency} ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface-card)",
                      borderColor: "var(--hairline)",
                      color: "var(--ink)",
                    }}
                    formatter={(value: any) => formatCurrency(Number(value), currency)}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    name="Balance Under Assumptions"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorBalance)"
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    name="Total Invested"
                    stroke="#525252"
                    strokeDasharray="5 5"
                    fill="transparent"
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
          </div>
        </div>

        {/* Explainer Section */}
        <div className="mb-12">
          <SimulatorExplainer mode="SIMPLE" />
        </div>
      </motion.div>
    </section>
  );
}
