import { computeMetrics, type Drawdown } from "@/lib/lab/engine/metrics";
import type { SimResult } from "@/lib/lab/engine/simulate";

// An in-sample / hold-out view of one finished run. The strategy was already
// simulated on the whole history, so this does not refit anything: it reports
// the same equity curve in two pieces, so a rule that only worked early on is
// visible. Every figure comes from `computeMetrics`, so the definitions match
// the rest of the Lab.

/** Fewest bars a piece needs for its ratios to mean anything. */
export const MIN_SLICE_BARS = 60;

export interface SliceStats {
  startDate: string;
  endDate: string;
  totalReturn: number;
  cagr: number;
  volatility: number;
  sharpe: number | null;
  maxDrawdown: Drawdown | null;
}

export interface HoldoutSplit {
  /** First date of the hold-out piece. The last in-sample bar is its starting level. */
  splitDate: string;
  inSample: SliceStats;
  holdout: SliceStats;
}

type SimSlice = Pick<SimResult, "equity" | "flows" | "trades">;

function sliceStats(dates: string[], sim: SimSlice, from: number, to: number, riskFree: number | undefined): SliceStats {
  const flows = sim.flows.slice(from, to + 1);
  flows[0] = 0; // the first bar is the base level, not a return
  const equity = sim.equity.slice(from, to + 1);
  const m = computeMetrics(dates.slice(from, to + 1), {
    equity,
    flows,
    trades: [],
    costsPaid: 0,
    dividendsReceived: 0,
  }, { initialCash: equity[0], riskFree });
  return {
    startDate: m.startDate,
    endDate: m.endDate,
    totalReturn: m.totalReturn,
    cagr: m.cagr,
    volatility: m.volatility,
    sharpe: m.sharpe,
    maxDrawdown: m.maxDrawdown,
  };
}

/**
 * Split a run at `1 - holdoutFraction` of its bars. Returns null when either
 * piece would be shorter than MIN_SLICE_BARS.
 */
export function splitMetrics(
  dates: string[],
  sim: SimSlice,
  { holdoutFraction = 0.3, riskFree }: { holdoutFraction?: number; riskFree?: number } = {},
): HoldoutSplit | null {
  if (!(holdoutFraction > 0 && holdoutFraction < 1)) throw new RangeError("holdoutFraction must be between 0 and 1.");
  const T = dates.length;
  const k = Math.floor((T - 1) * (1 - holdoutFraction));
  if (k + 1 < MIN_SLICE_BARS || T - k < MIN_SLICE_BARS) return null;
  return {
    splitDate: dates[k + 1],
    inSample: sliceStats(dates, sim, 0, k, riskFree),
    holdout: sliceStats(dates, sim, k, T - 1, riskFree),
  };
}
