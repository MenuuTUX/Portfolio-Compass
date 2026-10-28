"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { PortfolioItem } from "@/types";
import {
  optimizePortfolioGreedy,
  GreedyOptimizationResult,
  calculatePortfolioUtility,
  getOptimizerInputGaps,
  riskPenaltyForProfile,
} from "@/lib/optimizer";
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
  const [runCount, setRunCount] = useState(0);
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
  }, [investmentAmount, portfolio, onCalibrating, strategyMode, candidates, covariance, riskProfile, missingInputTickers, runCount]);

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
      <div className="rounded-lg ring-1 ring-hairline bg-surface-card p-4 text-sm text-body">
        {portfolio.length < 2 ? (
          <>
            <p className="font-bold text-ink">Allocation score unavailable</p>
            <p className="mt-1 text-muted">{portfolio.length === 0
              ? "Add at least two assets to compare allocations."
              : "Add a second asset to compare allocations. Buying more of one asset leaves its model weight at 100%, so this score cannot evaluate that purchase. Use the simple contribution scenario to model an added amount."}</p>
          </>
        ) : missingInputTickers.length > 0 ? (
          <>
            <p className="font-bold text-ink">Experimental score unavailable</p>
            <p className="mt-1 text-muted">An issuer-sourced yield or reported beta is missing for {missingInputTickers.join(", ")}. Yahoo quote yield is unverified and cannot qualify this score.</p>
          </>
        ) : (
          "Calculating allocation..."
        )}
      </div>
    );

  return (
    <div className="flex flex-col bg-surface-card ring-1 ring-hairline rounded-lg overflow-hidden">
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-base font-bold text-ink">Optimize allocation</h2>
        <p className="text-sm leading-5 text-muted">
          Experimental score only. These inputs are proxies, not forecasts or a
          recommendation.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRunCount((n) => n + 1)}
            className="ws-pill"
          >
            Run optimizer
          </button>
          <div className="flex gap-1" role="group" aria-label="Risk penalty">
            {STRATEGY_MODES.map((mode) => (
              <button
                type="button"
                key={mode}
                aria-pressed={strategyMode === mode}
                onClick={() => setStrategyMode(mode)}
                className={cn(
                  "py-1.5 px-3 rounded-full text-xs min-h-[44px] md:min-h-0 font-medium transition-colors duration-75",
                  strategyMode === mode
                    ? "bg-surface-soft text-ink"
                    : "text-muted hover:text-body-strong hover:bg-surface-soft",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="optimizer-portfolio-cap" className="block text-xs text-muted mb-1">
            Maximum portfolio value for this comparison
          </label>
          <div className="relative">
            <input
              id="optimizer-portfolio-cap"
              type="number"
              value={investmentAmount}
              onChange={(e) => {
                const next = Number(e.target.value);
                setInvestmentAmount(Number.isFinite(next) ? Math.max(0, next) : 0);
              }}
              className="block w-full pl-4 pr-14 py-3 bg-surface-soft rounded-xl text-xl font-bold text-ink tabular-nums placeholder:text-muted-soft focus-visible:ring-2 focus-visible:ring-compass outline-none"
              placeholder="0.00"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
              {currency}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-hairline divide-y divide-hairline">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-ink">Current score</span>
          <span className="font-bold text-ink tabular-nums">{modelScores.current.toFixed(4)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-ink">Model candidate score</span>
          <span className="font-bold text-ink tabular-nums">{modelScores.proposal.toFixed(4)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
          <span>Proposed value</span>
          <span className="tabular-nums">{formatCurrency(projectedMetrics.futureTotalValue, currency)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
          <span>Unallocated cash under cap</span>
          <span className="tabular-nums">
            {formatCurrency(
              Math.max(0, investmentAmount - projectedMetrics.futureTotalValue.toNumber()),
              currency,
            )}
          </span>
        </div>
      </div>

      <div className="border-t border-hairline">
        <h3 className="px-4 pt-4 pb-2 text-sm font-bold text-ink">Illustrative share mix</h3>
        <ul className="divide-y divide-hairline border-t border-hairline">
          {portfolio.map((item, rowIndex) => {
            const sharesToAdd = proposedShares[item.ticker] || 0;
            const newWeight =
              projectedMetrics.newWeights[item.ticker] || item.weight;

            return (
              <motion.li
                key={item.ticker}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: Math.min(rowIndex, 10) * 0.04 }}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{item.ticker}</p>
                  <div className="mt-1.5 h-1.5 w-full bg-surface-soft rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-body-strong"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, newWeight))}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: Math.min(rowIndex, 10) * 0.04 }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      sharesToAdd > 0
                        ? "text-compass"
                        : sharesToAdd < 0
                          ? "text-rose-400"
                          : "text-muted",
                    )}
                  >
                    {sharesToAdd > 0 ? `+${sharesToAdd}` : sharesToAdd}
                  </p>
                  <p className="text-xs text-muted tabular-nums">{newWeight.toFixed(2)}%</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>

      <details className="group border-t border-hairline">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-compass">
          How it works
          <span className="text-muted transition-transform duration-75 group-open:rotate-180" aria-hidden="true">
            &#9662;
          </span>
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4 text-xs leading-5 text-muted">
          <p>
            The score uses issuer yield, reported beta × 6%, and estimated
            annual covariance. These inputs are proxies, not forecasts or a
            recommendation.{" "}
            {covariance.source === "history"
              ? `The covariance uses ${covariance.samples} overlapping daily returns.`
              : "The covariance uses a beta-based estimate because the holdings lack enough overlapping price history."}
          </p>
          <p>
            Unitless scores are comparable only under these same heuristic inputs. No trade can be applied from this panel.
          </p>
          <p>
            The model can leave cash unallocated when no affordable purchase improves its allocation score.
          </p>
        </div>
      </details>

      <p className="border-t border-hairline bg-canvas p-4 text-xs leading-5 text-muted">
        This experimental result is for inspection only. Apply is unavailable
        while expected returns and fallback correlations remain heuristic.
      </p>
    </div>
  );
}
