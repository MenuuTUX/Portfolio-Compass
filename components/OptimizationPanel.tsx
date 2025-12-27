'use client';

import { useState, useMemo, useEffect } from 'react';
import { PortfolioItem } from '@/types';
import { calculateSmartDistribution, SmartDistributionResult } from '@/lib/optimizer';
import { Check, ArrowRight, DollarSign, TrendingDown, Layers, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Decimal } from 'decimal.js';

interface OptimizationPanelProps {
  portfolio: PortfolioItem[];
  onApply: (newShares: Record<string, number>) => void;
}

export default function OptimizationPanel({ portfolio, onApply }: OptimizationPanelProps) {
  const [investmentAmount, setInvestmentAmount] = useState<number>(7000);
  const [result, setResult] = useState<SmartDistributionResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Debounced calculation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (portfolio.length > 0) {
        setResult(calculateSmartDistribution(portfolio, investmentAmount));
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [investmentAmount, portfolio]);

  const handleApply = () => {
    if (!result) return;
    setIsApplying(true);
    // Simulate a small delay for "Processing" feel
    setTimeout(() => {
      onApply(result.newShares);
      setIsApplying(false);
      // Reset input or keep it? Keeping it allows iterative adding.
    }, 500);
  };

  if (!result) return <div className="p-6 text-neutral-400">Initializing Optimizer...</div>;

  const scoreImprovement = result.beforeScore - result.afterScore;

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden relative">
      {/* Header / Control Center */}
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
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        {/* Before vs After Score */}
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

          <div className="space-y-3">
             {/* Before Bar */}
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
                   transition={{ duration: 0.5 }}
                 />
               </div>
             </div>

             {/* After Bar */}
             <div className="space-y-1">
               <div className="flex justify-between text-xs text-neutral-500">
                 <span>Projected Risk</span>
                 <span className="text-emerald-400 font-bold">{result.afterScore.toFixed(1)} / 100</span>
               </div>
               <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative">
                 {/* Ghost bar for comparison */}
                 <div className="absolute top-0 left-0 h-full bg-white/5 w-[${result.beforeScore}%]" />
                 <motion.div
                   className="h-full bg-emerald-500"
                   initial={{ width: 0 }}
                   animate={{ width: `${result.afterScore}%` }}
                   transition={{ duration: 0.5, delay: 0.2 }}
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
           <h3 className="text-sm font-medium text-neutral-300 mb-3">Recommendation</h3>
           <div className="space-y-2">
             {portfolio.map((item) => {
               const sharesToAdd = result.newShares[item.ticker] || 0;
               const newWeight = result.newWeights[item.ticker] || item.weight;

               if (sharesToAdd === 0) return null; // Only show actionable items? Or show all? Let's show actionable.

               return (
                 <motion.div
                   key={item.ticker}
                   layout
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="p-3 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between group hover:bg-white/10 transition-colors"
                 >
                   <div className="flex flex-col">
                     <span className="font-bold text-white">{item.ticker}</span>
                     <span className="text-xs text-neutral-500">Target Weight: {newWeight.toFixed(1)}%</span>
                   </div>

                   <div className="flex items-center gap-3">
                     <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-bold">
                       +{sharesToAdd} Shares
                     </span>
                   </div>
                 </motion.div>
               );
             })}

             {Object.keys(result.newShares).length === 0 && (
               <div className="p-4 text-center text-sm text-neutral-500 italic border border-dashed border-white/10 rounded-lg">
                 Increase budget to see share recommendations.
               </div>
             )}
           </div>
        </section>
      </div>

      {/* Footer Action */}
      <div className="p-6 border-t border-white/10 bg-black/20">
        <button
          onClick={handleApply}
          disabled={isApplying || Object.keys(result.newShares).length === 0}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.6)] transition-all flex items-center justify-center gap-2"
        >
          {isApplying ? (
            <span className="animate-pulse">Optimizing...</span>
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
