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
  return quantileOfSorted([...values].sort((a, b) => a - b), probability);
}

/** Same interpolation as `calculateQuantile`, for a sample already sorted ascending. */
function quantileOfSorted(sorted: ArrayLike<number>, probability: number): number {
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
 * Cholesky with a fallback for near-duplicate holdings. Two funds tracking the
 * same index (VOO and IVV, say) give a covariance that is singular or nearly
 * so, and rounding can push a diagonal term to zero or below. In that case a
 * small ridge, a fraction of the average variance, is added to the diagonal and
 * retried. `ridge` is that fraction (0 when none was needed), so the caller can
 * say so. A ridge of 1e-4 changes each volatility by about 0.005%.
 */
export function getRegularizedCholesky(matrix: number[][]): { L: number[][]; ridge: number } {
  try {
    return { L: getCholeskyDecomposition(matrix), ridge: 0 };
  } catch (error) {
    const n = matrix.length;
    const meanVariance = matrix.reduce((sum, row, i) => sum + row[i], 0) / n;
    if (!(meanVariance > 0) || !Number.isFinite(meanVariance)) throw error;
    for (const ridge of [1e-8, 1e-6, 1e-4]) {
      const bumped = matrix.map((row, i) => row.map((v, j) => (i === j ? v + ridge * meanVariance : v)));
      try {
        return { L: getCholeskyDecomposition(bumped), ridge };
      } catch {
        // try a larger ridge
      }
    }
    throw error;
  }
}

/**
 * Uniform [0, 1) generator. With a seed it is Mulberry32, so seeded runs repeat
 * exactly without a dependency; without one it falls back to Math.random.
 */
export function createRandom(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [0, n). */
export function randomIndex(random: () => number, n: number): number {
  return Math.min(n - 1, Math.floor(random() * n));
}

/**
 * Generates Monte Carlo simulation paths for a multi-asset portfolio.
 *
 * Price dynamics use geometric Brownian motion with correlated shocks
 * (via Cholesky). `meanReturns` are daily log-return drifts exactly as the
 * caller measured them: total return when built from dividend-adjusted closes,
 * price return otherwise. The simulation never adds a separate distribution
 * or yield term, so a total-return drift does not count dividends twice.
 *
 * @param currentPrices         Spot prices per asset
 * @param weights               Portfolio weights (sum ≈ 1)
 * @param meanReturns           Daily log-return drifts
 * @param choleskyMatrix        L such that L Lᵀ = covariance of daily log returns
 * @param numSimulations        Number of independent paths
 * @param numDays               Trading days to simulate
 * @param initialPortfolioValue Starting wealth
 * @param seed                  Optional seed for repeatable simulations
 * @param stepDays              Trading days per simulated step (default 1). With
 *                              k > 1 each step draws drift k·μ and shock √k·L·Z,
 *                              which is exactly the distribution of k summed daily
 *                              log returns, so values at step ends are unchanged
 *                              in distribution and many more paths are affordable.
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
  stepDays = 1,
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
  if (!Number.isInteger(stepDays) || stepDays < 1) {
    throw new RangeError("Step length must be a positive whole number of days.");
  }
  if (seed !== undefined && !Number.isFinite(seed)) {
    throw new RangeError("Simulation seed must be finite.");
  }

  const paths: number[][] = [];
  const shockScale = Math.sqrt(stepDays);
  const random = createRandom(seed);

  // Buffers reused across every step: allocating them per step dominated the
  // run time. The draw order is unchanged, so a seed gives the same paths.
  const Z = new Float64Array(numAssets);
  const simAssetPrices = new Float64Array(numAssets);
  const shares = weights.map((w, i) => (initialPortfolioValue * w) / currentPrices[i]);

  for (let sim = 0; sim < numSimulations; sim++) {
    const path: number[] = new Array(numDays + 1);
    path[0] = initialPortfolioValue;
    // Buy-and-hold: share counts fixed at t=0.
    for (let i = 0; i < numAssets; i++) simAssetPrices[i] = currentPrices[i];

    for (let day = 0; day < numDays; day++) {
      // 1. Uncorrelated standard normals
      for (let i = 0; i < numAssets; i++) Z[i] = boxMullerTransform(random);

      // 2-3. Correlate (shock = L · Z), evolve with the caller's drift, and mark.
      let totalValue = 0;
      for (let i = 0; i < numAssets; i++) {
        const row = choleskyMatrix[i];
        let shock = 0;
        for (let j = 0; j < numAssets; j++) shock += row[j] * Z[j];
        const logRet = meanReturns[i] * stepDays + shock * shockScale;
        simAssetPrices[i] *= Math.exp(logRet);
        if (!Number.isFinite(simAssetPrices[i]) || simAssetPrices[i] <= 0) {
          throw new RangeError("A simulated price became invalid.");
        }
        totalValue += simAssetPrices[i] * shares[i];
      }
      if (!Number.isFinite(totalValue) || totalValue <= 0) {
        throw new RangeError("A simulated portfolio value became invalid.");
      }
      path[day + 1] = totalValue;
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
 * Percentiles for each recorded step across all simulations.
 */
export interface MonteCarloCone {
  median: number[];
  p05: number[];
  p10: number[];
  p90: number[];
  p95: number[];
  dates: number[]; // Step indices 0 to numSteps
}

export function calculateCone(paths: number[][]): MonteCarloCone {
  if (paths.length === 0 || paths[0]?.length === 0) {
    return { median: [], p05: [], p10: [], p90: [], p95: [], dates: [] };
  }

  const numDays = paths[0].length;
  const cone: MonteCarloCone = { median: [], p05: [], p10: [], p90: [], p95: [], dates: [] };

  const values = new Float64Array(paths.length);
  for (let day = 0; day < numDays; day++) {
    // Collect values for this step across all sims; sort once for every quantile.
    for (let s = 0; s < paths.length; s++) values[s] = paths[s][day];
    values.sort();

    cone.median.push(quantileOfSorted(values, 0.5));
    cone.p05.push(quantileOfSorted(values, 0.05));
    cone.p10.push(quantileOfSorted(values, 0.1));
    cone.p90.push(quantileOfSorted(values, 0.9));
    cone.p95.push(quantileOfSorted(values, 0.95));
    cone.dates.push(day);
  }

  return cone;
}

// ---------------------------------------------------------------------------
// Three simulation modes
// ---------------------------------------------------------------------------

/**
 * - reshuffle: the historical days in a random order. Every path ends at the
 *   same value; only the route differs (sequence risk).
 * - resample: historical days drawn with replacement (bootstrap), optionally in
 *   blocks of consecutive days. Ending values differ.
 * - randomize: geometric Brownian motion fitted to the history (parametric).
 */
export type SimulationMode = "reshuffle" | "resample" | "randomize";

export const SIMULATION_MODES: readonly SimulationMode[] = ["reshuffle", "resample", "randomize"];

/**
 * Added to the run seed per mode so each mode is reproducible on its own.
 * Randomize is 0 so seeds saved before the modes existed still give the same paths.
 */
export const MODE_SEED_OFFSET: Record<SimulationMode, number> = {
  randomize: 0,
  resample: 1000,
  reshuffle: 2000,
};

export interface SimulationInput {
  /** Aligned daily log returns, [asset][day]. Every row the same length. */
  returns: number[][];
  currentPrices: number[];
  /** Portfolio weights, summing to 1. */
  weights: number[];
  initialValue: number;
  numPaths: number;
  /** Horizon in trading days. */
  numDays: number;
  /** Values are recorded every stepDays (default 1); the last step may be shorter. */
  stepDays?: number;
  seed?: number;
  /** Resample only: consecutive days per bootstrap block. 1 is a plain bootstrap. */
  blockDays?: number;
}

export interface SimulationRun {
  mode: SimulationMode;
  /** paths[i][k] is the value at day days[k]; paths[i][0] is initialValue. */
  paths: number[][];
  /** Trading day of each recorded point. */
  days: number[];
  /** Reshuffle only: the same days in their historical order, on the same grid. */
  referencePath?: number[];
  /** Randomize only: covariance ridge used (see getRegularizedCholesky). */
  ridge?: number;
}

function validateSimulationInput(input: SimulationInput) {
  const { returns, currentPrices, weights, initialValue, numPaths, numDays } = input;
  const stepDays = input.stepDays ?? 1;
  const n = currentPrices.length;
  if (n === 0 || weights.length !== n || returns.length !== n) {
    throw new RangeError("Prices, weights, and returns must contain the same nonzero number of assets.");
  }
  const T = returns[0]?.length ?? 0;
  if (T < 2 || returns.some((row) => row.length !== T)) {
    throw new RangeError("Every asset needs the same number of historical returns, at least two.");
  }
  if (returns.some((row) => row.some((r) => !Number.isFinite(r)))) {
    throw new RangeError("Historical returns must be finite.");
  }
  if (currentPrices.some((price) => !Number.isFinite(price) || price <= 0)) {
    throw new RangeError("Every simulated asset must have a finite positive price.");
  }
  if (weights.some((w) => !Number.isFinite(w) || w < 0) ||
      Math.abs(weights.reduce((sum, w) => sum + w, 0) - 1) > 1e-6) {
    throw new RangeError("Portfolio weights must be finite, nonnegative, and sum to 1.");
  }
  if (!Number.isInteger(numPaths) || numPaths < 1 || !Number.isInteger(numDays) || numDays < 1) {
    throw new RangeError("Simulation count and duration must be positive integers.");
  }
  if (!Number.isFinite(initialValue) || initialValue <= 0) {
    throw new RangeError("Starting portfolio value must be finite and positive.");
  }
  if (!Number.isInteger(stepDays) || stepDays < 1) {
    throw new RangeError("Step length must be a positive whole number of days.");
  }
  if (input.blockDays !== undefined &&
      (!Number.isInteger(input.blockDays) || input.blockDays < 1 || input.blockDays > T)) {
    throw new RangeError("Block length must be a whole number of days within the history.");
  }
  if (input.seed !== undefined && !Number.isFinite(input.seed)) {
    throw new RangeError("Simulation seed must be finite.");
  }
  return { n, T, stepDays };
}

/** Day index of each recorded point: 0, step, 2·step, ..., numDays. */
function recordedDays(numDays: number, stepDays: number): number[] {
  const days = [0];
  for (let d = stepDays; d < numDays; d += stepDays) days.push(d);
  days.push(numDays);
  return days;
}

/** Mean daily log return per asset and the regularized Cholesky factor of their covariance. */
export function fitReturnModel(returns: number[][]) {
  const meanReturns = returns.map((row) => calculateMean(row));
  const { L, ridge } = getRegularizedCholesky(calculateCovarianceMatrix(returns));
  return { meanReturns, cholesky: L, ridge };
}

/**
 * One interface for all three modes. Reshuffle and Resample replay whole
 * historical days (every asset's return from the same date), so same-day
 * co-movement between holdings is kept without a covariance model. All modes
 * value a buy-and-hold portfolio: share counts are fixed at t = 0.
 */
export function simulatePaths(mode: SimulationMode, input: SimulationInput): SimulationRun {
  const { n, T, stepDays } = validateSimulationInput(input);
  const { returns, currentPrices, weights, initialValue, numPaths, numDays, seed } = input;
  const days = recordedDays(numDays, stepDays);

  if (mode === "randomize") {
    const { meanReturns, cholesky, ridge } = fitReturnModel(returns);
    if (numDays % stepDays !== 0) {
      throw new RangeError("Randomize needs a horizon that is a whole number of steps.");
    }
    const paths = generateMonteCarloPaths(
      currentPrices, weights, meanReturns, cholesky,
      numPaths, numDays / stepDays, initialValue, seed, stepDays,
    );
    return { mode, paths, days, ridge };
  }

  const random = createRandom(seed);
  // Day-major copy so one historical day is a contiguous row.
  const R = new Float64Array(T * n);
  for (let i = 0; i < n; i++) for (let t = 0; t < T; t++) R[t * n + i] = returns[i][t];
  const startValues = weights.map((w) => initialValue * w);
  const logPrice = new Float64Array(n);
  const blockDays = mode === "resample" ? input.blockDays ?? 1 : 1;
  const order = mode === "reshuffle" ? new Int32Array(numDays) : null;

  // Marks one path given a function that returns the historical row for day d.
  const markPath = (rowFor: (d: number) => number): number[] => {
    logPrice.fill(0);
    const path = new Array<number>(days.length);
    path[0] = initialValue;
    let d = 0;
    for (let k = 1; k < days.length; k++) {
      for (; d < days[k]; d++) {
        const base = rowFor(d) * n;
        for (let i = 0; i < n; i++) logPrice[i] += R[base + i];
      }
      let value = 0;
      for (let i = 0; i < n; i++) value += startValues[i] * Math.exp(logPrice[i]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError("A simulated portfolio value became invalid.");
      }
      path[k] = value;
    }
    return path;
  };

  const paths: number[][] = [];
  for (let sim = 0; sim < numPaths; sim++) {
    if (order) {
      // Tile the history to the horizon, then Fisher-Yates shuffle all of it.
      for (let d = 0; d < numDays; d++) order[d] = d % T;
      for (let d = numDays - 1; d > 0; d--) {
        const j = randomIndex(random, d + 1);
        const tmp = order[d];
        order[d] = order[j];
        order[j] = tmp;
      }
      paths.push(markPath((d) => order[d]));
    } else {
      let blockStart = 0;
      paths.push(markPath((d) => {
        const offset = d % blockDays;
        if (offset === 0) blockStart = randomIndex(random, T);
        return (blockStart + offset) % T;
      }));
    }
  }

  const run: SimulationRun = { mode, paths, days };
  if (mode === "reshuffle") run.referencePath = markPath((d) => d % T);
  return run;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

/** Largest peak-to-trough fall along a path, as a fraction (0.25 = fell 25%). */
export function maxDrawdown(path: ArrayLike<number>): number {
  let peak = -Infinity;
  let worst = 0;
  for (let i = 0; i < path.length; i++) {
    const v = path[i];
    if (v > peak) peak = v;
    else if (peak > 0) worst = Math.max(worst, (peak - v) / peak);
  }
  return worst;
}

export interface OutcomeSummary {
  /** Ending value percentiles. */
  p05: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number;
  /** Share of paths ending below the starting value. */
  chanceOfLoss: number;
  /** Peak-to-trough fall: the median path's, and the one 1 in 10 paths matched or exceeded. */
  maxDrawdown: { p50: number; p90: number };
  /** Share of paths that were below the starting value at some recorded point. */
  everBelowStart: number;
}

export function summarizeOutcomes(paths: number[][], initialValue: number): OutcomeSummary {
  const finals = paths.map((p) => p[p.length - 1]).sort((a, b) => a - b);
  const drawdowns = paths.map(maxDrawdown).sort((a, b) => a - b);
  const count = Math.max(1, paths.length);
  // A tolerance so reshuffled paths that end exactly at the start (round-off) are not losses.
  const below = initialValue * (1 - 1e-9);
  return {
    p05: quantileOfSorted(finals, 0.05),
    p10: quantileOfSorted(finals, 0.1),
    p25: quantileOfSorted(finals, 0.25),
    p50: quantileOfSorted(finals, 0.5),
    p75: quantileOfSorted(finals, 0.75),
    p90: quantileOfSorted(finals, 0.9),
    p95: quantileOfSorted(finals, 0.95),
    chanceOfLoss: finals.filter((v) => v < below).length / count,
    maxDrawdown: {
      p50: quantileOfSorted(drawdowns, 0.5),
      p90: quantileOfSorted(drawdowns, 0.9),
    },
    everBelowStart: paths.filter((p) => p.some((v) => v < below)).length / count,
  };
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
  /** True when the whole bin is below zero. */
  loss: boolean;
}

/**
 * Bins ending returns on a grid anchored at 0, so 0 is always a bin edge and
 * the loss/gain color split is exact. Width is (max - min) / targetBins.
 */
export function returnHistogram(endReturns: number[], targetBins = 30): HistogramBin[] {
  const values = endReturns.filter(Number.isFinite);
  if (values.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max - min < 1e-12) {
    return [{ from: min, to: max, count: values.length, loss: max < 0 }];
  }
  const width = (max - min) / Math.max(1, targetBins);
  const first = Math.floor(min / width);
  const binCount = Math.max(1, Math.floor(max / width) - first + 1);
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, k) => {
    const from = (first + k) * width;
    const to = (first + k + 1) * width;
    return { from, to, count: 0, loss: to <= 1e-12 };
  });
  for (const v of values) {
    const k = Math.min(binCount - 1, Math.max(0, Math.floor(v / width) - first));
    bins[k].count++;
  }
  return bins;
}

/** Index of the path whose ending value is the median (a real path, not the pointwise median). */
export function medianPathIndex(paths: number[][]): number {
  if (paths.length === 0) return -1;
  const order = paths.map((_, i) => i).sort(
    (a, b) => paths[a][paths[a].length - 1] - paths[b][paths[b].length - 1],
  );
  return order[Math.floor((order.length - 1) / 2)];
}
