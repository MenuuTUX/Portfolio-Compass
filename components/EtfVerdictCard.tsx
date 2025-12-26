import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp, ShieldCheck, Zap } from 'lucide-react';
import { analyzeEtf } from '@/lib/etf-analysis';
import { ETF } from '@/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const EXPLANATIONS: Record<string, { title: string; meaning: string; thresholds: string }> = {
  cost: {
    title: "Management Expense Ratio (MER)",
    meaning: "The MER is the annual fee deducted from your returns. Lower is better.",
    thresholds: "Low < 0.40% | Moderate 0.40-0.75% | High > 0.75%"
  },
  liquidity: {
    title: "Average Daily Volume",
    meaning: "Liquidity determines ease of trade without price impact.",
    thresholds: "High > 1M | Moderate 100k-1M | Low < 100k"
  },
  volatility: {
    title: "Beta (Market Sensitivity)",
    meaning: "Measures movement relative to S&P 500.",
    thresholds: "Low < 0.85 | Market ~1.0 | High > 1.25"
  }
};

export default function EtfVerdictCard({ etf, className }: { etf: ETF; className?: string }) {
  const verdict = analyzeEtf(etf);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const getTheme = (status: string) => {
    switch (status) {
      case 'good': return {
        color: 'text-emerald-400',
        border: 'border-emerald-500/30',
        bg: 'from-emerald-950/40 to-emerald-900/20',
        glow: 'shadow-[0_0_20px_-5px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] hover:border-emerald-500/50',
        icon: ShieldCheck
      };
      case 'warning': return {
        color: 'text-rose-400',
        border: 'border-rose-500/30',
        bg: 'from-rose-950/40 to-rose-900/20',
        glow: 'shadow-[0_0_20px_-5px_rgba(244,63,94,0.1)] hover:shadow-[0_0_25px_rgba(244,63,94,0.5)] hover:border-rose-500/50',
        icon: AlertTriangle
      };
      default: return {
        color: 'text-blue-400',
        border: 'border-blue-500/30',
        bg: 'from-blue-950/40 to-blue-900/20',
        glow: 'shadow-[0_0_20px_-5px_rgba(59,130,246,0.1)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] hover:border-blue-500/50',
        icon: Zap
      };
    }
  };

  return (
    <div className={cn("grid grid-cols-1 gap-3", className)}>
      {Object.entries(verdict).map(([key, data]) => {
        const isExpanded = expandedKey === key;
        const explanation = EXPLANATIONS[key];
        const theme = getTheme(data.status);
        const Icon = theme.icon;

        return (
          <motion.div
            key={key}
            layout
            onClick={() => setExpandedKey(isExpanded ? null : key)}
            className={cn(
              "group relative overflow-hidden rounded-xl border p-3 cursor-pointer transition-all duration-300",
              "bg-gradient-to-br backdrop-blur-sm",
              theme.border,
              theme.bg,
              theme.glow
            )}
            // Removed whileHover scale expansion as per user request
          >
            {/* Background Watermark Icon */}
            <Icon className={cn("absolute -right-4 -top-4 w-20 h-20 opacity-5 transition-transform duration-500 group-hover:scale-110", theme.color)} />

            <motion.div layout className="relative z-10">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", theme.color)}>
                        {key}
                    </span>
                </div>
                {isExpanded ?
                    <ChevronUp className={cn("w-4 h-4 opacity-50", theme.color)} /> :
                    <ChevronDown className={cn("w-4 h-4 opacity-50", theme.color)} />
                }
              </div>

              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-white tracking-tight">
                    {data.label}
                </h3>
                {/* Status Indicator Dot */}
                <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]", theme.color)} />
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed max-w-[90%]">
                {data.description}
              </p>
            </motion.div>

            <AnimatePresence>
              {isExpanded && explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative z-10 pt-4 mt-4 border-t border-white/10"
                >
                  <div className="grid gap-3">
                    <div>
                        <div className="text-xs font-semibold text-white mb-1">{explanation.title}</div>
                        <p className="text-[11px] text-neutral-400 leading-relaxed">
                            {explanation.meaning}
                        </p>
                    </div>

                    <div className="bg-black/40 rounded-lg p-2 border border-white/5">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
                            <Info className="w-3 h-3" />
                            <span>{explanation.thresholds}</span>
                        </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
