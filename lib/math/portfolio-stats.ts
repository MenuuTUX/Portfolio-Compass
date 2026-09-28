import { Portfolio } from "@/types";
import { alignPriceHistories } from "@/lib/math/history";

export interface PortfolioHistoricalStats {
  /** Annualized change in the market value of the same held shares. Price only. */
  annualizedReturn: number | null;
  annualizedVolatility: number | null;
}

/** Historical price statistics for a buy-and-hold portfolio without cash flows. */
export function calculatePortfolioHistoricalStats(
  portfolio: Portfolio,
): PortfolioHistoricalStats {
  const unavailable = { annualizedReturn: null, annualizedVolatility: null };
  if (portfolio.some((item) => !Number.isFinite(item.shares) || item.shares < 0)) {
    return unavailable;
  }
  const holdings = portfolio.filter((item) => item.shares > 0);
  const currency = holdings[0]?.currency;
  if (!currency || !/^[A-Z]{3}$/.test(currency) ||
    holdings.some((item) => item.currency !== currency || item.history.length < 6)) {
    return unavailable;
  }

  const aligned = alignPriceHistories(holdings);
  if (!aligned || aligned.dates.length < 6) return unavailable;

  const years =
    (new Date(aligned.dates.at(-1)!).getTime() -
      new Date(aligned.dates[0]).getTime()) /
    (1000 * 60 * 60 * 24 * 365.25);
  if (years < 0.5) return unavailable;

  const values = aligned.dates.map((_, dateIndex) =>
    holdings.reduce(
      (sum, item, itemIndex) =>
        sum + item.shares * aligned.prices[itemIndex][dateIndex],
      0,
    ),
  );
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    return unavailable;
  }

  const annualizedReturn =
    Math.pow(values.at(-1)! / values[0], 1 / years) - 1;
  const gapsInDays = aligned.dates.slice(1).map((date, index) =>
    (new Date(date).getTime() - new Date(aligned.dates[index]).getTime()) /
    (1000 * 60 * 60 * 24),
  );
  // Annualizing a handful of monthly or irregular changes as daily volatility
  // produces a number with unjustified precision. Keep the observed price CAGR
  // but withhold volatility until the common series is sufficiently dense.
  if (gapsInDays.length < 100 || gapsInDays.some((gap) => gap > 10)) {
    return { annualizedReturn, annualizedVolatility: null };
  }
  const logReturns = values.slice(1).map((value, index) =>
    Math.log(value / values[index]),
  );
  const mean = logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length;
  const variance = logReturns.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / (logReturns.length - 1);
  const annualizedVolatility = Math.sqrt(variance * (logReturns.length / years));

  return { annualizedReturn, annualizedVolatility };
}
