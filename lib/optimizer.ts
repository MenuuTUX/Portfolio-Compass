import { Decimal } from "@/lib/decimal";
import { PortfolioItem } from "@/types";
import { getReportedAssetYieldFraction } from "@/lib/math/portfolio-returns";

export interface GreedyOptimizationParams {
  candidates: {
    ticker: string;
    price: number;
    expectedReturn: number;
  }[];
  /**
   * Full covariance matrix of annual returns, indexed to `candidates`.
   *
   * Off-diagonal terms matter more than the diagonal here. With a diagonal-only
   * matrix the model believes portfolio variance falls as 1/n for *any* n
   * assets, so sixteen S&P trackers price as 3.8% volatility instead of 15%.
   * Pass real covariance whenever return history is available.
   */
  covarianceMatrix: number[][];
  lambda?: number;
  riskProfile?: "conservative" | "balanced" | "growth";
  budget: number;
  initialShares?: Record<string, number>;
}

export interface GreedyOptimizationResult {
  /** Total shares per ticker after the proposed buys. */
  shares: Record<string, number>;
  /** Shares this run proposes adding. Never negative: the allocator cannot sell. */
  addedShares: Record<string, number>;
  /**
   * Market-value weights of the resulting portfolio. Covers priced candidates
   * only — an `initialShares` entry with no matching candidate is carried into
   * `shares` untouched but cannot be weighted without a price.
   */
  weights: Record<string, number>;
  utility: number;
  remainingBudget: number;
}

const LAMBDA_BY_PROFILE = {
  conservative: 10.0,
  balanced: 5.0,
  growth: 1.0,
} as const;

/** Nominal dollar value of one greedy step. */
const STEP_VALUE = 100;

/**
 * Ceiling on greedy iterations. Each iteration costs O(n²) in the covariance
 * walk, so a fixed $100 step made runtime linear in the budget: a 100-asset
 * portfolio with a $20M target took 98 seconds of blocked main thread. Scaling
 * the step to the budget bounds the work; at large budgets the answer is a set
 * of weights, and a chunkier lot size does not change them meaningfully.
 */
const MAX_ITERATIONS = 400;

export function riskPenaltyForProfile(
  profile: NonNullable<GreedyOptimizationParams["riskProfile"]>,
): number {
  return LAMBDA_BY_PROFILE[profile];
}

/** Tickers without an issuer-sourced yield or reported beta cannot receive a score. */
export function getOptimizerInputGaps(portfolio: readonly PortfolioItem[]): string[] {
  return portfolio
    .filter((item) =>
      getReportedAssetYieldFraction(item) === null ||
      !item.metrics?.yieldSource?.startsWith("Issuer ") ||
      typeof item.beta !== "number" || !Number.isFinite(item.beta),
    )
    .map((item) => item.ticker);
}

/** U(w) = expectedReturn − λ × annual variance, for the supplied share counts. */
export function calculatePortfolioUtility(
  candidates: GreedyOptimizationParams["candidates"],
  covarianceMatrix: number[][],
  lambda: number,
  shares: ArrayLike<number>,
): number {
  const totalValue = candidates.reduce(
    (sum, candidate, i) => sum + shares[i] * candidate.price,
    0,
  );
  if (!(totalValue > 0)) return 0;

  const weights = candidates.map(
    (candidate, i) => (shares[i] * candidate.price) / totalValue,
  );
  const meanReturn = candidates.reduce(
    (sum, candidate, i) => sum + weights[i] * candidate.expectedReturn,
    0,
  );
  let variance = 0;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      variance += weights[i] * covarianceMatrix[i][j] * weights[j];
    }
  }
  return meanReturn - lambda * variance;
}

/**
 * Greedy marginal-utility allocator for discrete share counts.
 *
 * Objective: maximize U(w) = μ_p − λ·σ²_p, subject to whole shares and a cash
 * budget. Each iteration buys the lot with the best *utility gain per dollar*,
 * which is what makes the comparison fair across assets whose share prices —
 * and therefore whose minimum lot sizes — differ by an order of magnitude.
 *
 * Scope worth stating plainly: this only ever adds. It cannot sell, so it
 * rebalances a portfolio by dilution, and an existing holding that is dominated
 * on both return and risk stays where it is.
 */
