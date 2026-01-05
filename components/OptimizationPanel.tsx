"use client";

import { useState, useMemo, useEffect } from "react";
import { PortfolioItem } from "@/types";
import {
  optimizePortfolioGreedy,
  GreedyOptimizationResult,
} from "@/lib/optimizer";
import {
  Check,
  ArrowRight,
  DollarSign,
  TrendingDown,
  Layers,
  Activity,
  Minus,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Decimal } from "@/lib/decimal";
import OptimizationDiffChart from "./OptimizationDiffChart";

interface OptimizationPanelProps {
  portfolio: PortfolioItem[];
  onApply: (
    newShares: Record<string, number>,
    newWeights: Record<string, number>,
  ) => void;
  onCalibrating?: (isCalibrating: boolean) => void;
}

interface RiskState {
  sentimentEma: number;
  riskRegime: "RISK_ON" | "NEUTRAL" | "RISK_OFF";
  lambda: number;
  latestScore: number;
}

type StrategyMode = "Conservative" | "Balanced" | "Growth";

export default function OptimizationPanel({
  portfolio,
  onApply,
  onCalibrating,
}: OptimizationPanelProps) {
  const [investmentAmount, setInvestmentAmount] = useState<number>(7000);
  const [result, setResult] = useState<GreedyOptimizationResult | null>(null);
  const [proposedShares, setProposedShares] = useState<Record<string, number>>(
    {},
  );
  const [isApplying, setIsApplying] = useState(false);
  const [riskState, setRiskState] = useState<RiskState | null>(null);
  const [strategyMode, setStrategyMode] = useState<StrategyMode>("Balanced");

  // Fetch Risk State
  useEffect(() => {
    async function fetchRisk() {
      try {
        const res = await fetch("/api/market/sentiment");
        if (res.ok) {
          const data = await res.json();
          setRiskState(data);
        }
      } catch (e) {
        console.error("Failed to fetch risk state", e);
      }
    }
    fetchRisk();
  }, []);

  // Debounced calculation for initial recommendation
  useEffect(() => {
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

        const candidates = portfolio.map((p) => ({
          ticker: p.ticker,
          price: p.price,
          expectedReturn:
            (p.metrics?.yield || 0) / 100 + (p.beta || 1.0) * 0.06, // Simple CAPM-ish proxy
        }));

        const n = portfolio.length;
        // Simple diagonal covariance matrix based on Beta (volatility proxy)
        const covarianceMatrix = Array(n)
          .fill(0)
          .map(() => Array(n).fill(0));
        for (let i = 0; i < n; i++) {
          const vol = (portfolio[i].beta || 1.0) * 0.15;
          covarianceMatrix[i][i] = vol * vol;
        }

        const res = optimizePortfolioGreedy({
          candidates,
          covarianceMatrix,
          riskProfile: strategyMode.toLowerCase() as any,
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
  }, [investmentAmount, portfolio, onCalibrating, riskState, strategyMode]);

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

    let usedBudget = new Decimal(0);
    Object.entries(proposedShares).forEach(([ticker, count]) => {
      const item = portfolio.find((p) => p.ticker === ticker);
      if (item) {
        usedBudget = usedBudget.plus(new Decimal(item.price || 0).times(count));
      }
    });

    return { newWeights, usedBudget, futureTotalValue, futureShares };
  }, [portfolio, proposedShares, result]);

  const handleShareChange = (ticker: string, delta: number) => {
    if (!result || !projectedMetrics) return;

    const currentAdded = proposedShares[ticker] || 0;
    const nextVal = currentAdded + delta;

    const item = portfolio.find((p) => p.ticker === ticker);
    if (!item) return;

    // Allow selling up to the current holding amount
    // currentAdded is the 'delta'. if it is -5, it means we are selling 5 shares.
    // We cannot sell more than item.shares.
    // So currentAdded + delta cannot be less than -item.shares
    const minVal = -(item.shares || 0);

    if (nextVal < minVal) return;

    const costDelta = new Decimal(item.price || 0).times(delta);

    // projectedMetrics.usedBudget is strictly the cost of *added* (delta) shares.
    // If delta is negative, this reduces the used budget.
    const newUsedBudget = projectedMetrics.usedBudget.plus(costDelta);

    // Calculate current holdings value (Initial state)
    let currentHoldingsValue = new Decimal(0);
    portfolio.forEach((p) => {
      currentHoldingsValue = currentHoldingsValue.plus(
        new Decimal(p.price || 0).times(p.shares || 0),
      );
    });

    // Total proposed value = Initial Holdings + Cost of Changes
    const totalProposedValue = currentHoldingsValue.plus(newUsedBudget);
    const budgetLimit = new Decimal(investmentAmount);

    const nextShares = { ...proposedShares };
    nextShares[ticker] = nextVal;

    if (delta > 0 && totalProposedValue.greaterThan(budgetLimit)) {
      let remainingDeficit = totalProposedValue.minus(budgetLimit);

      // Auto-reduce "added" shares first to stay within budget
      // We filter for items where we have added shares (delta > 0)
      // Extending this to "sell" initial shares automatically is complex, so we stick to reducing additions.
      // BUT, we should probably allow reducing *any* share that has value > 0?
      // For now, keep existing logic: reduce from items that have positive delta.
      // If the user wants to buy more, they must manually sell something else (create negative delta).

      const otherTickers = Object.keys(nextShares).filter(
        (t) => t !== ticker && nextShares[t] > 0,
      );

      for (const other of otherTickers) {
        if (remainingDeficit.lessThanOrEqualTo(0)) break;

        const otherItem = portfolio.find((p) => p.ticker === other);
        if (!otherItem) continue;

        const otherPrice = new Decimal(otherItem.price || 0);
        const availableAddedShares = nextShares[other]; // Only reduce the 'added' portion automatically

        const sharesToRemove = Math.ceil(
          remainingDeficit.div(otherPrice).toNumber(),
        );
        const actualRemove = Math.min(availableAddedShares, sharesToRemove);

        nextShares[other] -= actualRemove;
        remainingDeficit = remainingDeficit.minus(
          otherPrice.times(actualRemove),
        );
      }

      if (remainingDeficit.greaterThan(0)) {
        return; // Cannot afford even after reducing other additions
      }
    }

    setProposedShares(nextShares);
  };

  const handleApply = () => {
    if (!projectedMetrics) return;
    setIsApplying(true);
    setTimeout(() => {
      onApply(proposedShares, projectedMetrics.newWeights);
      setIsApplying(false);
    }, 500);
  };

  if (!result || !projectedMetrics)
    return (
      <div className="p-6 text-neutral-400">Initializing Optimizer...</div>
    );

  const utilityScore = Math.min(100, Math.max(0, result.utility * 1000));

  // Risk Regime Display Logic
  const getRegimeIcon = () => {
    switch (riskState?.riskRegime) {
      case "RISK_ON":
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case "RISK_OFF":
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      default:
        return <Shield className="w-4 h-4 text-amber-400" />;
    }
  };

  const getRegimeLabel = () => {
    switch (riskState?.riskRegime) {
      case "RISK_ON":
        return "Aggressive Mode";
      case "RISK_OFF":
        return "Defensive Mode";
      default:
        return "Balanced Mode";
    }
  };

  const getRegimeColor = () => {
    switch (riskState?.riskRegime) {
      case "RISK_ON":
        return "text-emerald-400";
      case "RISK_OFF":
        return "text-rose-400";
      default:
        return "text-amber-400";
    }
  };

  // Construct proposed portfolio items for the Diff Chart
  const proposedPortfolioItems = portfolio.map((item) => ({
    ...item,
    shares: projectedMetrics.futureShares[item.ticker] || 0,
  }));

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden relative">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-black/20">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-emerald-400">
              <Activity className="w-5 h-5" />
              <h2 className="font-bold text-lg tracking-wide uppercase">
                Greedy Optimizer
              </h2>
            </div>

            {/* Market Regime Badge */}
            {riskState && (
              <div className="flex flex-col items-end">
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-bold uppercase px-2 py-1 rounded-full bg-white/5 border border-white/10",
                    getRegimeColor(),
                  )}
                >
                  {getRegimeIcon()}
                  <span>{getRegimeLabel()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Strategy Mode Selector */}
          <div className="flex gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
            {(["Conservative", "Balanced", "Growth"] as StrategyMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  onClick={() => setStrategyMode(mode)}
                  className={cn(
                    "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                    strategyMode === mode
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_-3px_rgba(16,185,129,0.3)]"
                      : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5",
                  )}
                >
                  {mode}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <DollarSign className="h-6 w-6 text-emerald-500/80" />
          </div>
          <input
            type="number"
            value={investmentAmount}
            onChange={(e) =>
              setInvestmentAmount(Math.max(0, Number(e.target.value)))
            }
            className="block w-full pl-12 pr-4 py-4 bg-black/40 border border-white/10 rounded-lg text-2xl font-bold text-white placeholder-neutral-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
            placeholder="0.00"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-medium">
            USD
          </span>
        </div>
        <div className="text-right text-[10px] text-neutral-500 mt-1 mr-1">
          Target Total Portfolio Value
        </div>

        <div className="mt-2 flex justify-between text-xs text-neutral-500">
          <span>
            Proposed New Value: $
            {projectedMetrics.futureTotalValue
              .toNumber()
              .toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span>Budget: ${investmentAmount.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        {/* Utility Score */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              Utility Score
            </h3>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Projected Utility</span>
                <span className="text-emerald-400 font-bold">
                  {utilityScore.toFixed(1)}
                </span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${utilityScore}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Actionable Table */}
        <section>
          <h3 className="text-sm font-medium text-neutral-300 mb-3">
            Allocations (Interactive)
          </h3>
          <div className="space-y-2">
            {portfolio.map((item) => {
              const sharesToAdd = proposedShares[item.ticker] || 0;
              const newWeight =
                projectedMetrics.newWeights[item.ticker] || item.weight;

              // Min shares limit: we cannot sell more than we have
              const minSharesDelta = -(item.shares || 0);

              return (
                <motion.div
                  key={item.ticker}
                  layout
                  className="p-3 bg-white/5 border border-white/10 rounded-lg flex flex-col gap-3 group hover:bg-white/10 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{item.ticker}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleShareChange(item.ticker, -1)}
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-white disabled:opacity-30"
                        disabled={sharesToAdd <= minSharesDelta}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span
                        className={cn(
                          "text-sm font-mono w-6 text-center",
                          sharesToAdd > 0
                            ? "text-emerald-400 font-bold"
                            : sharesToAdd < 0
                              ? "text-rose-400 font-bold"
                              : "text-neutral-500",
                        )}
                      >
                        {sharesToAdd > 0 ? `+${sharesToAdd}` : sharesToAdd}
                      </span>
                      <button
                        onClick={() => handleShareChange(item.ticker, 1)}
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Weight Slider Visualization */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-500 uppercase tracking-wider">
                      <span>Weight</span>
                      <span className="text-white">
                        {newWeight.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
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

      <div className="p-6 border-t border-white/10 bg-black/20 flex flex-col gap-4">
        {/* Diff Chart Preview */}
        <OptimizationDiffChart
          current={portfolio}
          proposed={proposedPortfolioItems}
        />

        <button
          onClick={handleApply}
          disabled={
            isApplying || Object.values(proposedShares).every((s) => s === 0)
          }
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.6)] transition-all flex items-center justify-center gap-2"
        >
          {isApplying ? (
            <span className="animate-pulse">Applying...</span>
          ) : (
            <>
              Apply Allocation <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
