import { Portfolio, PortfolioItem } from "@/types";
import { isUnverifiedProviderYield } from "@/lib/yield-provenance";

/**
 * Shared portfolio return / weight / dividend helpers used by
 * Wealth Projector, Monte Carlo, and historical stats.
 *
 * Price history in this app comes from unadjusted closes, so historical
 * log-returns are price returns. A current yield estimate does not reconstruct
 * historical total return; that requires dated distributions or adjusted prices.
 */

/** Resolve dividend yield as a fraction (e.g. 0.015 for 1.5%). */
export function getAssetYieldFraction(item: PortfolioItem): number {
  return getKnownAssetYieldFraction(item) ?? 0;
}

function getKnownAssetYieldFraction(item: PortfolioItem): number | null {
  // A legacy numeric yield without a source has no known definition or unit.
  if (!item.metrics?.yieldSource?.trim()) return null;
  if (isUnverifiedProviderYield(item.metrics.yieldSource)) return null;
  const metricYield = item.metrics?.yield;
  if (
    typeof metricYield === "number" && Number.isFinite(metricYield) &&
    metricYield > 0
  ) return metricYield / 100;
  if (
    typeof item.dividendYield === "number" && Number.isFinite(item.dividendYield) &&
    item.dividendYield > 0
  ) return item.dividendYield / 100;

  // A zero yield is known only when provider provenance distinguishes it from
  // a missing value that older quote payloads defaulted to zero.
  if (item.metrics?.yield === 0 && item.metrics.yieldSource) return 0;
  if (item.dividendYield === 0 && item.metrics?.yieldSource) return 0;
  return null;
}

