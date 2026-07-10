import { Portfolio } from "@/types";
import {
  calculateLogReturns,
  calculateCovarianceMatrix,
} from "@/lib/monte-carlo";
import {
  getAssetYieldFraction,
  getEffectiveWeights,
  estimateAssetTotalReturn,
} from "@/lib/math/portfolio-returns";

/**
 * Calculates historical portfolio statistics (Annualized Return, Annualized Volatility)
 * based on the provided portfolio items' history.
 *
 * Price series are unadjusted closes → historical means are *price* returns.
 * Dividend yield is added so the reported annualizedReturn is a total return.
 *
 * Assets without usable history contribute their yield (and a heuristic price
 * drift) so every holding still affects the portfolio expected return.
 *
 * @param portfolio The portfolio with `history` property populated.
 * @param riskFreeRate The risk free rate (default 0.04) — reserved for callers
 * @returns Object with annualizedReturn and annualizedVolatility
 */
export function calculatePortfolioHistoricalStats(
  portfolio: Portfolio,
  _riskFreeRate: number = 0.04,
): { annualizedReturn: number; annualizedVolatility: number } {
  if (!portfolio || portfolio.length === 0) {
    return { annualizedReturn: 0, annualizedVolatility: 0 };
  }

  const weights = getEffectiveWeights(portfolio);
  const TRADING_DAYS = 252;

  // Split assets with / without usable price history
  const withHistoryIdx: number[] = [];
  const withoutHistoryIdx: number[] = [];

  portfolio.forEach((item, i) => {
    if (item.history && item.history.length > 5) {
      withHistoryIdx.push(i);
    } else {
      withoutHistoryIdx.push(i);
    }
  });

  // --- No history at all: pure heuristic total return ---
  if (withHistoryIdx.length === 0) {
    let annRet = 0;
    for (let i = 0; i < portfolio.length; i++) {
      annRet += weights[i] * estimateAssetTotalReturn(portfolio[i]);
    }
    // Assume moderate equity-like vol when we have no data
    return { annualizedReturn: annRet, annualizedVolatility: 0.15 };
  }

  // Align price series on the latest common start date
  const histItems = withHistoryIdx.map((i) => portfolio[i]);
  const startDates = histItems.map((item) =>
    new Date(item.history[0].date).getTime(),
  );
  const latestStartDate = Math.max(...startDates);

  const alignedPrices: number[][] = [];
  let referenceDates: number[] = [];

  histItems.forEach((item, index) => {
    const filteredHistory = item.history.filter(
      (h) => new Date(h.date).getTime() >= latestStartDate,
    );
    const prices = filteredHistory.map((h) => h.price);
    if (index === 0) {
      referenceDates = filteredHistory.map((h) => new Date(h.date).getTime());
    }
    alignedPrices.push(prices);
  });

  const minLen = Math.min(...alignedPrices.map((arr) => arr.length));
  if (minLen < 2) {
    // Fall back to heuristics for everything
    let annRet = 0;
    for (let i = 0; i < portfolio.length; i++) {
      annRet += weights[i] * estimateAssetTotalReturn(portfolio[i]);
    }
    return { annualizedReturn: annRet, annualizedVolatility: 0.15 };
  }

  const finalPrices = alignedPrices.map((arr) => arr.slice(arr.length - minLen));
  referenceDates = referenceDates.slice(referenceDates.length - minLen);

  const startDate = referenceDates[0];
  const endDate = referenceDates[referenceDates.length - 1];
  const timeSpanYears =
    (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);

  // Short windows produce absurd annualizations — use heuristics instead
  if (timeSpanYears < 0.5) {
    let annRet = 0;
    for (let i = 0; i < portfolio.length; i++) {
      annRet += weights[i] * estimateAssetTotalReturn(portfolio[i]);
    }
    return { annualizedReturn: annRet, annualizedVolatility: 0.15 };
  }

  const N = finalPrices[0].length;
  const dt = timeSpanYears / (N - 1);
  const samplesPerYear = 1 / dt;

  const returnsMatrix = finalPrices.map((prices) => calculateLogReturns(prices));

  // Mean *price* log-return per step
  const meanPriceLog = returnsMatrix.map((returns) => {
    const sum = returns.reduce((a, b) => a + b, 0);
    return sum / returns.length;
  });

  const covMatrix = calculateCovarianceMatrix(returnsMatrix);

  // Renormalize weights among history assets for the price-return sleeve,
  // then blend with no-history assets via original portfolio weights.
  const histWeightSum = withHistoryIdx.reduce((s, i) => s + weights[i], 0);

  // Portfolio expected *price* log return per step (history assets only, renormed)
  let expStepPriceLog = 0;
  if (histWeightSum > 0) {
    withHistoryIdx.forEach((pi, localIdx) => {
      const w = weights[pi] / histWeightSum;
      expStepPriceLog += w * meanPriceLog[localIdx];
    });
  }

  // Portfolio variance per step (history assets)
  let expStepVar = 0;
  if (histWeightSum > 0) {
    for (let i = 0; i < withHistoryIdx.length; i++) {
      for (let j = 0; j < withHistoryIdx.length; j++) {
        const wi = weights[withHistoryIdx[i]] / histWeightSum;
        const wj = weights[withHistoryIdx[j]] / histWeightSum;
        expStepVar += wi * wj * covMatrix[i][j];
      }
    }
  }

  const annPriceLog = expStepPriceLog * samplesPerYear;
  const annPriceReturn = Math.exp(annPriceLog) - 1; // price only

  // Dividend yield across *all* assets (fraction)
  let portfolioYield = 0;
  for (let i = 0; i < portfolio.length; i++) {
    portfolioYield += weights[i] * getAssetYieldFraction(portfolio[i]);
  }

  // Blend: history sleeve total return + no-history sleeve heuristic
  // History sleeve already gets +yield; no-history uses full heuristic.
  let annualizedReturn: number;
  if (withoutHistoryIdx.length === 0) {
    // All assets have history → price return + yield = total return
    annualizedReturn = annPriceReturn + portfolioYield;
  } else {
    const noHistWeight = withoutHistoryIdx.reduce((s, i) => s + weights[i], 0);
    let noHistRet = 0;
    if (noHistWeight > 0) {
      withoutHistoryIdx.forEach((i) => {
        noHistRet += (weights[i] / noHistWeight) * estimateAssetTotalReturn(portfolio[i]);
      });
    }
    // History assets: renormed price return + their own yield contribution
    let histYield = 0;
    withHistoryIdx.forEach((i) => {
      histYield += (weights[i] / (histWeightSum || 1)) * getAssetYieldFraction(portfolio[i]);
    });
    const histTotal = annPriceReturn + histYield;
    annualizedReturn =
      histWeightSum * histTotal + noHistWeight * noHistRet;
  }

  const annualizedVolatility =
    Math.sqrt(Math.max(0, expStepVar)) * Math.sqrt(samplesPerYear);

  // Floor vol slightly if we have no-history assets (they add uncertainty)
  const vol =
    withoutHistoryIdx.length > 0
      ? Math.max(annualizedVolatility, 0.1)
      : annualizedVolatility;

  return {
    annualizedReturn,
    annualizedVolatility: vol || 0.15,
  };
}

// Re-export trading-day constant for callers
export const TRADING_DAYS_PER_YEAR = 252;
