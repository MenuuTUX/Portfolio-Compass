// Remove mathjs dependency
// import { create, all } from 'mathjs';

/**
 * Calculates Log Returns from a sequence of prices.
 * Returns[t] = ln(Price[t] / Price[t-1])
 */
export function calculateLogReturns(prices: number[]): number[] {
  // Robust array check
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

    if (pPrev <= 0 || pCurr <= 0 || isNaN(pPrev) || isNaN(pCurr)) {
      continue;
    }

    const r = Math.log(pCurr / pPrev);
    returns.push(r);
  }
  return returns;
}

/**
 * Calculates the Mean of an array.
 */
export function calculateMean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
}

/**
 * Calculates the Covariance Matrix for a set of asset returns.
 * Input: Array of arrays, where each inner array is the sequence of returns for one asset.
 * Output: 2D array representing the covariance matrix (N x N).
 */
export function calculateCovarianceMatrix(allReturns: number[][]): number[][] {
  if (allReturns.length === 0) return [];

  const numAssets = allReturns.length;
  const numSamples = allReturns[0].length;

  if (numSamples < 2) return Array(numAssets).fill(Array(numAssets).fill(0));

  // Calculate means for each asset
  const means = allReturns.map(calculateMean);

  // Initialize matrix
  const cov = Array.from({ length: numAssets }, () => Array(numAssets).fill(0));

  for (let i = 0; i < numAssets; i++) {
    for (let j = i; j < numAssets; j++) {
      // Symmetric, so calc upper triangle
      let sum = 0;
      for (let k = 0; k < numSamples; k++) {
        sum += (allReturns[i][k] - means[i]) * (allReturns[j][k] - means[j]);
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
        if (val <= 0) {
          throw new Error(`Matrix is not positive definite at index ${i}`);
        }
        L[i][j] = Math.sqrt(val);
      } else {
        // Non-diagonal elements
        L[i][j] = (matrix[i][j] - sum) / L[j][j];
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
 * Generates Monte Carlo simulation paths.
 */
export function generateMonteCarloPaths(
  currentPrices: number[],
  weights: number[],
  meanReturns: number[],
  choleskyMatrix: number[][],
  numSimulations: number,
  numDays: number,
  initialPortfolioValue: number,
): number[][] {
  const numAssets = currentPrices.length;
  const paths: number[][] = [];

  // Pre-calculate drift (assuming meanReturns are daily log returns)
  // Standard drift in GBM is (mu - 0.5*sigma^2), but if we estimated 'mu' from historical log returns directly,
  // that 'mu' IS the estimator for E[log return]. So we just use it.

  for (let sim = 0; sim < numSimulations; sim++) {
    const path: number[] = [initialPortfolioValue];
    // We track total value, but to do so accurately with rebalancing/drift, we track shares or asset values.
    // "Buy and Hold" strategy: Shares are fixed at t=0.

    // Initial Shares
    const shares = weights.map(
      (w, i) => (initialPortfolioValue * w) / currentPrices[i],
    );

    // Current Sim Asset Prices
    const simAssetPrices = [...currentPrices];

    for (let day = 0; day < numDays; day++) {
      // 1. Generate uncorrelated random normals
      const Z = Array.from({ length: numAssets }, () => boxMullerTransform());

      // 2. Correlate them: R_shock = L * Z
      const R_shock = multiplyMatrixVector(choleskyMatrix, Z);

      // 3. Update Prices
      let totalValue = 0;
      for (let i = 0; i < numAssets; i++) {
        // r = mean + shock
        const logRet = meanReturns[i] + R_shock[i];
        simAssetPrices[i] = simAssetPrices[i] * Math.exp(logRet);
        totalValue += simAssetPrices[i] * shares[i];
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
function boxMullerTransform(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Calculate percentiles (5th, 50th, 95th) for each day across all simulations.
 */
export function calculateCone(paths: number[][]): {
  median: number[];
  p05: number[];
  p95: number[];
  dates: number[]; // Indices 0 to numDays
} {
  const numDays = paths[0].length;
  const medianPath: number[] = [];
  const p05Path: number[] = [];
  const p95Path: number[] = [];

  for (let day = 0; day < numDays; day++) {
    // Collect values for this day across all sims
    const values = paths.map((p) => p[day]);
    // Sort
    values.sort((a, b) => a - b);

    const n = values.length;
    medianPath.push(values[Math.floor(n * 0.5)]);
    p05Path.push(values[Math.floor(n * 0.05)]);
    p95Path.push(values[Math.floor(n * 0.95)]);
  }

  return {
    median: medianPath,
    p05: p05Path,
    p95: p95Path,
    dates: Array.from({ length: numDays }, (_, i) => i),
  };
}
