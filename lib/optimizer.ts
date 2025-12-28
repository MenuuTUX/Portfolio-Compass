import { PortfolioItem } from '@/types';
import { Decimal } from 'decimal.js';

export interface GreedyOptimizationParams {
  candidates: {
    ticker: string;
    price: number;
    expectedReturn: number;
  }[];
  covarianceMatrix: number[][];
  lambda: number;
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
 * Objective: Maximize U(w) = w^T*mu - lambda * w^T * Sigma * w
 * Constraint: Discrete shares.
 *
 * Algorithm Steps:
 * 1. Calculate Marginal Utility: MU_i = mu_i - 2*lambda*(Sigma*w)_i
 * 2. Look-Ahead: Simulate buying $100 worth. Select asset maximizing Sharpe Ratio of resulting portfolio.
 * 3. Subtract cost from budget, update portfolio weights.
 */
export function optimizePortfolioGreedy(params: GreedyOptimizationParams): GreedyOptimizationResult {
  const { candidates, covarianceMatrix, lambda, budget, initialShares = {} } = params;

  const numAssets = candidates.length;
  // If no assets or no budget, just return current state
  if (numAssets === 0 || budget <= 0) {
      const shares: Record<string, number> = { ...initialShares };
      return {
        shares,
        addedShares: {},
        weights: {},
        utility: 0,
        remainingBudget: budget
      };
  }

  // State initialization
  const currentShares = new Float64Array(numAssets);
  const addedShares = new Float64Array(numAssets);

  // Calculate Initial Value for Target Wealth Normalization
  let initialValue = 0;
  for(let i=0; i<numAssets; i++) {
      const s = initialShares[candidates[i].ticker] || 0;
      currentShares[i] = s;
      initialValue += s * candidates[i].price;
  }

  // Weights will be calculated relative to (Initial + Budget)
  // This ensures MU is calculated relative to the *Goal Portfolio Size*.
  const targetWealth = initialValue + budget;

  let remainingBudgetDec = new Decimal(budget);
  const LOOK_AHEAD_VALUE = 100; // Batch size in dollars

  // Helper to calculate Utility for a given share configuration
  const calculateUtility = (shares: Float64Array): number => {
      const w = new Float64Array(numAssets);
      let term1 = 0;
      let totalCurrentValue = 0;

      // Compute weights based on current portfolio value?
      // Or based on targetWealth?
      // To compare Utilities, we should normalize consistently.
      // Usually U is defined on weights summing to 1.
      // So we calculate actual weights of the portfolio represented by `shares`.

      for(let i=0; i<numAssets; i++) totalCurrentValue += shares[i] * candidates[i].price;
      if (totalCurrentValue === 0) return 0;

      for (let i = 0; i < numAssets; i++) {
          w[i] = (shares[i] * candidates[i].price) / totalCurrentValue;
          term1 += w[i] * candidates[i].expectedReturn;
      }

      let term2 = 0;
      for (let i = 0; i < numAssets; i++) {
          let rowSum = 0;
          for (let j = 0; j < numAssets; j++) {
              rowSum += covarianceMatrix[i][j] * w[j];
          }
          term2 += w[i] * rowSum;
      }
      return term1 - lambda * term2;
  };

  // Helper to calculate Sharpe Ratio for a given share configuration
  // Sharpe = (mu_p - rf) / sigma_p
  // Assuming Rf = 0.04 as per standard.
  const calculateSharpe = (shares: Float64Array): number => {
      const w = new Float64Array(numAssets);
      let mu_p = 0;
      let totalVal = 0;
      for(let i=0; i<numAssets; i++) totalVal += shares[i] * candidates[i].price;

      if (totalVal === 0) return 0;

      for (let i = 0; i < numAssets; i++) {
          w[i] = (shares[i] * candidates[i].price) / totalVal;
          mu_p += w[i] * candidates[i].expectedReturn;
      }

      let var_p = 0;
      for (let i = 0; i < numAssets; i++) {
          let rowSum = 0;
          for (let j = 0; j < numAssets; j++) {
              rowSum += covarianceMatrix[i][j] * w[j];
          }
          var_p += w[i] * rowSum;
      }

      const sigma_p = Math.sqrt(var_p);
      if (sigma_p === 0) return 0; // Avoid div by zero

      return (mu_p - 0.04) / sigma_p;
  };

  // Greedy Loop
  while (true) {
      const budgetNum = remainingBudgetDec.toNumber();
      let minAffordablePrice = Infinity;

      for(let i=0; i<numAssets; i++) {
          if (candidates[i].price < minAffordablePrice) {
              minAffordablePrice = candidates[i].price;
          }
      }

      if (budgetNum < minAffordablePrice) {
          break; // Cannot afford any asset
      }

      let bestIdx = -1;
      let bestSimulatedMetric = -Infinity; // Sharpe Ratio

      const currentTotalShares = new Float64Array(numAssets);
      for(let i=0; i<numAssets; i++) currentTotalShares[i] = currentShares[i] + addedShares[i];

      for(let i=0; i<numAssets; i++) {
          if (candidates[i].price > budgetNum) continue;

          // Determine Step Size for this asset
          let sharesToBuy = Math.max(1, Math.round(LOOK_AHEAD_VALUE / candidates[i].price));
          const maxAffordable = Math.floor(budgetNum / candidates[i].price);
          sharesToBuy = Math.min(sharesToBuy, maxAffordable);

          if (sharesToBuy === 0) continue;

          // Simulate adding these shares
          const tempShares = new Float64Array(currentTotalShares);
          tempShares[i] += sharesToBuy;

          const simulatedMetric = calculateSharpe(tempShares);

          // We want to maximize the resulting Sharpe
          if (simulatedMetric > bestSimulatedMetric) {
              bestSimulatedMetric = simulatedMetric;
              bestIdx = i;
          }
      }

      if (bestIdx === -1) {
          break;
      }

      // Execute Purchase
      const sharesToBuy = Math.max(1, Math.round(LOOK_AHEAD_VALUE / candidates[bestIdx].price));
      const finalShares = Math.min(sharesToBuy, Math.floor(budgetNum / candidates[bestIdx].price));

      addedShares[bestIdx] += finalShares;
      const cost = new Decimal(finalShares).times(candidates[bestIdx].price);
      remainingBudgetDec = remainingBudgetDec.minus(cost);
  }

  // Construct Result
  const finalSharesResult: Record<string, number> = {};
  const addedSharesResult: Record<string, number> = {};
  const finalWeightsResult: Record<string, number> = {};

  const finalTotalShares = new Float64Array(numAssets);
  let finalValue = 0;
  for(let i=0; i<numAssets; i++) {
      const totalS = currentShares[i] + addedShares[i];
      finalTotalShares[i] = totalS;

      finalSharesResult[candidates[i].ticker] = totalS;
      addedSharesResult[candidates[i].ticker] = addedShares[i];
      finalValue += totalS * candidates[i].price;
  }

  const baseValue = finalValue || 1;
  for(let i=0; i<numAssets; i++) {
      finalWeightsResult[candidates[i].ticker] = (finalSharesResult[candidates[i].ticker] * candidates[i].price) / baseValue;
  }

  const utility = calculateUtility(finalTotalShares);

  return {
      shares: finalSharesResult,
      addedShares: addedSharesResult,
      weights: finalWeightsResult,
      utility,
      remainingBudget: remainingBudgetDec.toNumber()
  };
}
