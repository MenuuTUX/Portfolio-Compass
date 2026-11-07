import type { BarSeries } from "@/lib/lab/bar-types";
import { buildFrame, sliceFrame, type FxSeries } from "@/lib/lab/engine/frame";
import { deflatedSharpe, periodSharpe, returnMoments, sampleVariance } from "@/lib/lab/engine/deflated-sharpe";
import { computeMetrics, dailyReturns, periodsPerYear } from "@/lib/lab/engine/metrics";
import { runHash } from "@/lib/lab/engine/run-hash";
import { simulate, type BacktestConfig } from "@/lib/lab/engine/simulate";
import { compileStrategy, type NoCodeStrategy } from "@/lib/lab/no-code";
import { walkForward, type WalkForwardResult } from "@/lib/lab/engine/walkforward";

// A parameter sweep: one backtest per value of a single parameter, with the
// same data, costs and rebalancing, reporting the same metrics as a normal
// run. Only the no-code trend rule's moving-average length (`smaDays`) is
// swept. Code strategies are not: each value would need a fresh run of the
// user's code.

export type TrendStrategy = Extract<NoCodeStrategy, { kind: "trend" }>;

/** Moving-average lengths tried by default. The run's own length is added to the list. */
export const DEFAULT_SMA_VALUES = [20, 50, 100, 150, 200, 250, 300];
/** Walk-forward windows: three years to choose, one year to test. */
const WALK_FORWARD_TRAIN_BARS = 756;
const WALK_FORWARD_TEST_BARS = 252;

export interface SweepPoint {
  value: number;
  /** The run hash this variant would get as a normal run, so it counts once however it was tried. */
  hash: string;
  cagr: number;
  sharpe: number | null;
  /** Depth of the deepest fall from a high, as a negative fraction; null when the curve never fell. */
  maxDrawdown: number | null;
}

export interface RobustnessRequest {
  series: BarSeries[];
  config: BacktestConfig;
  baseCurrency: string;
  fx?: FxSeries;
  strategy: TrendStrategy;
  values: number[];
  /** First date of the sweep; earlier bars in `series` only warm the moving averages. */
  start?: string;
  benchmark?: string;
  riskFree?: number;
}

/** The best value's Sharpe after allowing for how many values were tried. */
export interface SweepDeflation {
  /** Variants in the sweep. */
  trials: number;
  /** Probability, 0 to 1, that the best value's edge is real once the trials are allowed for. */
  probability: number;
  /** Annualized Sharpe the best of this many no-edge variants would be expected to show. */
  luckSharpe: number;
  /** The best value's annualized Sharpe, for comparison. */
  bestSharpe: number;
}

export interface RobustnessResult {
  parameter: "smaDays";
  points: SweepPoint[];
  /** The value with the best Sharpe in the sweep, chosen with hindsight. Null when no value has a Sharpe. */
  bestValue: number | null;
  /** Null with fewer than two comparable values or too little history. */
  deflated: SweepDeflation | null;
  /** Null when the history is too short for two walk-forward windows. */
  walkForward: WalkForwardResult | null;
  startDate: string;
  endDate: string;
}

/** The values to try: the defaults plus the run's own, sorted, whole numbers of at least 2. */
export function sweepValues(own: number, defaults: number[] = DEFAULT_SMA_VALUES): number[] {
  return [...new Set([...defaults, Math.round(own)])].filter((v) => v >= 2).sort((a, b) => a - b);
}

export async function sweepTrend(req: RobustnessRequest): Promise<RobustnessResult> {
  const full = buildFrame(req.series, { baseCurrency: req.baseCurrency, fx: req.fx });
  const start = req.start ?? "";
  const riskFree = req.riskFree ?? req.config.cashRate ?? 0;
  const frame = sliceFrame(full, new Float64Array(0), start).frame;
  const values = [...new Set(req.values)].sort((a, b) => a - b);
  const points: SweepPoint[] = [];
  const returns: Float64Array[] = [];
  for (const value of values) {
    const strategy: TrendStrategy = { ...req.strategy, smaDays: value };
    const sim = simulate(frame, sliceFrame(full, compileStrategy(full, strategy), start).targets, req.config);
    const m = computeMetrics(frame.dates, sim, { initialCash: req.config.initialCash, riskFree });
    // Same inputs as `runBacktest` hashes, so a swept value and a normal run of it share one identity.
    const hash = await runHash(
      frame,
      { config: req.config, benchmark: req.benchmark ?? null, riskFree },
      { code: JSON.stringify(strategy) },
    );
    points.push({ value, hash, cagr: m.cagr, sharpe: m.sharpe, maxDrawdown: m.maxDrawdown ? m.maxDrawdown.depth : null });
    returns.push(dailyReturns(sim.equity, sim.flows));
  }

  let bestValue: number | null = null;
  let bestSharpe = -Infinity;
  for (const p of points) {
    if (p.sharpe !== null && p.sharpe > bestSharpe) {
      bestSharpe = p.sharpe;
      bestValue = p.value;
    }
  }

  // Deflated Sharpe works in per-period units, on the best variant's own returns.
  let deflated: SweepDeflation | null = null;
  const best = points.findIndex((p) => p.value === bestValue);
  if (best !== -1 && points.length >= 2) {
    const ppy = periodsPerYear(frame.dates);
    const perPeriod = returns.map((r) => periodSharpe(r.subarray(1), riskFree / ppy));
    const bestReturns = returns[best].subarray(1);
    const sr = perPeriod[best];
    if (sr !== null && bestReturns.length > 2) {
      const d = deflatedSharpe({
        sharpe: sr,
        observations: bestReturns.length,
        ...returnMoments(bestReturns),
        trials: points.length,
        trialSharpeVariance: sampleVariance(perPeriod),
      });
      deflated = {
        trials: points.length,
        probability: d.probability,
        luckSharpe: d.benchmarkSharpe * Math.sqrt(ppy),
        bestSharpe: sr * Math.sqrt(ppy),
      };
    }
  }

  return {
    parameter: "smaDays",
    points,
    bestValue,
    deflated,
    walkForward: walkForward({
      dates: frame.dates,
      values,
      returns,
      trainBars: WALK_FORWARD_TRAIN_BARS,
      testBars: WALK_FORWARD_TEST_BARS,
      riskFree,
    }),
    startDate: frame.dates[0],
    endDate: frame.dates[frame.dates.length - 1],
  };
}
