import { Portfolio, PortfolioItem } from "@/types";

/**
 * Shared portfolio return / weight / dividend helpers used by
 * Wealth Projector, Monte Carlo, and historical stats.
 *
 * Price history in this app comes from unadjusted closes, so historical
 * log-returns are *price* returns only. Dividend yield must be added
 * explicitly to recover total return (with reinvestment).
 */

/** Resolve dividend yield as a fraction (e.g. 0.015 for 1.5%). */
export function getAssetYieldFraction(item: PortfolioItem): number {
  // Both fields are stored as percentages (1.5 = 1.5%). Prefer metrics.yield
  // when positive; otherwise fall back to dividendYield (metrics.yield is often
  // 0 for stocks hydrated only via quote snapshots).
  const fromMetrics = Number(item.metrics?.yield);
  const fromTopLevel = Number(item.dividendYield);
  const pct =
    Number.isFinite(fromMetrics) && fromMetrics > 0
      ? fromMetrics
      : Number.isFinite(fromTopLevel) && fromTopLevel > 0
        ? fromTopLevel
        : 0;
  if (pct <= 0) return 0;
  return pct / 100;
}

/** Market value of one holding. */
export function getHoldingValue(item: PortfolioItem): number {
  const price = Number(item.price) || 0;
  const shares = Number(item.shares) || 0;
  return Math.max(0, price * shares);
}

/**
 * Effective portfolio weights for projections.
 *
 * Priority:
 *  1. Market-value weights from shares × price (when any holding has value)
 *  2. Explicit `weight` field (user allocation % / units)
 *  3. Equal weight across all assets
 *
 * Always returns one weight per input item, summing to 1.
 * Includes every asset — never silently drops holdings.
 */
export function getEffectiveWeights(portfolio: Portfolio): number[] {
  if (portfolio.length === 0) return [];

  const values = portfolio.map(getHoldingValue);
  const totalValue = values.reduce((a, b) => a + b, 0);

  if (totalValue > 1e-9) {
    return values.map((v) => v / totalValue);
  }

  const rawWeights = portfolio.map((item) => {
    const w = Number(item.weight) || 0;
    return Math.max(0, w);
  });
  const totalW = rawWeights.reduce((a, b) => a + b, 0);

  if (totalW > 1e-9) {
    return rawWeights.map((w) => w / totalW);
  }

  // Equal weight fallback so every asset still participates
  const eq = 1 / portfolio.length;
  return portfolio.map(() => eq);
}

/** Portfolio market value (shares × price). */
export function getPortfolioMarketValue(portfolio: Portfolio): number {
  return portfolio.reduce((sum, item) => sum + getHoldingValue(item), 0);
}

/** Weighted average dividend yield (fraction) across *all* assets. */
export function getPortfolioDividendYield(portfolio: Portfolio): number {
  if (portfolio.length === 0) return 0;
  const weights = getEffectiveWeights(portfolio);
  return portfolio.reduce((acc, item, i) => {
    return acc + getAssetYieldFraction(item) * weights[i];
  }, 0);
}

/**
 * Heuristic annual total return for an asset when history is unavailable.
 * Equity-ish default 6% price appreciation + yield; bond tickers get lower growth.
 */
export function estimateAssetTotalReturn(item: PortfolioItem): number {
  const yieldFrac = getAssetYieldFraction(item);
  const ticker = (item.ticker || "").toUpperCase();
  const name = (item.name || "").toLowerCase();

  // Bond / fixed-income heuristics (price appreciation near zero)
  const isBond =
    item.allocation?.bonds && item.allocation.bonds >= 50
      ? true
      : /\b(bond|treasury|aggregate|t-bill|fixed.?income|agg)\b/i.test(
          `${ticker} ${name}`,
        ) ||
        /^(BND|AGG|TLT|IEF|SHY|GOVT|BNDX|ZAG|XBB|ZCPB|VCIT|LQD|HYG|JNK)/.test(
          ticker,
        );

  const isCash =
    (item.allocation?.cash && item.allocation.cash >= 50) ||
    /\b(money.?market|cash|tbill)\b/i.test(`${ticker} ${name}`) ||
    /^(BIL|SGOV|SHV|MNY)/.test(ticker);

  if (isCash) return Math.max(yieldFrac, 0.04); // yield or ~risk-free
  if (isBond) return yieldFrac + 0.01; // coupon + modest price drift

  // Default equity price appreciation + dividends
  return yieldFrac + 0.06;
}

/**
 * Convert an annual simple yield/return into an additive daily log-return
 * contribution suitable for GBM / Monte Carlo mean drift.
 * δ_daily ≈ ln(1 + y) / 252
 */
export function annualYieldToDailyLogDrift(annualFraction: number): number {
  if (!Number.isFinite(annualFraction) || annualFraction <= -0.99) return 0;
  return Math.log(1 + annualFraction) / 252;
}
