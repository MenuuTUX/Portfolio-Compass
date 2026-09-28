"use client";

import { useState, useMemo, useEffect } from "react";
import { PortfolioItem } from "@/types";
import {
  optimizePortfolioGreedy,
  GreedyOptimizationResult,
  calculatePortfolioUtility,
  getOptimizerInputGaps,
  riskPenaltyForProfile,
} from "@/lib/optimizer";
import {
  DollarSign,
  TrendingDown,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { Decimal } from "@/lib/decimal";
import { estimateAnnualCovariance } from "@/lib/math/covariance";
import {
  getAssetBeta,
  getAssetYieldFraction,
} from "@/lib/math/portfolio-returns";

interface OptimizationPanelProps {
  portfolio: PortfolioItem[];
  onCalibrating?: (isCalibrating: boolean) => void;
}

type StrategyMode = "Conservative" | "Balanced" | "Growth";
const STRATEGY_MODES = ["Conservative", "Balanced", "Growth"] as const;
const RISK_PROFILE_BY_STRATEGY = {
  Conservative: "conservative",
  Balanced: "balanced",
  Growth: "growth",
} as const;

export default function OptimizationPanel({
  portfolio,
  onCalibrating,
}: OptimizationPanelProps) {
  const [investmentAmount, setInvestmentAmount] = useState<number>(7000);
  const [result, setResult] = useState<GreedyOptimizationResult | null>(null);
  const [proposedShares, setProposedShares] = useState<Record<string, number>>(
    {},
  );
  const [strategyMode, setStrategyMode] = useState<StrategyMode>("Balanced");
  const covariance = useMemo(() => estimateAnnualCovariance(portfolio), [portfolio]);
  const candidates = useMemo(
    () => portfolio.map((p) => ({
      ticker: p.ticker,
      price: p.price,
      // Return proxy used by this allocator, not a forecast.
      expectedReturn: getAssetYieldFraction(p) + getAssetBeta(p) * 0.06,
    })),
    [portfolio],
  );
  const riskProfile = RISK_PROFILE_BY_STRATEGY[strategyMode];
  const lambda = riskPenaltyForProfile(riskProfile);
  const missingInputTickers = useMemo(() => getOptimizerInputGaps(portfolio), [portfolio]);
  const currency = portfolio[0]?.currency;

  // Debounced calculation for initial recommendation
  useEffect(() => {
    if (portfolio.length < 2 || missingInputTickers.length > 0) {
      const timer = setTimeout(() => {
        setResult(null);
        setProposedShares({});
        onCalibrating?.(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    onCalibrating?.(true);
    const timer = setTimeout(() => {
      if (portfolio.length > 0) {
        // Calculate current portfolio value to determine remaining budget
        let currentPortfolioValue = 0;
        portfolio.forEach((p) => {
          currentPortfolioValue += (p.price || 0) * (p.shares || 0);
        });

        const effectiveBudget = Math.max(
          0,
          investmentAmount - currentPortfolioValue,
        );

        // Sample covariance from aligned price history when the holdings have
        // enough overlap, else a single-index matrix built from beta. Either
        // way the off-diagonals are populated: with them zeroed, two funds
        // tracking the same index looked like genuine diversification.
        const res = optimizePortfolioGreedy({
          candidates,
          covarianceMatrix: covariance.matrix,
          riskProfile,
          budget: effectiveBudget,
          initialShares: Object.fromEntries(
            portfolio.map((p) => [p.ticker, p.shares || 0]),
          ),
        });

        setResult(res);
        setProposedShares(res.addedShares);
      }
      onCalibrating?.(false);
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [investmentAmount, portfolio, onCalibrating, strategyMode, candidates, covariance, riskProfile, missingInputTickers]);

  // Ensure calibration state is reset on unmount
  useEffect(() => {
    return () => onCalibrating?.(false);
  }, [onCalibrating]);

  const projectedMetrics = useMemo(() => {
    if (!result) return null;

    let futureTotalValue = new Decimal(0);
    const futureShares: Record<string, number> = {};

    portfolio.forEach((p) => {
      const added = proposedShares[p.ticker] || 0;
      const total = (p.shares || 0) + added;
      futureShares[p.ticker] = total;
      futureTotalValue = futureTotalValue.plus(
        new Decimal(p.price || 0).times(total),
      );
    });

    const newWeights: Record<string, number> = {};
    if (!futureTotalValue.isZero()) {
      portfolio.forEach((p) => {
        const s = futureShares[p.ticker] || 0;
        const val = new Decimal(p.price || 0).times(s);
        newWeights[p.ticker] = val.div(futureTotalValue).times(100).toNumber();
      });
    }

    return { newWeights, futureTotalValue, futureShares };
  }, [portfolio, proposedShares, result]);

  const modelScores = useMemo(() => {
    const currentShares = portfolio.map((item) => item.shares || 0);
    const proposalShares = portfolio.map(
      (item) => (item.shares || 0) + (proposedShares[item.ticker] || 0),
    );
    return {
      current: calculatePortfolioUtility(candidates, covariance.matrix, lambda, currentShares),
      proposal: calculatePortfolioUtility(candidates, covariance.matrix, lambda, proposalShares),
    };
  }, [portfolio, proposedShares, candidates, covariance, lambda]);

  if (!result || !projectedMetrics)
    return (
      <div className="rounded-card border border-hairline bg-surface-card p-6 text-body">
        {portfolio.length < 2 ? (
          <>
            <p className="font-semibold text-ink">Allocation score unavailable</p>
            <p className="mt-2">{portfolio.length === 0
              ? "Add at least two assets to compare allocations."
              : "Add a second asset to compare allocations. Buying more of one asset leaves its model weight at 100%, so this score cannot evaluate that purchase. Use the simple contribution scenario to model an added amount."}</p>
          </>
        ) : missingInputTickers.length > 0 ? (
          <>
            <p className="font-semibold text-ink">Experimental score unavailable</p>
            <p className="mt-2">An issuer-sourced yield or reported beta is missing for {missingInputTickers.join(", ")}. Yahoo quote yield is unverified and cannot qualify this score.</p>
          </>
        ) : (
          "Calculating allocation..."
        )}
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-surface-card backdrop-blur-md border border-hairline rounded-xl overflow-hidden relative">
      {/* Header */}
      <div className="p-6 border-b border-hairline bg-black/5">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Activity className="w-5 h-5" />
            <h2 className="font-bold text-lg tracking-wide uppercase">
              Heuristic Allocator
            </h2>
          </div>

          <p className="text-sm leading-6 text-body">
            Experimental score only. It uses issuer yield, reported beta × 6%,
            and estimated annual covariance. These inputs are proxies, not
            forecasts or a recommendation.{" "}
            {covariance.source === "history"
              ? `The covariance uses ${covariance.samples} overlapping daily returns.`
              : "The covariance uses a beta-based estimate because the holdings lack enough overlapping price history."}
          </p>

          <div className="text-sm font-medium text-body">
            Risk penalty
          </div>
          <div className="flex gap-2 flex gap-2 bg-dune/30 p-1 rounded-lg border border-hairline">
            {STRATEGY_MODES.map((mode) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={strategyMode === mode}
                  onClick={() => setStrategyMode(mode)}
                  className={cn(
                    "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                    strategyMode === mode
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_-3px_rgba(16,185,129,0.3)]"
                      : "text-neutral-500 hover:text-neutral-300 hover:bg-surface-soft",
                  )}
                >
                  {mode}
                </button>
              ))}
          </div>
        </div>

        <div className="relative">
          <label htmlFor="optimizer-portfolio-cap" className="text-right text-[10px] text-neutral-500 mt-1 mr-1">
            Maximum portfolio value for this comparison
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <DollarSign className="h-5 w-5 text-muted" />
            </div>
            <input
              id="optimizer-portfolio-cap"
              type="number"
              value={investmentAmount}
              onChange={(e) => {
                const next = Number(e.target.value);
                setInvestmentAmount(Number.isFinite(next) ? Math.max(0, next) : 0);
              }}
              className="block w-full pl-12 pr-4 py-4 bg-dune/30 border border-hairline rounded-lg text-2xl font-bold text-white placeholder-neutral-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
              placeholder="0.00"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
              {currency}
            </span>
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-neutral-500">
          <span>
            Proposed portfolio value: {formatCurrency(projectedMetrics.futureTotalValue, currency)}
          </span>
          <span>Cap: {formatCurrency(investmentAmount, currency)}</span>
        </div>
        <div className="mt-1 text-right text-xs text-neutral-500">
          Unallocated cash under cap: {formatCurrency(
            Math.max(0, investmentAmount - projectedMetrics.futureTotalValue.toNumber()),
            currency,
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          The model can leave cash unallocated when no affordable purchase improves its allocation score.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        <section>
          <div className="flex justify-between items-end mb-3">
            <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-ink" />
              Model Score
            </h3>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Current portfolio</span>
                <span className="text-emerald-400 font-bold">
                  {modelScores.current.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Model candidate score</span>
                <span className="text-emerald-400 font-bold">
                  {modelScores.proposal.toFixed(4)}
                </span>
              </div>
              <p className="text-sm leading-5 text-body">
                Unitless scores are comparable only under these same heuristic inputs. No trade can be applied from this panel.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-neutral-300 mb-3">
            Illustrative share mix
          </h3>
          <div className="space-y-2">
            {portfolio.map((item) => {
              const sharesToAdd = proposedShares[item.ticker] || 0;
              const newWeight =
                projectedMetrics.newWeights[item.ticker] || item.weight;

              return (
                <motion.div
                  key={item.ticker}
                  layout
                  className="p-3 bg-surface-card border border-hairline rounded-lg flex flex-col gap-3 group hover:bg-surface-soft transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-ink">{item.ticker}</span>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "text-sm font-mono w-6 text-center",
                          sharesToAdd > 0
                            ? "text-emerald-400 font-bold"
                            : sharesToAdd < 0
                              ? "text-emerald-400 font-bold"
                              : "text-neutral-500",
                        )}
                      >
                        {sharesToAdd > 0 ? `+${sharesToAdd}` : sharesToAdd}
                      </span>
                    </div>
                  </div>

                  {/* Weight Slider Visualization */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-500 uppercase tracking-wider">
                      <span>Weight</span>
                      <span className="text-ink">
                        {newWeight.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-dune/30 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-emerald-500"
                        initial={false}
                        animate={{ width: `${newWeight}%` }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4 border-t border-hairline bg-canvas p-6">
        <p className="text-sm leading-5 text-body">
          This experimental result is for inspection only. Apply is unavailable
          while expected returns and fallback correlations remain heuristic.
        </p>
      </div>
    </div>
  );
}
