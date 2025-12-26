import { PortfolioItem } from '@/types';
import { Decimal } from 'decimal.js';

export interface OverlapResult {
  concentrationScore: number;
  topOverlaps: { ticker: string; exposure: number }[];
}

export interface BudgetRecommendation {
  ticker: string;
  amount: number;
  reason: string;
}

/**
 * Calculates the portfolio's exposure to individual stocks based on ETF holdings.
 * Returns a concentration score (sum of top 10 stock exposures) and the list of top overlapping stocks.
 */
export function calculateOverlap(portfolio: PortfolioItem[]): OverlapResult {
  const stockExposure: Record<string, Decimal> = {};

  // 1. Calculate raw exposure
  portfolio.forEach(asset => {
    const assetWeight = new Decimal(asset.weight || 0).div(100);

    if (asset.holdings && asset.holdings.length > 0) {
      asset.holdings.forEach(holding => {
        const holdingWeight = new Decimal(holding.weight || 0).div(100);
        const exposure = assetWeight.times(holdingWeight);

        if (!stockExposure[holding.ticker]) {
          stockExposure[holding.ticker] = new Decimal(0);
        }
        stockExposure[holding.ticker] = stockExposure[holding.ticker].plus(exposure);
      });
    } else if (asset.assetType === 'STOCK' || (!asset.assetType && asset.ticker)) {
       // It's a single stock (or fallback if assetType missing but ticker exists)
       const ticker = asset.ticker;
       if (!stockExposure[ticker]) stockExposure[ticker] = new Decimal(0);
       stockExposure[ticker] = stockExposure[ticker].plus(assetWeight);
    }
  });

  // 2. Sort and extract top 10
  const sortedStocks = Object.entries(stockExposure)
    .sort(([, a], [, b]) => b.minus(a).toNumber())
    .map(([ticker, exposure]) => ({
      ticker,
      exposure: exposure.times(100).toNumber()
    }));

  const topOverlaps = sortedStocks.slice(0, 10);

  // 3. Calculate Concentration Score (Sum of top 10 exposures)
  const concentrationScore = topOverlaps.reduce((sum, item) => sum + item.exposure, 0);

  return {
    concentrationScore: Math.min(concentrationScore, 100),
    topOverlaps
  };
}

/**
 * Recommends how to distribute a cash budget to minimize overlap with the current top concentrated stocks.
 * Assets that do NOT contain the heavy stocks get higher allocation.
 */
export function optimizeBudget(portfolio: PortfolioItem[], budget: number): BudgetRecommendation[] {
  if (portfolio.length === 0) return [];

  // 1. Identify the heavy stocks to avoid
  const { topOverlaps } = calculateOverlap(portfolio);
  const heavyStockTickers = new Set(topOverlaps.map(t => t.ticker));

  // 2. Score each asset based on how much it AVOIDS these stocks
  const assetScores: { ticker: string; score: number }[] = [];
  let totalScore = 0;

  portfolio.forEach(asset => {
    let overlapMetric = new Decimal(0);

    if (asset.holdings && asset.holdings.length > 0) {
      asset.holdings.forEach(h => {
        if (heavyStockTickers.has(h.ticker)) {
           // Add the weight of this holding within the asset
           overlapMetric = overlapMetric.plus(new Decimal(h.weight || 0));
        }
      });
    } else if (asset.assetType === 'STOCK') {
        if (heavyStockTickers.has(asset.ticker)) {
            overlapMetric = new Decimal(100);
        }
    }

    // Invert metric: Lower overlap = Higher Score
    // Score = 100 / (1 + Overlap%)
    // Examples:
    // Overlap 0% -> Score 100
    // Overlap 10% -> Score 9.09
    // Overlap 50% -> Score 1.96
    const score = 100 / (1 + overlapMetric.toNumber());

    assetScores.push({ ticker: asset.ticker, score });
    totalScore += score;
  });

  // 3. Distribute Budget
  if (totalScore === 0) return [];

  const recommendations: BudgetRecommendation[] = assetScores
    .map(item => {
      const allocation = (item.score / totalScore) * budget;
      return {
        ticker: item.ticker,
        amount: Number(allocation.toFixed(2)),
        reason: `Diversification Score: ${item.score.toFixed(1)}`
      };
    })
    .filter(rec => rec.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return recommendations;
}
