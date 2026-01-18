import {
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { analyzeEtf } from "@/lib/etf-analysis";
import { ETF } from "@/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const EXPLANATIONS: Record<
  string,
  { title: string; meaning: string; thresholds: string }
> = {
  cost: {
    title: "Management Expense Ratio (MER)",
    meaning:
      "The MER is the annual fee deducted from your returns to pay for the fund's management. Over decades, even small fee differences can significantly impact total wealth.",
    thresholds:
      "Rating Criteria: Low < 0.40% | Moderate 0.40-0.75% | High > 0.75%",
  },
  liquidity: {
    title: "Average Daily Volume",
    meaning:
      "Liquidity refers to how easily you can buy or sell shares without causing a price impact. Low liquidity can lead to 'slippage', where you pay more or sell for less than the market price.",
    thresholds: "Rating Criteria: High > 1M | Moderate 100k-1M | Low < 100k",
  },
  volatility: {
    title: "Beta (Market Sensitivity)",
    meaning:
      "Beta measures how much this asset moves compared to the S&P 500. High beta (>1.0) means it exaggerates market moves; low beta (<1.0) means it's more stable.",
    thresholds: "Rating Criteria: Low < 0.85 | Market ~1.0 | High > 1.25",
  },
};

export default function EtfVerdictCard({
  etf,
  className,
}: {
  etf: ETF;
  className?: string;
}) {
  const verdict = analyzeEtf(etf);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const getIcon = (status: string) => {
    switch (status) {
      case "good":
        return <CheckCircle className="w-5 h-5 text-amber-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getColor = (status: string) => {
    switch (status) {
      case "good":
        return "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10";
      case "warning":
        return "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10";
      default:
        return "border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10";
    }
  };

  return (
    <div className={cn("grid grid-cols-1 gap-4", className)}>
      {Object.entries(verdict).map(([key, data]) => {
        const isExpanded = expandedKey === key;
        const explanation = EXPLANATIONS[key];

        return (
          <motion.div
            key={key}
            layout
            onClick={() => setExpandedKey(isExpanded ? null : key)}
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-2 cursor-pointer transition-colors relative overflow-hidden",
              getColor(data.status),
            )}
          >
            <motion.div layout className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                {key}
              </span>
              <div className="flex items-center gap-2">
                {getIcon(data.status)}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-neutral-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-500" />
                )}
              </div>
            </motion.div>

            <motion.div layout className="font-bold text-white text-lg">
              {data.label}
            </motion.div>

            <motion.p
              layout
              className="text-xs text-neutral-400 leading-relaxed"
            >
              {data.description}
            </motion.p>

            <AnimatePresence>
              {isExpanded && explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-3 mt-1 border-t border-white/10 text-xs"
                >
                  <div className="font-semibold text-white mb-1">
                    {explanation.title}
                  </div>
                  <p className="text-neutral-400 mb-2 leading-relaxed">
                    {explanation.meaning}
                  </p>
                  <div className="text-[10px] font-mono text-neutral-500 bg-black/20 p-1.5 rounded">
                    {explanation.thresholds}
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
