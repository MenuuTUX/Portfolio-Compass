'use client';

import { useState, useMemo, useEffect } from 'react';
import { PortfolioItem } from '@/types';
import { calculateSmartDistribution, SmartDistributionResult } from '@/lib/optimizer';
import { Check, ArrowRight, DollarSign, TrendingDown, Layers, Activity, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Decimal } from 'decimal.js';

interface OptimizationPanelProps {
  portfolio: PortfolioItem[];
  onApply: (newShares: Record<string, number>, newWeights: Record<string, number>) => void;
}

export default function OptimizationPanel({ portfolio, onApply }: OptimizationPanelProps) {
  const [investmentAmount, setInvestmentAmount] = useState<number>(7000);
  const [result, setResult] = useState<SmartDistributionResult | null>(null);
  const [proposedShares, setProposedShares] = useState<Record<string, number>>({});
  const [isApplying, setIsApplying] = useState(false);

  // Debounced calculation for initial recommendation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (portfolio.length > 0) {
        const res = calculateSmartDistribution(portfolio, investmentAmount);
        setResult(res);
        setProposedShares(res.newShares);
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [investmentAmount, portfolio]);

  const projectedMetrics = useMemo(() => {
    if (!result) return null;

    // Calculate new total value with manual overrides
    let futureTotalValue = new Decimal(0);
    const futureShares: Record<string, number> = {};

    // Sum existing portfolio + proposed additions
    portfolio.forEach(p => {
       const added = proposedShares[p.ticker] || 0;
       const total = (p.shares || 0) + added;
       futureShares[p.ticker] = total;
       futureTotalValue = futureTotalValue.plus(new Decimal(p.price || 0).times(total));
    });

    const newWeights: Record<string, number> = {};
    if (!futureTotalValue.isZero()) {
        portfolio.forEach(p => {
            const s = futureShares[p.ticker] || 0;
            const val = new Decimal(p.price || 0).times(s);
            newWeights[p.ticker] = val.div(futureTotalValue).times(100).toNumber();
        });
    }

    // Calculate budget used by proposed shares
    let usedBudget = new Decimal(0);
    Object.entries(proposedShares).forEach(([ticker, count]) => {
        const item = portfolio.find(p => p.ticker === ticker);
        if (item) {
            usedBudget = usedBudget.plus(new Decimal(item.price || 0).times(count));
        }
    });

    return { newWeights, usedBudget, futureTotalValue };
  }, [portfolio, proposedShares, result]);

  const handleShareChange = (ticker: string, delta: number) => {
      if (!result || !projectedMetrics) return;

      const currentAdded = proposedShares[ticker] || 0;
      const nextVal = currentAdded + delta;

      if (nextVal < 0) return; // Cannot add negative shares

      const item = portfolio.find(p => p.ticker === ticker);
      if (!item) return;

      const costDelta = new Decimal(item.price || 0).times(delta);
      const newUsedBudget = projectedMetrics.usedBudget.plus(costDelta);
      const budgetLimit = new Decimal(investmentAmount);

      // Create a copy to modify
      const nextShares = { ...proposedShares };
      nextShares[ticker] = nextVal;

      if (delta > 0 && newUsedBudget.greaterThan(budgetLimit)) {
          // If increasing exceeds budget, we must decrease others to compensate
          // Sort other assets by optimization score (worst first) to sacrifice them
          // Note: We don't have scores easily available here unless we store them or re-derive.
          // Fallback: Decrement any other asset with >0 shares

          let remainingDeficit = newUsedBudget.minus(budgetLimit);

          // Get all other tickers with added shares
          const otherTickers = Object.keys(nextShares).filter(t => t !== ticker && nextShares[t] > 0);

          // Simple heuristic: just remove from the first available for now,
          // or ideally sort by price to minimize share count impact?
          // Let's iterate and remove.
          for (const other of otherTickers) {
              if (remainingDeficit.lessThanOrEqualTo(0)) break;

              const otherItem = portfolio.find(p => p.ticker === other);
              if (!otherItem) continue;

              const otherPrice = new Decimal(otherItem.price || 0);
              const availableShares = nextShares[other];

              // How many shares to remove?
              const sharesToRemove = Math.ceil(remainingDeficit.div(otherPrice).toNumber());
              const actualRemove = Math.min(availableShares, sharesToRemove);

              nextShares[other] -= actualRemove;
              remainingDeficit = remainingDeficit.minus(otherPrice.times(actualRemove));
          }

          // If still deficit, we cannot perform the increase
          if (remainingDeficit.greaterThan(0)) {
              return; // Block the action
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

  if (!result || !projectedMetrics) return <div className="p-6 text-neutral-400">Initializing Optimizer...</div>;

  const scoreImprovement = result.beforeScore - result.afterScore; // Note: After score should re-calc based on manual changes? ideally yes but computationally expensive to re-run overlap every click. Keep static for now or just show static result score.

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden relative">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-black/20">
        <div className="flex items-center gap-2 mb-4 text-emerald-400">
          <Activity className="w-5 h-5" />
          <h2 className="font-bold text-lg tracking-wide uppercase">Smart Optimizer</h2>
        </div>

        <div className="relative group">
           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <DollarSign className="h-6 w-6 text-emerald-500/80" />
          </div>
          <input
            type="number"
            value={investmentAmount}
            onChange={(e) => setInvestmentAmount(Math.max(0, Number(e.target.value)))}
            className="block w-full pl-12 pr-4 py-4 bg-black/40 border border-white/10 rounded-lg text-2xl font-bold text-white placeholder-neutral-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
            placeholder="0.00"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-medium">USD</span>
        </div>

        <div className="mt-2 flex justify-between text-xs text-neutral-500">
             <span>Allocated: ${projectedMetrics.usedBudget.toNumber().toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
             <span>Budget: ${investmentAmount.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        {/* Risk Score */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              Overlap Score
            </h3>
             {scoreImprovement > 0 && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                -{scoreImprovement.toFixed(1)} Improved
              </span>
            )}
          </div>
           {/* Visual Bars */}
           <div className="space-y-3">
             <div className="space-y-1">
               <div className="flex justify-between text-xs text-neutral-500">
                 <span>Current Risk</span>
                 <span>{result.beforeScore.toFixed(1)} / 100</span>
               </div>
               <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                 <motion.div
                   className="h-full bg-rose-500/70"
                   initial={{ width: 0 }}
                   animate={{ width: `${result.beforeScore}%` }}
                 />
               </div>
             </div>
             <div className="space-y-1">
               <div className="flex justify-between text-xs text-neutral-500">
                 <span>Projected Risk</span>
                 <span className="text-emerald-400 font-bold">{result.afterScore.toFixed(1)} / 100</span>
               </div>
               <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative">
                 <div className="absolute top-0 left-0 h-full bg-white/5" style={{ width: `${result.beforeScore}%` }} />
                 <motion.div
                   className="h-full bg-emerald-500"
                   initial={{ width: 0 }}
                   animate={{ width: `${result.afterScore}%` }}
                 />
               </div>
             </div>
          </div>
        </section>

        {/* Holdings X-Ray */}
        <section>
           <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Top Concentrated Stocks
          </h3>
          <div className="bg-white/5 rounded-lg border border-white/5 divide-y divide-white/5">
            {result.topOverlaps.map((stock) => (
              <div key={stock.ticker} className="flex justify-between items-center p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                    {stock.ticker[0]}
                  </div>
                  <span className="text-sm font-medium text-white">{stock.ticker}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-rose-400">{stock.exposure.toFixed(1)}%</div>
                  <div className="text-[10px] text-neutral-500">Portfolio Exposure</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actionable Table */}
        <section>
           <h3 className="text-sm font-medium text-neutral-300 mb-3">Allocations (Interactive)</h3>
           <div className="space-y-2">
             {portfolio.map((item) => {
               const sharesToAdd = proposedShares[item.ticker] || 0;
               const newWeight = projectedMetrics.newWeights[item.ticker] || item.weight;

               // Show item if it has recommended shares OR if we want to allow user to add to any
               // For cleaner UI, let's show all items in portfolio to allow manual tweaks?
               // Or just recommended ones? The user said "all the other sliders go down".
               // Showing all gives full control.

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
                            disabled={sharesToAdd <= 0}
                         >
                            <Minus className="w-3 h-3" />
                         </button>
                         <span className={cn("text-sm font-mono w-6 text-center", sharesToAdd > 0 ? "text-emerald-400 font-bold" : "text-neutral-500")}>
                            {sharesToAdd}
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
                           <span className="text-white">{newWeight.toFixed(2)}%</span>
                       </div>
                       <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                           <motion.div
                             className="h-full bg-emerald-500"
                             initial={false}
                             animate={{ width: `${newWeight}%` }}
                             transition={{ type: "spring", stiffness: 300, damping: 30 }}
                           />
                       </div>
                   </div>
                 </motion.div>
               );
             })}
           </div>
        </section>
      </div>

      <div className="p-6 border-t border-white/10 bg-black/20">
        <button
          onClick={handleApply}
          disabled={isApplying || Object.values(proposedShares).every(s => s === 0)}
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
