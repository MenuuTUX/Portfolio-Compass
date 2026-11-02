import { computeMetrics, type Drawdown } from "@/lib/lab/engine/metrics";

// Walk-forward test over a set of candidate parameter values. For each window
// the value with the best Sharpe on the train bars is applied to the next test
// bars, and the test pieces are stitched into one out-of-sample curve.
//
// Each candidate's daily returns come from ONE simulation over the whole
// history, so a value carries the position it would have held had it been
// running all along. Switching value at a window edge pays no trading cost
// here. Both are approximations; the UI says so. Every figure comes from
// `computeMetrics`, so definitions match the rest of the Lab.

/** Fewest bars a train window needs for its Sharpe to mean anything. */
export const MIN_TRAIN_BARS = 126;
/** Fewest bars a test window needs. */
export const MIN_TEST_BARS = 21;

export interface WalkForwardInput {
  /** One date per bar. */
  dates: string[];
  /** The candidate parameter values. */
  values: number[];
  /** Per value, time-weighted daily returns aligned to `dates`; index 0 is the base bar. */
  returns: Float64Array[];
  trainBars: number;
  testBars: number;
  riskFree?: number;
}

export interface PieceStats {
  cagr: number;
  sharpe: number | null;
  volatility: number;
  maxDrawdown: Drawdown | null;
  totalReturn: number;
}

export interface WalkForwardWindow {
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  /** The value that had the best Sharpe on the train bars. */
  chosen: number;
  trainSharpe: number | null;
  /** The chosen value's Sharpe on the test bars that followed. */
  testSharpe: number | null;
}

export interface WalkForwardResult {
  windows: WalkForwardWindow[];
  /** Dates of the stitched out-of-sample curve, starting at the bar before the first test bar. */
  dates: string[];
  /** Growth of 1 on the stitched out-of-sample returns. */
  equity: Float64Array;
  outOfSample: PieceStats;
  /** The single value with the best Sharpe over the same span, chosen with hindsight. */
  inSampleBest: PieceStats & { value: number };
  trainBars: number;
  testBars: number;
}

/** Growth of 1 from daily returns; `r[0]` is the base bar and is ignored. */
function growth(r: ArrayLike<number>): Float64Array {
  const out = new Float64Array(r.length);
  out[0] = 1;
  for (let t = 1; t < r.length; t++) out[t] = out[t - 1] * (1 + r[t]);
  return out;
}

function stats(dates: string[], r: ArrayLike<number>, riskFree: number | undefined): PieceStats {
  const equity = growth(r);
  const m = computeMetrics(dates, { equity, flows: new Float64Array(equity.length), trades: [], costsPaid: 0, dividendsReceived: 0 }, { initialCash: 1, riskFree });
  return { cagr: m.cagr, sharpe: m.sharpe, volatility: m.volatility, maxDrawdown: m.maxDrawdown, totalReturn: m.totalReturn };
}

/** The return slice `[from, to)` as a series with a leading base bar, and the dates that go with it. */
function piece(dates: string[], r: Float64Array, from: number, to: number): { dates: string[]; r: Float64Array } {
  const out = new Float64Array(to - from + 1);
  out.set(r.subarray(from, to), 1);
  return { dates: dates.slice(from - 1, to), r: out };
}

const finite = (r: Float64Array, from: number, to: number) => {
  for (let t = from; t < to; t++) if (!Number.isFinite(r[t])) return false;
  return true;
};

/**
 * Returns null when the history is too short for at least two windows. A value
 * with a missing (non-finite) return inside a window is not eligible for it;
 * nothing is filled in. A window with no eligible value is skipped and the
 * stitched curve then ends before it, so only contiguous windows are stitched.
 */
export function walkForward(input: WalkForwardInput): WalkForwardResult | null {
  const { dates, values, returns, trainBars, testBars, riskFree } = input;
  if (values.length < 2 || returns.length !== values.length) return null;
  if (trainBars < MIN_TRAIN_BARS || testBars < MIN_TEST_BARS) return null;
  const T = dates.length;
  if (returns.some((r) => r.length !== T)) throw new RangeError("Every return series must have one value per date.");

  const windows: WalkForwardWindow[] = [];
  const stitched: number[] = [];
  let firstTest = -1;
  let lastTestEnd = -1;
  for (let a = 1; a + trainBars + testBars <= T; a += testBars) {
    const trainEnd = a + trainBars; // exclusive
    const testEnd = trainEnd + testBars; // exclusive
    let best = -1;
    let bestSharpe = -Infinity;
    let bestTrainSharpe: number | null = null;
    values.forEach((_, i) => {
      if (!finite(returns[i], a, testEnd)) return;
      const p = piece(dates, returns[i], a, trainEnd);
      const s = stats(p.dates, p.r, riskFree).sharpe;
      if (s !== null && s > bestSharpe) {
        best = i;
        bestSharpe = s;
        bestTrainSharpe = s;
      }
    });
    if (best === -1) {
      // No usable value: the stitched curve cannot continue across this gap.
      if (firstTest !== -1) break;
      continue;
    }
    const test = piece(dates, returns[best], trainEnd, testEnd);
    if (firstTest === -1) firstTest = trainEnd;
    for (let t = trainEnd; t < testEnd; t++) stitched.push(returns[best][t]);
    lastTestEnd = testEnd;
    windows.push({
      trainStart: dates[a],
      trainEnd: dates[trainEnd - 1],
      testStart: dates[trainEnd],
      testEnd: dates[testEnd - 1],
      chosen: values[best],
      trainSharpe: bestTrainSharpe,
      testSharpe: stats(test.dates, test.r, riskFree).sharpe,
    });
  }
  if (windows.length < 2) return null;

  const spanDates = dates.slice(firstTest - 1, lastTestEnd);
  const oos = new Float64Array(stitched.length + 1);
  oos.set(stitched, 1);

  // The in-sample best, picked with hindsight over exactly the span the stitched curve covers.
  let bestI = -1;
  let bestS = -Infinity;
  returns.forEach((r, i) => {
    if (!finite(r, firstTest, lastTestEnd)) return;
    const p = piece(dates, r, firstTest, lastTestEnd);
    const s = stats(p.dates, p.r, riskFree).sharpe;
    if (s !== null && s > bestS) {
      bestI = i;
      bestS = s;
    }
  });
  if (bestI === -1) return null;
  const bp = piece(dates, returns[bestI], firstTest, lastTestEnd);

  return {
    windows,
    dates: spanDates,
    equity: growth(oos),
    outOfSample: stats(spanDates, oos, riskFree),
    inSampleBest: { value: values[bestI], ...stats(bp.dates, bp.r, riskFree) },
    trainBars,
    testBars,
  };
}
