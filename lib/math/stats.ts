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

/**
 * Calculates the Covariance Matrix for a set of asset returns.
 * Input: Array of arrays, where each inner array is the sequence of returns for one asset.
 * Output: 2D array representing the covariance matrix (N x N).
 */
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

