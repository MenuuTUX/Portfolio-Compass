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
  riskFreeRate: number = 0.04
): number {
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
