/**
 * Calculates Log Returns from a sequence of prices.
 * Returns[t] = ln(Price[t] / Price[t-1])
 */
export function calculateLogReturns(prices: number[]): number[] {
  if (!prices || !Array.isArray(prices)) {
    return [];
  }
  if (prices.length < 2) {
    return [];
  }
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const pPrev = Number(prices[i - 1]);
    const pCurr = Number(prices[i]);

    if (
      pPrev <= 0 ||
      pCurr <= 0 ||
      !Number.isFinite(pPrev) ||
      !Number.isFinite(pCurr)
    ) {
      continue;
    }

    const r = Math.log(pCurr) - Math.log(pPrev);
    returns.push(r);
  }
  return returns;
}

/**
 * Calculates the Mean of an array.
 */
function calculateMean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
}

/**
 * Calculates a linearly interpolated quantile from an unsorted sample.
 */
export function calculateQuantile(values: number[], probability: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const clampedProbability = Math.min(1, Math.max(0, probability));
  const position = (sorted.length - 1) * clampedProbability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) return sorted[lower];

  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
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

  // Calculate means for each asset
  const means = returns.map(calculateMean);

  // Initialize matrix
  const cov = Array.from({ length: numAssets }, () => Array(numAssets).fill(0));

  for (let i = 0; i < numAssets; i++) {
    for (let j = i; j < numAssets; j++) {
      // Symmetric, so calc upper triangle
      let sum = 0;
      for (let k = 0; k < numSamples; k++) {
        sum += (returns[i][k] - means[i]) * (returns[j][k] - means[j]);
      }
      const val = sum / (numSamples - 1); // Sample Covariance
      cov[i][j] = val;
      cov[j][i] = val;
    }
  }
  return cov;
}

/**
 * Performs Cholesky Decomposition to get the Lower Triangular Matrix (L).
 * L * L^T = CovarianceMatrix
 * A must be symmetric and positive definite.
 */
export function getCholeskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }

      if (i === j) {
        // Diagonal elements
        const val = matrix[i][i] - sum;
        if (!Number.isFinite(val) || val <= 0) {
          throw new Error(`Matrix is not positive definite at index ${i}`);
        }
        L[i][j] = Math.sqrt(val);
      } else {
        // Non-diagonal elements
        L[i][j] = (matrix[i][j] - sum) / L[j][j];
        if (!Number.isFinite(L[i][j])) {
          throw new Error(`Matrix contains non-finite values at index ${i}`);
        }
      }
    }
  }
  return L;
}

/**
 * Matrix Multiplication: A (nxm) * B (mx1) -> C (nx1)
 * Used for L * Z
 */
function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = Array(rows).fill(0);

  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += matrix[i][j] * vector[j];
    }
    result[i] = sum;
  }
  return result;
}

/**
 * Generates Monte Carlo simulation paths for a multi-asset portfolio.
 *
 * Price dynamics use geometric Brownian motion with correlated shocks
 * (via Cholesky). `meanReturns` are daily log-price-return drifts. The
 * simulation uses observed price returns only; it does not estimate or
 * include distributions.
 *
 * @param currentPrices         Spot prices per asset
 * @param weights               Portfolio weights (sum ≈ 1)
 * @param meanReturns           Daily log-price-return drifts
 * @param choleskyMatrix        L such that L Lᵀ = covariance of daily log returns
 * @param numSimulations        Number of independent paths
 * @param numDays               Trading days to simulate
 * @param initialPortfolioValue Starting wealth
 * @param seed                  Optional seed for repeatable simulations
 */