export function optimizePortfolioGreedy(
  params: GreedyOptimizationParams,
): GreedyOptimizationResult {
  const {
    candidates,
    covarianceMatrix,
    lambda: paramLambda,
    riskProfile,
    budget,
    initialShares = {},
  } = params;

  const lambda = riskProfile
    ? riskPenaltyForProfile(riskProfile)
    : (paramLambda ?? 1.0);

  const numAssets = candidates.length;

  if (!Number.isFinite(budget) || budget < 0) {
    throw new RangeError("Optimization budget must be finite and non-negative.");
  }

  if (numAssets === 0 || !(budget > 0)) {
    const startingShares = candidates.map(
      (candidate) => initialShares[candidate.ticker] || 0,
    );
    return {
      shares: { ...initialShares },
      addedShares: {},
      weights: {},
      utility: calculatePortfolioUtility(
        candidates,
        covarianceMatrix,
        lambda,
        startingShares,
      ),
      remainingBudget: Math.max(0, budget) || 0,
    };
  }

  const currentShares = new Float64Array(numAssets);
  for (let i = 0; i < numAssets; i++) {
    currentShares[i] = initialShares[candidates[i].ticker] || 0;
  }
  const addedShares = new Float64Array(numAssets);

  let remainingBudgetDec = new Decimal(budget);

  // U(w) = μ_p − λ·σ²_p over market-value weights of the given share vector.
  const calculateUtility = (shares: Float64Array): number =>
    calculatePortfolioUtility(candidates, covarianceMatrix, lambda, shares);

  // Prices drive every division below, so anything non-positive or non-finite
  // is excluded rather than allowed to produce Infinity share counts.
  const tradable: number[] = [];
  let minPrice = Infinity;
  for (let i = 0; i < numAssets; i++) {
    const price = candidates[i].price;
    if (Number.isFinite(price) && price > 0) {
      tradable.push(i);
      if (price < minPrice) minPrice = price;
    }
  }

  const stepValue = Math.max(STEP_VALUE, budget / MAX_ITERATIONS);
  const working = new Float64Array(numAssets);

  for (let iteration = 0; iteration < MAX_ITERATIONS && tradable.length > 0; iteration++) {
    const budgetNum = remainingBudgetDec.toNumber();
    if (!(budgetNum >= minPrice)) break;

    for (let i = 0; i < numAssets; i++) {
      working[i] = currentShares[i] + addedShares[i];
    }
    const baseUtility = calculateUtility(working);

    let bestIdx = -1;
    let bestLot = 0;
    let bestScore = -Infinity;

    for (const i of tradable) {
      const price = candidates[i].price;
      if (price > budgetNum) continue;

      // One lot is roughly `stepValue` of the asset, never less than a share
      // and never more than the cash on hand.
      const lot = Math.min(
        Math.max(1, Math.round(stepValue / price)),
        Math.floor(budgetNum / price),
      );
      if (lot < 1) continue;

      const previous = working[i];
      working[i] = previous + lot;
      const gain = calculateUtility(working) - baseUtility;
      working[i] = previous;

      // Per dollar, not per lot. Comparing utility *levels* let a $700 share
      // move the weights further in one step than a $35 share and win on that
      // alone, independent of whether it was the better buy.
      const score = gain / (lot * price);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
        bestLot = lot;
      }
    }

    if (bestIdx === -1 || bestScore <= 0) break;

    addedShares[bestIdx] += bestLot;
    remainingBudgetDec = remainingBudgetDec.minus(
      new Decimal(bestLot).times(candidates[bestIdx].price),
    );
  }

  // An initialShares entry with no matching candidate has no price, so it
  // cannot be weighted — but dropping it would silently lose a holding.
  const finalSharesResult: Record<string, number> = { ...initialShares };
  const addedSharesResult: Record<string, number> = {};
  const finalWeightsResult: Record<string, number> = {};

  const finalTotalShares = new Float64Array(numAssets);
  let finalValue = 0;
  for (let i = 0; i < numAssets; i++) {
    const total = currentShares[i] + addedShares[i];
    finalTotalShares[i] = total;
    finalSharesResult[candidates[i].ticker] = total;
    addedSharesResult[candidates[i].ticker] = addedShares[i];
    finalValue += total * candidates[i].price;
  }

  if (finalValue > 0) {
    for (let i = 0; i < numAssets; i++) {
      finalWeightsResult[candidates[i].ticker] =
        (finalTotalShares[i] * candidates[i].price) / finalValue;
    }
  } else {
    for (let i = 0; i < numAssets; i++) {
      finalWeightsResult[candidates[i].ticker] = 0;
    }
  }

  return {
    shares: finalSharesResult,
    addedShares: addedSharesResult,
    weights: finalWeightsResult,
    utility: calculateUtility(finalTotalShares),
    remainingBudget: remainingBudgetDec.toNumber(),
  };
}
