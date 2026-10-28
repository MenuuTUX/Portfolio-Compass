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
import { useState } from "react";

interface Explanation {
  title: string;
  meaning: string;
  thresholds: string;
}

const EXPLANATIONS = {
  cost: {
    title: "Provider-reported expense ratio",
    meaning:
      "This source-reported annual fund expense is expressed as a percentage of assets. Definitions and periods can differ by provider. Fees reduce returns, but funds with different strategies are not directly comparable on cost alone.",
    thresholds: "No fee bands applied.",
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

const getIcon = (status: string) => {
  switch (status) {
    case "good":
      return <CheckCircle className="w-4 h-4 text-emerald-400" aria-hidden="true" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-rose-400" aria-hidden="true" />;
    default:
      return <Info className="w-4 h-4 text-muted" aria-hidden="true" />;
  }
};

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
  history?: { date: string; price: number }[];
  className?: string;
}) {
  const verdict = analyzeEtf(etf, { history });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <section
      aria-label="Quick take"
      className={cn("rounded-2xl bg-surface-soft divide-y divide-hairline", className)}
    >
      {Object.entries(verdict)
        .filter((entry): entry is [string, VerdictEntry] => !!entry[1])
        .map(([key, data]) => {
          const isExpanded = expandedKey === key;
          const explanation = explanationsByKey.get(key);

          return (
            <div key={key} className="px-4 py-3">
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? null : key)}
                aria-expanded={isExpanded}
                className="w-full min-h-11 text-left rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-xs text-muted capitalize">
                      {key}
                    </span>
                    <span className="block text-sm font-bold text-ink">
                      {data.label}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {getIcon(data.status)}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                    )}
                  </span>
                </span>
              </button>

              <p className="text-xs text-muted leading-relaxed">
                {data.description}
              </p>

              {isExpanded && explanation && (
                <div className="pt-3 mt-3 border-t border-hairline text-xs">
                  <div className="font-semibold text-ink mb-1">
                    {explanation.title}
                  </div>
                  <p className="text-muted mb-2 leading-relaxed">
                    {explanation.meaning}
                  </p>
                  <div className="text-xs font-mono text-muted-soft">
                    {explanation.thresholds}
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </section>
  );
}