export function getReportedAssetYieldFraction(item: PortfolioItem): number | null {
  return getKnownAssetYieldFraction(item);
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
 *  1. Market-value weights from shares × price (when every held value is complete)
 *  2. Explicit `weight` field (user allocation % / units)
 *  3. Equal weight across all assets
 *
 * Always returns one weight per input item, summing to 1.
 * Includes every asset and never silently drops holdings.
 */
export function getEffectiveWeights(
  portfolio: Portfolio,
  fx?: BankOfCanadaFxRate | null,
  baseCurrency?: string,
  now = Date.now(),
): number[] {
  if (portfolio.length === 0) return [];

  const valuation = getPortfolioValuation(portfolio, baseCurrency, now, fx);
  const values = portfolio.map((item) => {
    if (!Number.isFinite(item.shares) || item.shares <= 0) return 0;
    const value = getHoldingValue(item);
    return item.currency === valuation.baseCurrency
      ? value
      : item.currency === "USD" && valuation.baseCurrency === "CAD" && fx
        ? value * fx.usdCad
        : item.currency === "CAD" && valuation.baseCurrency === "USD" && fx
          ? value / fx.usdCad
          : value;
  });
  const totalValue = values.reduce((a, b) => a + b, 0);

  if (valuation.complete && totalValue > 1e-9) {
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

export interface PortfolioValuation {
  /** Currency requested or inferred from the valued holdings. */
  baseCurrency: string | null;
  /** Null when any held value is missing or requires unavailable FX conversion. */
  totalValue: number | null;
  heldHoldings: number;
  pricedHoldings: number;
  complete: boolean;
  unavailableReason:
    | "quote-unavailable"
    | "quote-missing"
    | "quote-invalid"
    | "quote-stale"
    | "quote-from-future"
    | "currency-unavailable"
    | "unsupported-shares"
    | "fx-conversion-unavailable"
    | null;
}

export interface BankOfCanadaFxRate {
  /** Bank of Canada daily average: CAD per USD. */
  usdCad: number;
  /** Observation date in YYYY-MM-DD. */
  date: string;
}

export type QuoteFreshness = "fresh" | "missing" | "invalid" | "stale" | "future";

// Temporary elapsed-time limit for current valuation. Long market closures can
// outlast it; exchange-calendar freshness remains a separate policy decision.
const MAX_QUOTE_AGE_MS = 5 * 24 * 60 * 60 * 1000;
const FUTURE_QUOTE_TOLERANCE_MS = 5 * 60 * 1000;

export function getQuoteFreshness(
  quoteAsOf: unknown,
  now = Date.now(),
): QuoteFreshness {
  if (quoteAsOf == null) return "missing";
  if (typeof quoteAsOf !== "string") return "invalid";
  if (quoteAsOf.trim() === "") return "missing";
  const timestamp = Date.parse(quoteAsOf);
  if (!Number.isFinite(timestamp)) return "invalid";
  const age = now - timestamp;
  if (age < -FUTURE_QUOTE_TOLERANCE_MS) return "future";
  if (age > MAX_QUOTE_AGE_MS) return "stale";
  return "fresh";
}

/**
 * Value held positions in an explicit base currency. Current USD/CAD
 * conversion requires a fresh dated rate. Incomplete totals are suppressed.
 */
export function getPortfolioValuation(
  portfolio: Portfolio,
  requestedBaseCurrency?: string,
  now = Date.now(),
  fx?: BankOfCanadaFxRate | null,
): PortfolioValuation {
  const held = portfolio.filter((item) => Number.isFinite(item.shares) && item.shares > 0);
  const unsupportedShares = portfolio.some(
    (item) => !Number.isFinite(item.shares) || item.shares < 0,
  );
  const relevant = held.length > 0 ? held : portfolio;
  const currencies = relevant.map((item) => item.currency);
  const inferredCurrency = currencies[0];
  const validBaseCurrency = (currency?: string | null) =>
    typeof currency === "string" && /^[A-Z]{3}$/.test(currency);
  const baseCurrency = requestedBaseCurrency ?? inferredCurrency ?? null;
  const targetCurrencyValid = validBaseCurrency(baseCurrency);
  const quoteIssues = relevant.map((item) => {
    if (item.quoteStatus === "unavailable") return "quote-unavailable" as const;
    if (!Number.isFinite(item.price) || item.price <= 0) return "quote-missing" as const;
    const freshness = getQuoteFreshness(item.quoteAsOf, now);
    if (freshness === "missing") return "quote-missing" as const;
    if (freshness === "invalid") return "quote-invalid" as const;
    if (freshness === "stale") return "quote-stale" as const;
    if (freshness === "future") return "quote-from-future" as const;
    if (!validBaseCurrency(item.currency)) return "currency-unavailable" as const;
    return null;
  });
  const priced = quoteIssues.filter((issue) => issue === null).length;
  const fxDateTimestamp = fx && /^\d{4}-\d{2}-\d{2}$/.test(fx.date)
    ? Date.parse(`${fx.date}T00:00:00Z`)
    : NaN;
  const fxIsFresh = !!fx && Number.isFinite(fx.usdCad) && fx.usdCad > 0 &&
    Number.isFinite(fxDateTimestamp) &&
    new Date(fxDateTimestamp).toISOString().slice(0, 10) === fx.date &&
    fx.date <= new Date(now).toISOString().slice(0, 10) &&
    now - fxDateTimestamp <= MAX_QUOTE_AGE_MS;
  const needsFx = relevant.some((item) => item.currency !== baseCurrency);
  const complete = targetCurrencyValid && relevant.length > 0 &&
    priced === relevant.length && (!needsFx || fxIsFresh) &&
    relevant.every((item) => item.currency === baseCurrency ||
      ((item.currency === "USD" && baseCurrency === "CAD") ||
        (item.currency === "CAD" && baseCurrency === "USD"))) &&
    !unsupportedShares;
  const firstQuoteIssue = quoteIssues.find((issue) => issue !== null) ?? null;
  const unavailableReason = complete
    ? null
    : unsupportedShares
      ? "unsupported-shares"
        : firstQuoteIssue ?? (!targetCurrencyValid || relevant.length === 0
        ? "currency-unavailable"
        : "fx-conversion-unavailable");
  const totalValue = complete
    ? held.reduce((sum, item) => sum + getHoldingValue(item) *
      (item.currency === baseCurrency ? 1 : item.currency === "USD" ? fx!.usdCad : 1 / fx!.usdCad), 0)
    : null;

  return {
    baseCurrency: targetCurrencyValid ? baseCurrency : null,
    totalValue,
    heldHoldings: held.length,
    pricedHoldings: priced,
    complete,
    unavailableReason,
  };
}

/** Portfolio market value in its inferred currency, or NaN if incomplete. */
export function getPortfolioMarketValue(
  portfolio: Portfolio,
  baseCurrency?: string,
): number {
  return getPortfolioValuation(portfolio, baseCurrency).totalValue ?? NaN;
}

/** A complete portfolio currency, or null when values need unavailable FX. */
export function getPortfolioCurrency(portfolio: Portfolio): string | null {
  const valuation = getPortfolioValuation(portfolio);
  return valuation.complete ? valuation.baseCurrency : null;
}

/** Weighted average reported yield, or null if any weighted asset lacks it. */
export function getPortfolioDividendYieldStatus(portfolio: Portfolio): {
  yield: number | null;
  complete: boolean;
  missingTickers: string[];
} {
  if (portfolio.length === 0) {
    return { yield: 0, complete: true, missingTickers: [] };
  }
  const weights = getEffectiveWeights(portfolio);
  const missingTickers: string[] = [];
  let weightedYield = 0;
  portfolio.forEach((item, index) => {
    if (weights[index] <= 0) return;
    const knownYield = getKnownAssetYieldFraction(item);
    if (knownYield === null) missingTickers.push(item.ticker);
    else weightedYield += knownYield * weights[index];
  });
  const complete = missingTickers.length === 0;
  return { yield: complete ? weightedYield : null, complete, missingTickers };
}

/** Cumulative gain as a percentage of all money paid into a scenario. */
export function gainOnInvestedPercent(endingValue: number, totalInvested: number): number {
  return totalInvested > 0
    ? ((endingValue - totalInvested) / totalInvested) * 100
    : 0;
}

/** Coarse asset class, inferred from allocation data then ticker/name shape. */
export type AssetClass = "cash" | "bond" | "equity";

/**
 * Classifies a holding for the heuristics that need to tell a T-bill fund from
 * an equity fund: expected return when history is missing, and the default beta
 * used to build a covariance matrix.
 */
export function classifyAsset(item: PortfolioItem): AssetClass {
  const ticker = (item.ticker || "").toUpperCase();
  const name = (item.name || "").toLowerCase();

  const isCash =
    (item.allocation?.cash && item.allocation.cash >= 50) ||
    /\b(money.?market|cash|tbill)\b/i.test(`${ticker} ${name}`) ||
    /^(BIL|SGOV|SHV|MNY)/.test(ticker);
  if (isCash) return "cash";

  const isBond =
    item.allocation?.bonds && item.allocation.bonds >= 50
      ? true
      : /\b(bond|treasury|aggregate|t-bill|fixed.?income|agg)\b/i.test(
          `${ticker} ${name}`,
        ) ||
        /^(BND|AGG|TLT|IEF|SHY|GOVT|BNDX|ZAG|XBB|ZCPB|VCIT|LQD|HYG|JNK)/.test(
          ticker,
        );
  if (isBond) return "bond";

  return "equity";
}

/** Market beta per asset class, for holdings that carry no beta of their own. */
const DEFAULT_BETA: Record<AssetClass, number> = {
  cash: 0.0,
  bond: 0.15,
  equity: 1.0,
};

/**
 * Market beta for an asset.
 *
 * A quote genuinely reporting beta 0 — a T-bill fund — must survive as 0, so
 * this reads the field with `??` rather than `||`. When beta is absent the
 * default comes from the asset class, not a blanket 1.0 that would price a
 * money-market fund as full equity.
 */
export function getAssetBeta(item: PortfolioItem): number {
  const beta = Number(item.beta);
  if (Number.isFinite(beta)) return beta;
  return DEFAULT_BETA[classifyAsset(item)];
}

/** Convert an effective annual return into its equivalent monthly rate. */
export function annualRateToMonthlyRate(annualFraction: number): number {
  if (!Number.isFinite(annualFraction) || annualFraction <= -1) return -1;
  return Math.pow(1 + annualFraction, 1 / 12) - 1;
}
