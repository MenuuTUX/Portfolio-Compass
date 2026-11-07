import { olsSlope } from "@/lib/math/stats";

// Beta against the market from two weekly price series (adjusted for splits and dividends). Pure.

export function simpleReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    out.push(a > 0 && Number.isFinite(a) && Number.isFinite(b) ? b / a - 1 : NaN);
  }
  return out;
}

export interface BetaEstimate {
  beta: number;
  /** Standard error of the slope; a wide one means the beta is a rough guide. */
  standardError: number;
  observations: number;
}

/** Ordinary least squares slope of asset returns on market returns, or null with too little data. */
export function olsBeta(asset: number[], market: number[], minObservations = 52): BetaEstimate | null {
  const x: number[] = [];
  const y: number[] = [];
  const n = Math.min(asset.length, market.length);
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(asset[i]) && Number.isFinite(market[i])) {
      y.push(asset[i]);
      x.push(market[i]);
    }
  }
  if (x.length < minObservations) return null;
  const fit = olsSlope(x, y);
  if (!fit) return null;
  const { slope: beta, intercept: alpha, sxx } = fit;
  let sse = 0;
  for (let i = 0; i < x.length; i++) sse += (y[i] - alpha - beta * x[i]) ** 2;
  const standardError = Math.sqrt(sse / (x.length - 2) / sxx);
  return { beta, standardError, observations: x.length };
}

const WEEKS_FOR_BETA = 104;

/** Weekly adjusted closes of an asset and the market on their shared dates, newest last, at most two years. */
export function weeklyPairs(
  asset: readonly { date: string; price: number; adjPrice?: number }[],
  market: readonly { date: string; price: number; adjPrice?: number }[],
) {
  const marketByDate = new Map(market.map((p) => [p.date.slice(0, 10), p.adjPrice ?? p.price]));
  const a: number[] = [];
  const m: number[] = [];
  for (const p of asset) {
    const close = marketByDate.get(p.date.slice(0, 10));
    if (close !== undefined) {
      a.push(p.adjPrice ?? p.price);
      m.push(close);
    }
  }
  return { asset: a.slice(-(WEEKS_FOR_BETA + 1)), market: m.slice(-(WEEKS_FOR_BETA + 1)) };
}
