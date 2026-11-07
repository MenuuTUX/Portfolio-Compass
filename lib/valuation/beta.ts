// Beta against the market from two price series. Pure; the caller supplies the
// closes (weekly, adjusted for splits and dividends) already aligned by date.

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
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < x.length; i++) {
    sxx += (x[i] - mx) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  if (!(sxx > 0)) return null;
  const beta = sxy / sxx;
  const alpha = my - beta * mx;
  let sse = 0;
  for (let i = 0; i < x.length; i++) sse += (y[i] - alpha - beta * x[i]) ** 2;
  const standardError = Math.sqrt(sse / (x.length - 2) / sxx);
  return { beta, standardError, observations: x.length };
}
