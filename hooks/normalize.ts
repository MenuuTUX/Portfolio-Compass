import { ETF } from "@/types";

export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function finiteNumber(value: any): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Normalize a market/search payload into a portfolio-ready ETF shape. */
export function toPortfolioEtf(raw: any, fallbackTicker: string): ETF {
  const ticker = (raw?.ticker || fallbackTicker).toUpperCase();
  return {
    ticker,
    name: raw?.name || ticker,
    price: finiteNumber(raw?.price),
    currency: typeof raw?.currency === "string" ? raw.currency : undefined,
    quoteAsOf: raw?.quoteAsOf,
    changePercent: finiteNumber(raw?.changePercent ?? raw?.daily_change),
    assetType: raw?.assetType || "STOCK",
    isDeepAnalysisLoaded: Boolean(raw?.isDeepAnalysisLoaded),
    history: Array.isArray(raw?.history) ? raw.history : [],
    metrics: {
      mer: raw?.metrics?.mer === undefined ? undefined : raw.metrics.mer,
      merSource: raw?.metrics?.merSource,
      merRetrievedAt: raw?.metrics?.merRetrievedAt,
      merSourceField: raw?.metrics?.merSourceField,
      merInputUnit: raw?.metrics?.merInputUnit,
      merNormalization: raw?.metrics?.merNormalization,
      merMeasurementDate: raw?.metrics?.merMeasurementDate,
      yield: raw?.metrics?.yield === undefined ? raw?.dividendYield : raw.metrics.yield,
      yieldSource: raw?.metrics?.yieldSource,
      yieldRetrievedAt: raw?.metrics?.yieldRetrievedAt,
      yieldSourceField: raw?.metrics?.yieldSourceField,
      yieldInputUnit: raw?.metrics?.yieldInputUnit,
      yieldNormalization: raw?.metrics?.yieldNormalization,
      yieldMeasurementDate: raw?.metrics?.yieldMeasurementDate,
    },
    allocation: {
      equities: raw?.allocation?.equities ?? 0,
      bonds: raw?.allocation?.bonds ?? 0,
      cash: raw?.allocation?.cash ?? 0,
    },
    sectors: raw?.sectors || {},
    holdings: raw?.holdings,
    marketCap: raw?.marketCap,
    volume: raw?.volume,
    peRatio: raw?.peRatio,
    forwardPe: raw?.forwardPe,
    eps: raw?.eps,
    dividend: raw?.dividend,
    dividendYield: raw?.dividendYield,
    open: raw?.open,
    previousClose: raw?.previousClose,
    daysRange: raw?.daysRange,
    fiftyTwoWeekRange: raw?.fiftyTwoWeekRange,
    fiftyTwoWeekHigh: raw?.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: raw?.fiftyTwoWeekLow,
    earningsDate: raw?.earningsDate,
    sharesOutstanding: raw?.sharesOutstanding,
    sector: raw?.sector,
    industry: raw?.industry,
    beta: raw?.beta,
  };
}
