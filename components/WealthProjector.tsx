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
import { calculatePortfolioHistoricalStats } from "@/lib/math/portfolio-stats";
import {
  getPortfolioMarketValue,
  getPortfolioDividendYield,
  getEffectiveWeights,
  estimateAssetTotalReturn,
} from "@/lib/math/portfolio-returns";
import { PortfolioShareButton } from "./PortfolioShareButton";

interface WealthProjectorProps {
  portfolio: Portfolio;
  onBack?: () => void;
}

export default function WealthProjector({
  portfolio,
  onBack,
}: WealthProjectorProps) {
  const [mode, setMode] = useState<"SIMPLE" | "MONTE_CARLO">("SIMPLE");

  // Market value from *all* holdings (shares × price)
  const currentPortfolioValue = useMemo(
    () => getPortfolioMarketValue(portfolio),
    [portfolio],
  );

  // Simple Projection Logic
  // Initialize with portfolio value if > 0, else 10000
  const [initialInvestment, setInitialInvestment] = useState<number>(() => {
    return currentPortfolioValue > 0 ? currentPortfolioValue : 10000;
  });

  const [monthlyContribution, setMonthlyContribution] = useState<number>(500);
  const [years, setYears] = useState<number>(20);

  // Sync initialInvestment with portfolio value if it loads later and we are
  // still at the default (adjust-state-during-render instead of an effect)
  const [prevPortfolioValue, setPrevPortfolioValue] = useState(
    currentPortfolioValue,
  );
  if (currentPortfolioValue !== prevPortfolioValue) {
    setPrevPortfolioValue(currentPortfolioValue);
    if (currentPortfolioValue > 0 && initialInvestment === 10000) {
      setInitialInvestment(currentPortfolioValue);
    }
  }

  // Weighted dividend yield across ALL assets (value weights preferred)
  const weightedYield = useMemo(
    () => getPortfolioDividendYield(portfolio),
    [portfolio],
  );

  // Estimated annual return, including reinvested dividends.
  // calculatePortfolioHistoricalStats already folds yield into total return.
  const weightedReturn = useMemo(() => {
    if (portfolio.length === 0) return 0.07;

    const hasHistory = portfolio.some(
      (p) => p.history && p.history.length > 30,
    );
    if (hasHistory) {
      try {
        const stats = calculatePortfolioHistoricalStats(portfolio);
        if (stats.annualizedReturn !== 0) return stats.annualizedReturn;
      } catch (e) {
        console.warn("Failed to calc historical stats for simple projection", e);
      }
    }

    // Fall back to a weighted heuristic when price history is unavailable.
    const weights = getEffectiveWeights(portfolio);
    return portfolio.reduce((acc, item, i) => {
      return acc + estimateAssetTotalReturn(item) * weights[i];
    }, 0);
  }, [portfolio]);

  // Deterministic monthly compound projection.
  // Balance grows at *total* return (includes reinvested dividends).
  // "Accumulated Dividends" is the income component for display only;
  // it is already embedded in the ending balance, not added on top.
  const projectionData = useMemo(() => {
    let balance = initialInvestment;
    let accumulatedDividends = 0;
    const data: {
      year: string;
      balance: number;
      invested: number;
      dividends: number;
      value: number;
      dividendValue: number;
    }[] = [];

    const monthlyRate = weightedReturn / 12;
    const monthlyYieldRate = weightedYield / 12;

    for (let i = 0; i <= years * 12; i++) {
      if (i % 12 === 0) {
        data.push({
          year: `Y${i / 12}`,
          balance: Math.round(balance),
          invested: initialInvestment + monthlyContribution * i,
          dividends: Math.round(accumulatedDividends),
          value: Math.round(balance),
          dividendValue: Math.round(accumulatedDividends),
        });
      }

      // Dividend income is reinvested and already included in total return.
      const monthlyDividend = balance * monthlyYieldRate;
      accumulatedDividends += monthlyDividend;

      // Compound at total return (price + yield)
      balance = (balance + monthlyContribution) * (1 + monthlyRate);
    }

    return data;
  }, [initialInvestment, monthlyContribution, years, weightedReturn, weightedYield]);

  const finalAmount =
    projectionData.length > 0
      ? projectionData[projectionData.length - 1].balance
      : 0;
  const totalInvested =
    projectionData.length > 0
      ? projectionData[projectionData.length - 1].invested
      : 0;
  const totalDividends =
    projectionData.length > 0
      ? projectionData[projectionData.length - 1].dividends
      : 0;

  // Percentage Growth Calculation
  const percentageGrowth =
    initialInvestment > 0
      ? ((finalAmount - initialInvestment) / initialInvestment) * 100
      : 0;

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
        <MonteCarloSimulator portfolio={portfolio} onBack={onBack} />
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
                under the app&apos;s return estimate.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PortfolioShareButton
              portfolio={portfolio}
              metrics={{
                totalValue: currentPortfolioValue,
                annualReturn: weightedReturn,
                yield: weightedYield,
                projectedValue: finalAmount,
                totalInvested: totalInvested,
                dividends: totalDividends,
                years: years,
                scenario: "Simple Projection",
                growthType: "Simple",
                percentageGrowth: percentageGrowth,
              }}
              history={projectionData.map((d) => ({
                date: d.year,
                value: d.balance,
                dividendValue: d.dividends,
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12">
          {/* Controls */}
          <div className="glass-panel p-6 rounded-xl space-y-6 h-fit bg-surface-card border border-hairline">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="initial-investment"
                  className="text-sm text-neutral-400 block"
                >
                  Starting Balance
                </label>
                {currentPortfolioValue > 0 &&
                  initialInvestment !== currentPortfolioValue && (
                    <button
                      onClick={() =>
                        setInitialInvestment(currentPortfolioValue)
                      }
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
                  $
                </span>
                <input
                  id="initial-investment"
                  type="number"
                  value={initialInvestment}
                  onChange={(e) => setInitialInvestment(Number(e.target.value))}
                  className="w-full bg-black/50 border border-hairline rounded-lg pl-8 pr-4 py-2 text-ink focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="monthly-contribution"
                className="text-sm text-neutral-400 block mb-2"
              >
                Monthly Contribution
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400">
                  $
                </span>
                <input
                  id="monthly-contribution"
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) =>
                    setMonthlyContribution(Number(e.target.value))
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

            <div className="pt-6 border-t border-hairline space-y-4">
              <div>
                <div className="text-sm text-neutral-400 mb-1">
                  Annual Return Estimate
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                  {(weightedReturn * 100).toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-400 mb-1">
                  Avg. Dividend Yield
                </div>
                <div className="text-xl font-bold text-blue-400">
                  {(weightedYield * 100).toFixed(2)}%
                </div>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Based on available price history. When history is missing, the
                app uses a weighted yield-and-growth heuristic.
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
                  {formatCurrency(finalAmount)}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">
                  Estimated Dividends
                </div>
                <div className="text-3xl font-bold text-blue-400">
                  {formatCurrency(totalDividends)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Reinvested and included in the ending balance
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm text-neutral-400">Total Invested</div>
                <div className="text-xl font-medium text-neutral-300">
                  {formatCurrency(totalInvested)}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient
                      id="colorBalance"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
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
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface-card)",
                      borderColor: "var(--hairline)",
                      color: "var(--ink)",
                    }}
                    formatter={(value: any) => formatCurrency(Number(value))}
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
                  <Area
                    type="monotone"
                    dataKey="dividends"
                    name="Accumulated Dividends"
                    stroke="#60a5fa"
                    strokeWidth={2}
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
                    <th scope="col">Accumulated Dividends</th>
                  </tr>
                </thead>
                <tbody>
                  {projectionData.map((item, index) => (
                    <tr key={index}>
                      <td>{item.year}</td>
                      <td>{formatCurrency(item.balance)}</td>
                      <td>{formatCurrency(item.invested)}</td>
                      <td>{formatCurrency(item.dividends)}</td>
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
