import { PortfolioItem } from '@/types';
import { Decimal } from 'decimal.js';

export interface SmartDistributionResult {
  newShares: Record<string, number>;
  newWeights: Record<string, number>;
  topOverlaps: { ticker: string; exposure: number }[];
  beforeScore: number;
  afterScore: number;
}

interface StockExposure {
  ticker: string;
  exposure: Decimal;
}

/**
 * Calculates overlap and concentration scores for a given portfolio state (shares map).
 * If no shares map is provided, it uses the portfolio's current shares.
 */
function analyzePortfolioState(
  portfolio: PortfolioItem[],
  sharesMap?: Record<string, number>
) {
  const stockExposures: Record<string, Decimal> = {};
  let totalPortfolioValue = new Decimal(0);

  // 1. Calculate Total Value and Individual Asset Values
  const assetValues = portfolio.map(asset => {
    const shares = sharesMap ? (sharesMap[asset.ticker] || 0) : (asset.shares || 0);
    const price = new Decimal(asset.price || 0);
    const value = price.times(shares);
    totalPortfolioValue = totalPortfolioValue.plus(value);
    return { ticker: asset.ticker, value, asset };
  });

  if (totalPortfolioValue.isZero()) {
    return { score: 0, topOverlaps: [] };
  }

  // 2. Calculate Exposure to Underlying Stocks
  assetValues.forEach(({ value, asset }) => {
    const assetWeight = value.div(totalPortfolioValue); // 0 to 1

    if (asset.holdings && asset.holdings.length > 0) {
      asset.holdings.forEach(holding => {
        const holdingWeight = new Decimal(holding.weight || 0).div(100);
        const exposure = assetWeight.times(holdingWeight);

        if (!stockExposures[holding.ticker]) {
          stockExposures[holding.ticker] = new Decimal(0);
        }
        stockExposures[holding.ticker] = stockExposures[holding.ticker].plus(exposure);
      });
    } else if (asset.assetType === 'STOCK' || (!asset.assetType && asset.ticker)) {
       // Single stock exposure
       if (!stockExposures[asset.ticker]) stockExposures[asset.ticker] = new Decimal(0);
       stockExposures[asset.ticker] = stockExposures[asset.ticker].plus(assetWeight);
    }
  });

  // 3. Sort and Score
  const sortedStocks = Object.entries(stockExposures)
    .sort(([, a], [, b]) => b.minus(a).toNumber())
    .map(([ticker, exposure]) => ({
      ticker,
      exposure: exposure.times(100).toNumber()
    }));

  const topOverlaps = sortedStocks.slice(0, 5); // User requested Top 5 for the list
  // Score based on top 10 sum for robustness (similar to before), but let's stick to consistent logic
  const concentrationScore = sortedStocks.slice(0, 10).reduce((sum, item) => sum + item.exposure, 0);

  return {
    score: Math.min(concentrationScore, 100),
    topOverlaps
  };
}

/**
 * Smartly distributes a cash budget to minimize overlap.
 * Returns integer share recommendations, new weights, and risk analysis.
 */
