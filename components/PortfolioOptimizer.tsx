'use client';

import { useState, useMemo } from 'react';
import { PortfolioItem } from '@/types';
import { calculateOverlap, optimizeBudget, BudgetRecommendation } from '@/lib/optimizer';
import { AlertTriangle, PieChart, ShieldCheck, DollarSign, TrendingUp, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PortfolioOptimizerProps {
  portfolio: PortfolioItem[];
}

export default function PortfolioOptimizer({ portfolio }: PortfolioOptimizerProps) {
  const [budget, setBudget] = useState<number>(7000);
  const [recommendations, setRecommendations] = useState<BudgetRecommendation[] | null>(null);

  const { concentrationScore, topOverlaps } = useMemo(() => calculateOverlap(portfolio), [portfolio]);

  const handleMinimizeOverlap = () => {
    const result = optimizeBudget(portfolio, budget);
    setRecommendations(result);
  };

  // Determine risk level color
  const getRiskLevel = (score: number) => {
    if (score < 15) return { label: 'Low', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    if (score < 35) return { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    return { label: 'High', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
  };

  const risk = getRiskLevel(concentrationScore);

  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col bg-white/5 border border-white/5 h-fit">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-medium text-white">Portfolio Optimizer</h3>
      </div>

      {/* Concentration Score */}
      <div className={cn("p-4 rounded-lg border flex flex-col gap-2 mb-6", risk.bg, risk.border)}>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-white/80">Concentration Score</span>
          <span className={cn("font-bold", risk.color)}>{risk.label}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className={cn("text-3xl font-bold", risk.color)}>{concentrationScore.toFixed(1)}</span>
          <span className="text-sm text-white/60 mb-1">/ 100</span>
        </div>
        <p className="text-xs text-white/60 mt-1">
          Exposure to top 10 overlapping stocks. Lower is better for diversification.
        </p>
      </div>

      {/* Top Overlaps */}
      {topOverlaps.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-yellow-400" />
            Highest Overlaps
          </h4>
          <div className="space-y-2">
            {topOverlaps.slice(0, 3).map((item) => (
              <div key={item.ticker} className="flex justify-between items-center text-sm">
                <span className="text-neutral-400">{item.ticker}</span>
                <span className="text-white font-medium">{item.exposure.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Optimization */}
      <div className="border-t border-white/10 pt-6">
        <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Smart Allocation
        </h4>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
              placeholder="Investment Amount"
            />
          </div>

          <button
            onClick={handleMinimizeOverlap}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2"
          >
             Minimize Overlap
          </button>
        </div>

        <AnimatePresence>
          {recommendations && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="bg-white/5 rounded-lg border border-white/10 p-3">
                <p className="text-xs text-neutral-400 mb-3 uppercase tracking-wider font-medium">Recommended Buys</p>
                <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                  {recommendations.map((rec) => (
                    <div key={rec.ticker} className="flex flex-col gap-1 pb-2 border-b border-white/5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{rec.ticker}</span>
                        <span className="text-emerald-400 font-mono">+${rec.amount.toLocaleString()}</span>
                      </div>
                       <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                          <ArrowRight className="w-3 h-3" />
                          {rec.reason}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