export function generateMonteCarloPaths(
  currentPrices: number[],
  weights: number[],
  meanReturns: number[],
  choleskyMatrix: number[][],
  numSimulations: number,
  numDays: number,
  initialPortfolioValue: number,
  seed?: number,
): number[][] {
  const numAssets = currentPrices.length;
  if (numAssets === 0 || weights.length !== numAssets || meanReturns.length !== numAssets) {
    throw new RangeError("Prices, weights, and returns must contain the same nonzero number of assets.");
  }
  if (currentPrices.some((price) => !Number.isFinite(price) || price <= 0)) {
    throw new RangeError("Every simulated asset must have a finite positive price.");
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0) ||
      Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) > 1e-6) {
    throw new RangeError("Portfolio weights must be finite, nonnegative, and sum to 1.");
  }
  if (meanReturns.some((mean) => !Number.isFinite(mean))) {
    throw new RangeError("Every simulated asset must have a finite daily return assumption.");
  }
  if (choleskyMatrix.length !== numAssets || choleskyMatrix.some(
    (row) => row.length !== numAssets || row.some((value) => !Number.isFinite(value)),
  )) {
    throw new RangeError("Covariance factor must be a finite square matrix matching the assets.");
  }
  if (!Number.isInteger(numSimulations) || numSimulations < 1 ||
      !Number.isInteger(numDays) || numDays < 1) {
    throw new RangeError("Simulation count and duration must be positive integers.");
  }
  if (!Number.isFinite(initialPortfolioValue) || initialPortfolioValue <= 0) {
    throw new RangeError("Starting portfolio value must be finite and positive.");
  }
  if (seed !== undefined && !Number.isFinite(seed)) {
    throw new RangeError("Simulation seed must be finite.");
  }

  const paths: number[][] = [];
  let randomState = seed;
  const random = () => {
    if (randomState === undefined) return Math.random();
    // Mulberry32 keeps seeded runs repeatable without a dependency.
    randomState = (randomState + 0x6d2b79f5) | 0;
    let value = randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  for (let sim = 0; sim < numSimulations; sim++) {
    const path: number[] = [initialPortfolioValue];
    // Buy-and-hold: share counts fixed at t=0.
    const shares = weights.map((w, i) => (initialPortfolioValue * w) / currentPrices[i]);

    const simAssetPrices = [...currentPrices];

    for (let day = 0; day < numDays; day++) {
      // 1. Uncorrelated standard normals
      const Z = Array.from({ length: numAssets }, () => boxMullerTransform(random));

      // 2. Correlate: shock = L · Z
      const R_shock = multiplyMatrixVector(choleskyMatrix, Z);

      // 3. Evolve price-only paths and mark portfolio.
      let totalValue = 0;
      for (let i = 0; i < numAssets; i++) {
        const logRet = meanReturns[i] + R_shock[i];
        simAssetPrices[i] *= Math.exp(logRet);
        if (!Number.isFinite(simAssetPrices[i]) || simAssetPrices[i] <= 0) {
          throw new RangeError("A simulated price became invalid.");
        }
        totalValue += simAssetPrices[i] * shares[i];
      }
      if (!Number.isFinite(totalValue) || totalValue <= 0) {
        throw new RangeError("A simulated portfolio value became invalid.");
      }
      path.push(totalValue);
    }
    paths.push(path);
  }

  return paths;
}

/**
 * Standard Normal variate using Box-Muller transform.
 */
function boxMullerTransform(random: () => number): number {
  let u = 0,
    v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Calculate percentiles (5th, 50th, 95th) for each day across all simulations.
 */
export interface MonteCarloCone {
  median: number[];
  p05: number[];
  p95: number[];
  dates: number[]; // Indices 0 to numDays
}

export function calculateCone(paths: number[][]): MonteCarloCone {
  if (paths.length === 0 || paths[0]?.length === 0) {
    return { median: [], p05: [], p95: [], dates: [] };
  }

  const numDays = paths[0].length;
  const medianPath: number[] = [];
  const p05Path: number[] = [];
  const p95Path: number[] = [];

  for (let day = 0; day < numDays; day++) {
    // Collect values for this day across all sims
    const values = paths.map((p) => p[day]);

    medianPath.push(calculateQuantile(values, 0.5));
    p05Path.push(calculateQuantile(values, 0.05));
    p95Path.push(calculateQuantile(values, 0.95));
  }

  return {
    median: medianPath,
    p05: p05Path,
    p95: p95Path,
    dates: Array.from({ length: numDays }, (_, i) => i),
  };
}