export function calculateSmartDistribution(
  portfolio: PortfolioItem[],
  budget: number
): SmartDistributionResult {

  // 1. Analyze Current State ("Before")
  const currentShares: Record<string, number> = {};
  portfolio.forEach(p => currentShares[p.ticker] = p.shares || 0);

  const { score: beforeScore, topOverlaps: currentTopOverlaps } = analyzePortfolioState(portfolio, currentShares);
  const heavyStockTickers = new Set(currentTopOverlaps.filter(t => t.exposure > 0).map(t => t.ticker));

  // 2. Score Assets for Suitability (Inverse to Overlap)
  const assetScores: { ticker: string; score: number; price: number }[] = [];
  let totalScore = 0;

  portfolio.forEach(asset => {
    let overlapMetric = new Decimal(0);

    if (asset.holdings && asset.holdings.length > 0) {
      asset.holdings.forEach(h => {
        if (heavyStockTickers.has(h.ticker)) {
           overlapMetric = overlapMetric.plus(new Decimal(h.weight || 0));
        }
      });
    } else if (asset.assetType === 'STOCK' || (!asset.assetType && asset.ticker)) {
        if (heavyStockTickers.has(asset.ticker)) overlapMetric = new Decimal(100);
    }

    // Score = 100 / (1 + Overlap%). Higher is better.
    const score = 100 / (1 + overlapMetric.toNumber());
    assetScores.push({ ticker: asset.ticker, score, price: asset.price || 0 });
    totalScore += score;
  });

  // 3. Distribute Budget to Shares (Integer Constraint)
  const newShares: Record<string, number> = {};
  let remainingBudget = new Decimal(budget);

  // Sort by score descending to prioritize best assets
  assetScores.sort((a, b) => b.score - a.score);

  assetScores.forEach(asset => {
    if (totalScore === 0) return;
    if (asset.price <= 0) return;

    const targetAllocation = new Decimal(budget).times(asset.score / totalScore);
    const sharesToBuy = Math.floor(targetAllocation.div(asset.price).toNumber());

    if (sharesToBuy > 0) {
      newShares[asset.ticker] = sharesToBuy;
      // We don't strictly subtract from remaining budget in the loop to allow parallel distribution logic,
      // but strictly speaking, we are just calculating "Target Buy".
      // The prompt asks for "Distribute... heavily into assets".
    }
  });

  // 4. Calculate Future State ("After")
  const futureShares: Record<string, number> = { ...currentShares };
  Object.entries(newShares).forEach(([ticker, count]) => {
    futureShares[ticker] = (futureShares[ticker] || 0) + count;
  });

  const { score: afterScore, topOverlaps: futureTopOverlaps } = analyzePortfolioState(portfolio, futureShares);

  // 5. Calculate New Weights
  const newWeights: Record<string, number> = {};
  let futureTotalValue = new Decimal(0);

  portfolio.forEach(p => {
    const s = futureShares[p.ticker] || 0;
    const val = new Decimal(p.price || 0).times(s);
    futureTotalValue = futureTotalValue.plus(val);
  });

  if (!futureTotalValue.isZero()) {
    portfolio.forEach(p => {
      const s = futureShares[p.ticker] || 0;
      const val = new Decimal(p.price || 0).times(s);
      newWeights[p.ticker] = val.div(futureTotalValue).times(100).toNumber();
    });
  }

  return {
    newShares,
    newWeights,
    topOverlaps: currentTopOverlaps, // Show the current "bad actors" that drove the decision
    beforeScore,
    afterScore
  };
}

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
      for (let i = 0; i < numAssets; i++) {
          w[i] = (shares[i] * candidates[i].price) / targetWealth;
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
      let bestSimulatedUtility = -Infinity;

      // Look-Ahead Simulation:
      // Instead of relying on instantaneous MU, we simulate adding a "Step" (approx $100)
      // and calculate the resulting Utility. This satisfies the "avoid local optima" requirement
      // by evaluating the integral of the gradient over the step.

      const currentTotalShares = new Float64Array(numAssets);
      for(let i=0; i<numAssets; i++) currentTotalShares[i] = currentShares[i] + addedShares[i];

      const currentUtility = calculateUtility(currentTotalShares);

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

          const simulatedU = calculateUtility(tempShares);

          if (simulatedU > bestSimulatedUtility) {
              bestSimulatedUtility = simulatedU;
              bestIdx = i;
          }
      }

      // If no valid move improves Utility (relative to current), stop?
      // Or just pick the best move even if it lowers U (unlikely in buildup phase unless purely risk)?
      // Standard: Stop if best move is < current.
      // But if we have cash drag, maybe we tolerate slight U drop if we assume cash U is bad?
      // Assuming cash U=0 (implicit). If U > 0, we improve.
      // If U drops, we stop.
      if (bestIdx === -1 || bestSimulatedUtility < currentUtility) {
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

  // Recalculate weights based on actual final value for consistency
  const baseValue = finalValue || 1;
  for(let i=0; i<numAssets; i++) {
      finalWeightsResult[candidates[i].ticker] = (finalSharesResult[candidates[i].ticker] * candidates[i].price) / baseValue;
  }

  // Calculate Utility using Target Wealth (consistent with optimization)
  // OR Final Value?
  // Usually, optimization objective and reported utility should match.
  // We optimized U(w_target). We should report U(w_target).
  const utility = calculateUtility(finalTotalShares);

  return {
      shares: finalSharesResult,
      addedShares: addedSharesResult,
      weights: finalWeightsResult,
      utility,
      remainingBudget: remainingBudgetDec.toNumber()
  };
}
