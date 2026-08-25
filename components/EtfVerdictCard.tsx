import {
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { analyzeEtf, VerdictEntry } from "@/lib/etf-analysis";
import { ETF } from "@/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface Explanation {
  title: string;
  meaning: string;
  thresholds: string;
}

const EXPLANATIONS = {
  cost: {
    title: "Management Expense Ratio (MER)",
    meaning:
      "The MER is an annual fund expense expressed as a percentage of assets. Fees reduce returns, but funds with different strategies are not directly comparable on cost alone.",
    thresholds:
      "Screen bands: below 0.40% | 0.40% to 0.75% | above 0.75%",
  },
  liquidity: {
    title: "Average Daily Volume",
    meaning:
      "Trading volume is one input to liquidity. Bid-ask spread and order-book depth also affect the cost of entering or leaving a position.",
    thresholds: "Screen bands: above 1M | 100K to 1M | below 100K shares",
  },
  volatility: {
    title: "Beta / Realized Volatility",
    meaning:
      "When beta is available, the screen shows historical sensitivity to a market benchmark. Otherwise, it estimates annualized volatility from available price history.",
    thresholds:
      "Beta bands: below 0.85 | 0.85 to 1.25 | above 1.25. Volatility bands: below 10% | 10% to 35% | above 35%.",
  },
} satisfies Record<
  string,
  Explanation
>;
const explanationsByKey = new Map<string, Explanation>(
  Object.entries(EXPLANATIONS),
);

export default function EtfVerdictCard({
  etf,
  history,
  className,
}: {
  etf: ETF;
  /** Chart series used to estimate volatility when beta is missing. */
  history?: { price: number }[];
  className?: string;
}) {
  const verdict = analyzeEtf(etf, { history });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const getIcon = (status: string) => {
    switch (status) {
      case "good":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getColor = (status: string) => {
    switch (status) {
      case "good":
        return "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10";
      case "warning":
        return "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10";
      default:
        return "border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10";
    }
  };

  return (
    <div className={cn("grid grid-cols-1 gap-4", className)}>
      {Object.entries(verdict)
        .filter((entry): entry is [string, VerdictEntry] => !!entry[1])
        .map(([key, data]) => {
        const isExpanded = expandedKey === key;
        const explanation = explanationsByKey.get(key);

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

            <motion.div layout className="font-bold text-ink text-lg">
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
                  className="pt-3 mt-1 border-t border-hairline text-xs"
                >
                  <div className="font-semibold text-ink mb-1">
                    {explanation.title}
                  </div>
                  <p className="text-neutral-400 mb-2 leading-relaxed">
                    {explanation.meaning}
                  </p>
                  <div className="text-[10px] font-mono text-neutral-500 bg-black/5 p-1.5 rounded">
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
