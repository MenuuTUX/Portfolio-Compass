/** Log returns, ln(P[t] / P[t-1]); pairs with a non-positive or non-finite price are skipped. */
export function calculateLogReturns(prices: number[]): number[] {
  if (!Array.isArray(prices) || prices.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const pPrev = Number(prices[i - 1]);
    const pCurr = Number(prices[i]);
    if (pPrev <= 0 || pCurr <= 0 || !Number.isFinite(pPrev) || !Number.isFinite(pCurr)) continue;
    returns.push(Math.log(pCurr) - Math.log(pPrev));
  }
  return returns;
}

export function mean(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return xs.length ? s / xs.length : 0;
}

/** Sample standard deviation (n - 1). */
export function std(xs: ArrayLike<number>): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += (xs[i] - m) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}

/** Sample covariance matrix (N x N) of one return series per asset. */
export function calculateCovarianceMatrix(allReturns: number[][]): number[][] {
  if (allReturns.length === 0) return [];

  const numAssets = allReturns.length;
  const numSamples = Math.min(...allReturns.map((returns) => returns.length));

  if (numSamples < 2) {
    return Array.from({ length: numAssets }, () =>
      Array(numAssets).fill(0),
    );
  }

  // Callers should align observations before estimating covariance. Keeping a
  // common trailing window here prevents malformed or partially hydrated data
  // from producing NaN values if this low-level helper is used directly.
  const returns = allReturns.map((series) => series.slice(-numSamples));

  const means = returns.map((row) => mean(row));

  const cov = Array.from({ length: numAssets }, () => Array(numAssets).fill(0));

  for (let i = 0; i < numAssets; i++) {
    for (let j = i; j < numAssets; j++) {
      let sum = 0;
      for (let k = 0; k < numSamples; k++) {
        sum += (returns[i][k] - means[i]) * (returns[j][k] - means[j]);
      }
      const val = sum / (numSamples - 1);
      cov[i][j] = val;
      cov[j][i] = val;
    }
  }
  return cov;
}


/** Least-squares line y = intercept + slope * x, or null when x has no variance. */
export function olsSlope(x: number[], y: number[]): { slope: number; intercept: number; sxx: number } | null {
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < x.length; i++) {
    sxx += (x[i] - mx) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  if (!(sxx > 0)) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, sxx };
}
