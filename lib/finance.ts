import { Decimal } from './decimal';

export interface DividendHistoryItem {
  date: string;
  amount: number | Decimal; // Allow both
  exDate?: string;
}

export interface AssetWithCompositeScore {
  scores: {
    composite: number;
  };
}

/**
 * Forecasts expected return for a single asset based on Benchmark Volatility Scaling.
 * mu = R_free + (zScore * sigma_benchmark)
 *
 * @param zScore - The composite Z-Score of the asset.
 * @param benchmarkVol - The volatility of the benchmark (sigma_benchmark), defaults to 0.15.
 * @param riskFreeRate - The base risk-free rate (alpha), defaults to 0.04.
 * @returns Expected return (mu).
 */
export function forecastExpectedReturn(
  zScore: number,
  benchmarkVol: number = 0.15,
  riskFreeRate: number = 0.04 // 4% Risk Free Rate
): number {
  // Formula: mu = R_free + (zScore * sigma_benchmark)
  // This ensures a stock with Z=1.0 gets the same expected return as the benchmark.
  return riskFreeRate + (zScore * benchmarkVol);
}

/**
 * Forecasts expected returns based on Benchmark Volatility Scaling for a list of assets.
 * mu_i = alpha + (CompositeZScore_i * sigma_benchmark)
 *
 * @param assets - List of assets with composite scores.
 * @param benchmarkVol - The volatility of the benchmark (sigma_benchmark).
 * @param riskFreeRate - The base risk-free rate (alpha), defaults to 0.04.
 * @returns Array of expected returns corresponding to the input assets.
 */
export function forecastExpectedReturns<T extends AssetWithCompositeScore>(
  assets: T[],
  benchmarkVol: number,
  riskFreeRate: number = 0.04
): number[] {
  return assets.map(asset => {
    return forecastExpectedReturn(asset.scores.composite, benchmarkVol, riskFreeRate);
  });
}

export function calculateTTMYield(dividendHistory: DividendHistoryItem[], currentPrice: number | Decimal): Decimal {
  if (!dividendHistory || dividendHistory.length === 0) {
    return new Decimal(0);
  }

  const price = new Decimal(currentPrice);
  if (price.isZero()) {
      return new Decimal(0);
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const now = new Date();
  const ttmDividends = dividendHistory.filter(item => {
    // Prefer exDate if available, otherwise use date
    const dateStr = item.exDate || item.date;
    const date = new Date(dateStr);
    return date >= oneYearAgo && date <= now;
  });

  const annualPayout = ttmDividends.reduce((sum, item) => sum.plus(new Decimal(item.amount)), new Decimal(0));

  return annualPayout.dividedBy(price).times(100); // Return as percentage
}

interface HistoricalData {
  date: string;
  price: number;
}

/**
 * Aligns price histories for multiple assets by unioning their dates and forward-filling missing values.
 *
 * Strategy:
 * 1. Find the latest start date among all assets (intersection start).
 * 2. Collect all unique dates from all assets that are >= latestStartDate.
 * 3. Sort dates chronologically.
 * 4. For each asset, reconstruct the price series matching these dates, forward-filling gaps.
 *
 * @param histories - Array of history arrays (each containing {date, price}).
 * @returns Array of aligned price arrays (number[][]).
 */
export function alignPriceHistory(histories: HistoricalData[][]): number[][] {
  if (histories.length === 0) return [];

  // 1. Determine the common start date (latest of the first dates)
  // Assumes histories are sorted by date (ascending)
  // If not, we should sort them, but usually API returns them sorted.
  const startDates = histories.map(h => {
      if (h.length === 0) return 0;
      return new Date(h[0].date).getTime();
  });

  const latestStartDate = Math.max(...startDates);
  if (latestStartDate === 0) return histories.map(() => []);

  // 2. Collect all unique dates >= latestStartDate
  const dateSet = new Set<number>();
  histories.forEach(h => {
      h.forEach(pt => {
          const t = new Date(pt.date).getTime();
          if (t >= latestStartDate) {
              dateSet.add(t);
          }
      });
  });

  const sortedDates = Array.from(dateSet).sort((a, b) => a - b);

  // 3. Reconstruct arrays with forward filling
  const result: number[][] = [];

  histories.forEach(history => {
      const prices: number[] = [];

      // Create a map for quick lookup
      const priceMap = new Map<number, number>();
      let lastPriceBeforeStart = 0; // Fallback if we need it, though logically we shouldn't given latestStartDate logic

      history.forEach(pt => {
          const t = new Date(pt.date).getTime();
          priceMap.set(t, pt.price);

          // Capture the price just before or at start date to initialize forward fill
          if (t <= latestStartDate) {
              lastPriceBeforeStart = pt.price;
          }
      });

      let lastPrice = lastPriceBeforeStart;

      sortedDates.forEach(date => {
          if (priceMap.has(date)) {
              lastPrice = priceMap.get(date)!;
          }
          prices.push(lastPrice);
      });

      result.push(prices);
  });

  return result;
}
