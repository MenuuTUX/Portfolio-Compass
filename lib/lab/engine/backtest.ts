import type { BarSeries } from "@/lib/lab/bar-types";
import { buildFrame, sliceFrame, type Frame, type FxSeries } from "@/lib/lab/engine/frame";
import { computeMetrics, type Metrics } from "@/lib/lab/engine/metrics";
import { runHash } from "@/lib/lab/engine/run-hash";
import { simulate, type BacktestConfig, type SimResult } from "@/lib/lab/engine/simulate";
import { compileStrategy, type NoCodeStrategy } from "@/lib/lab/no-code";

/** Weights computed on their own dates and tickers (a code strategy's universe), mapped onto the frame. */
export interface LabelledWeights {
  matrix: Float64Array;
  dates: string[];
  tickers: string[];
}

/** A weight matrix aligned to the frame (dates × tickers), labelled weights, a fixed allocation by ticker, or a no-code rule. */
export type Targets = Float64Array | LabelledWeights | Record<string, number> | { strategy: NoCodeStrategy };

/**
 * Place labelled weights onto the frame. Tickers outside the labels get 0; a
 * frame date the weights do not have (another listing's extra session) keeps
 * the previous row, as the weights stood at the last date they knew.
 */
export function alignWeights(frame: Frame, w: LabelledWeights): Float64Array {
  const N = frame.tickers.length;
  const M = w.tickers.length;
  const col = w.tickers.map((t) => {
    const j = frame.tickers.indexOf(t);
    if (j === -1) throw new Error(`${t} has weights but no prices`);
    return j;
  });
  const row = new Map(w.dates.map((d, t) => [d, t]));
  const out = new Float64Array(frame.dates.length * N);
  let src = -1;
  frame.dates.forEach((date, t) => {
    src = row.get(date) ?? src;
    if (src === -1) return;
    for (let k = 0; k < M; k++) out[t * N + col[k]] = w.matrix[src * M + k];
  });
  return out;
}

export interface BacktestRequest {
  series: BarSeries[];
  config: BacktestConfig;
  baseCurrency: string;
  fx?: FxSeries;
  targets: Targets;
  /**
   * First date of the backtest. `series` may start earlier: strategies are
   * computed on all of it so indicators are warm, and the simulation and every
   * result begin at this date.
   */
  start?: string;
  /** A ticker in `series` held throughout as the comparison. */
  benchmark?: string;
  /** Annual risk-free rate for Sharpe, Sortino and alpha; defaults to the config's cash rate. */
  riskFree?: number;
  /** Source and parameters, for the run hash. */
  strategy?: { code: string; params?: unknown };
}

export interface BacktestReport {
  dates: string[];
  tickers: string[];
  currency: string;
  /** Split-adjusted closes in `currency`, row-major like `sim.holdings`; NaN where a ticker had no bar. */
  close: Float64Array;
  sim: SimResult;
  metrics: Metrics;
  benchmark: { ticker: string; equity: Float64Array; metrics: Metrics } | null;
  hash: string;
}

export function fixedTargets(frame: Frame, allocation: Record<string, number>): Float64Array {
  const N = frame.tickers.length;
  const row = new Float64Array(N);
  for (const [ticker, w] of Object.entries(allocation)) {
    const j = frame.tickers.indexOf(ticker);
    if (j === -1) throw new Error(`${ticker} is in the allocation but not in the data`);
    row[j] = w;
  }
  const out = new Float64Array(frame.dates.length * N);
  for (let t = 0; t < frame.dates.length; t++) out.set(row, t * N);
  return out;
}

export async function runBacktest(req: BacktestRequest): Promise<BacktestReport> {
  const full = buildFrame(req.series, { baseCurrency: req.baseCurrency, fx: req.fx });
  const allTargets = req.targets instanceof Float64Array
    ? req.targets
    : "matrix" in req.targets
      ? alignWeights(full, req.targets as LabelledWeights)
      : "strategy" in req.targets
      ? compileStrategy(full, req.targets.strategy as NoCodeStrategy)
      : fixedTargets(full, req.targets);
  const { frame, targets } = sliceFrame(full, allTargets, req.start ?? "");
  const sim = simulate(frame, targets, req.config);

  const riskFree = req.riskFree ?? req.config.cashRate ?? 0;
  let benchmark: BacktestReport["benchmark"] = null;
  let benchmarkEquity: Float64Array | undefined;
  if (req.benchmark) {
    const benchConfig: BacktestConfig = { ...req.config, rebalance: { mode: "on-change" }, cashFlow: undefined };
    const bench = simulate(frame, fixedTargets(frame, { [req.benchmark]: 1 }), benchConfig);
    benchmarkEquity = bench.equity;
    benchmark = {
      ticker: req.benchmark,
      equity: bench.equity,
      metrics: computeMetrics(frame.dates, bench, { initialCash: req.config.initialCash, riskFree }),
    };
  }

  const metrics = computeMetrics(frame.dates, sim, {
    initialCash: req.config.initialCash,
    benchmark: benchmarkEquity,
    riskFree,
  });

  // A no-code rule is fully described by its parameters. Code can be
  // nondeterministic, so the weights it returned are part of the identity.
  const identity = !req.strategy
    ? { code: canonicalTargets(req.targets) }
    : "strategy" in req.targets
      ? req.strategy
      : { ...req.strategy, params: { given: req.strategy.params, weights: canonicalTargets(req.targets) } };
  const hash = await runHash(
    frame,
    { config: req.config, benchmark: req.benchmark ?? null, riskFree },
    identity,
  );

  return { dates: frame.dates, tickers: frame.tickers, currency: frame.currency, close: frame.close, sim, metrics, benchmark, hash };
}

/** Without strategy source, the targets themselves identify the strategy. */
function canonicalTargets(targets: Targets): string {
  if (targets instanceof Float64Array) {
    let h = 0x811c9dc5;
    const bytes = new Uint8Array(targets.buffer, targets.byteOffset, targets.byteLength);
    for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
    return `matrix:${targets.length}:${h.toString(16)}`;
  }
  if ("matrix" in targets) return `labelled:${canonicalTargets(targets.matrix as Float64Array)}:${JSON.stringify(targets.tickers)}`;
  if ("strategy" in targets) return `no-code:${JSON.stringify(targets.strategy)}`;
  return `fixed:${JSON.stringify(Object.entries(targets).sort(([a], [b]) => a.localeCompare(b)))}`;
}
