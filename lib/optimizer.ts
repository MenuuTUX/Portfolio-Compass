import { PortfolioItem } from "@/types";
import { Decimal } from "@/lib/decimal";

export interface GreedyOptimizationParams {
  candidates: {
    ticker: string;
    price: number;
    expectedReturn: number;
  }[];
  covarianceMatrix: number[][];
  lambda?: number;
  riskProfile?: "conservative" | "balanced" | "growth";
  budget: number;
  initialShares?: Record<string, number>;
}

export interface GreedyOptimizationResult {
  shares: Record<string, number>;
  addedShares: Record<string, number>;
  weights: Record<string, number>;
  utility: number;
  remainingBudget: number;
}

/**
 * Implements a Greedy Marginal Utility optimization algorithm for discrete portfolio construction.
 * Objective: Maximize U(w) = mu_port - lambda * sigma^2_port
 * Constraint: Discrete shares.
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

  let lambda = paramLambda ?? 1.0;
  if (riskProfile) {
    switch (riskProfile) {
      case "conservative":
        lambda = 10.0;
        break;
      case "balanced":
        lambda = 5.0;
        break;
      case "growth":
        lambda = 1.0;
        break;
    }
  }

  const numAssets = candidates.length;
  // If no assets or no budget, just return current state
  if (numAssets === 0 || budget <= 0) {
    const shares: Record<string, number> = { ...initialShares };
    return {
      shares,
      addedShares: {},
      weights: {},
      utility: 0,
      remainingBudget: budget,
    };
  }

  // State initialization
  const currentShares = new Float64Array(numAssets);
  const addedShares = new Float64Array(numAssets);

  // Load initial shares
  let initialValue = 0;
  for (let i = 0; i < numAssets; i++) {
    const s = initialShares[candidates[i].ticker] || 0;
    currentShares[i] = s;
    initialValue += s * candidates[i].price;
  }

  let remainingBudgetDec = new Decimal(budget);
  const LOOK_AHEAD_VALUE = 100; // Batch size in dollars

  // Helper to calculate Utility for a given share configuration
  // U = mu_p - lambda * sigma_p^2
  // We use weights relative to the *Current Total Value* of the portfolio being evaluated.
  const calculateUtility = (shares: Float64Array): number => {
    const w = new Float64Array(numAssets);
    let totalCurrentValue = 0;

    for (let i = 0; i < numAssets; i++)
      totalCurrentValue += shares[i] * candidates[i].price;

    // If portfolio is empty, utility is 0 (or undefined, but 0 is safe start)
    if (totalCurrentValue === 0) return 0;

    // Calculate weights
    for (let i = 0; i < numAssets; i++) {
      w[i] = (shares[i] * candidates[i].price) / totalCurrentValue;
    }

    // Calculate Expected Return (mu_p)
    let mu_p = 0;
    for (let i = 0; i < numAssets; i++) {
      mu_p += w[i] * candidates[i].expectedReturn;
    }

    // Calculate Variance (sigma_p^2)
    let var_p = 0;
    for (let i = 0; i < numAssets; i++) {
      let rowSum = 0;
      for (let j = 0; j < numAssets; j++) {
        rowSum += covarianceMatrix[i][j] * w[j];
      }
      var_p += w[i] * rowSum;
    }

    // Utility = Return - Risk Penalty
    return mu_p - lambda * var_p;
  };

  // Base Utility (Current State)
  let currentUtility = calculateUtility(currentShares);

  // Greedy Loop
  while (true) {
    const budgetNum = remainingBudgetDec.toNumber();

    // Find minimum affordable price to see if we can buy anything
    let minAffordablePrice = Infinity;
    for (let i = 0; i < numAssets; i++) {
      if (candidates[i].price < minAffordablePrice) {
        minAffordablePrice = candidates[i].price;
      }
    }

    if (budgetNum < minAffordablePrice) {
      break; // Cannot afford any asset
    }

    let bestIdx = -1;
    let bestUtility = -Infinity;

    // Current total shares state
    const currentTotalShares = new Float64Array(numAssets);
    for (let i = 0; i < numAssets; i++)
      currentTotalShares[i] = currentShares[i] + addedShares[i];

    const currentStepUtility = calculateUtility(currentTotalShares);

    // Iterate over candidates to find the best buy
    for (let i = 0; i < numAssets; i++) {
      if (candidates[i].price > budgetNum) continue;

      // Determine Step Size for this asset
      // Buy roughly $100 worth, but at least 1 share
      let sharesToBuy = Math.max(
        1,
        Math.round(LOOK_AHEAD_VALUE / candidates[i].price),
      );
      const maxAffordable = Math.floor(budgetNum / candidates[i].price);
      sharesToBuy = Math.min(sharesToBuy, maxAffordable);

      if (sharesToBuy === 0) continue;

      // Simulate adding these shares
      const tempShares = new Float64Array(currentTotalShares);
      tempShares[i] += sharesToBuy;

      const simulatedUtility = calculateUtility(tempShares);

      // Maximize Utility
      if (simulatedUtility > bestUtility) {
        bestUtility = simulatedUtility;
        bestIdx = i;
      }
    }

    // If no improvement or no valid candidate found
    if (bestIdx === -1) {
      break;
    }

    // Execute Purchase
    const sharesToBuy = Math.max(
      1,
      Math.round(LOOK_AHEAD_VALUE / candidates[bestIdx].price),
    );
    const finalShares = Math.min(
      sharesToBuy,
      Math.floor(budgetNum / candidates[bestIdx].price),
    );

    if (finalShares === 0) break; // Should not happen given logic above

    addedShares[bestIdx] += finalShares;
    const cost = new Decimal(finalShares).times(candidates[bestIdx].price);
    remainingBudgetDec = remainingBudgetDec.minus(cost);

    // Update utility for next iteration? Not strictly needed as we recalc per step, but good for tracking
    currentUtility = bestUtility;
  }

  // Construct Result
  const finalSharesResult: Record<string, number> = {};
  const addedSharesResult: Record<string, number> = {};
  const finalWeightsResult: Record<string, number> = {};

  const finalTotalShares = new Float64Array(numAssets);
  let finalValue = 0;
  for (let i = 0; i < numAssets; i++) {
    const totalS = currentShares[i] + addedShares[i];
    finalTotalShares[i] = totalS;

    finalSharesResult[candidates[i].ticker] = totalS;
    addedSharesResult[candidates[i].ticker] = addedShares[i];
    finalValue += totalS * candidates[i].price;
  }

  const baseValue = finalValue || 1;
  for (let i = 0; i < numAssets; i++) {
    finalWeightsResult[candidates[i].ticker] =
      (finalSharesResult[candidates[i].ticker] * candidates[i].price) /
      baseValue;
  }

  const finalUtility = calculateUtility(finalTotalShares);

  return {
    shares: finalSharesResult,
    addedShares: addedSharesResult,
    weights: finalWeightsResult,
    utility: finalUtility,
    remainingBudget: remainingBudgetDec.toNumber(),
  };
}
