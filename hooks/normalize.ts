import { ETF } from "@/types";
import { normalizeTicker } from "@/lib/tickers";

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** An untrusted payload: every field may be missing or the wrong type. */
type RawEtfPayload = (Partial<ETF> & { daily_change?: unknown }) | null | undefined;

/** Normalize a market/search payload into a portfolio-ready ETF shape. */
export function toPortfolioEtf(raw: RawEtfPayload, fallbackTicker: string): ETF {
  const ticker = normalizeTicker(raw?.ticker || fallbackTicker);
  return {
    ticker,
    name: raw?.name || ticker,
    price: finiteNumber(raw?.price),
    currency: typeof raw?.currency === "string" ? raw.currency : undefined,
    quoteAsOf: raw?.quoteAsOf,
    quoteSession: raw?.quoteSession,
    changePercent: finiteNumber(raw?.changePercent ?? raw?.daily_change),
    assetType: raw?.assetType || "STOCK",
    isDeepAnalysisLoaded: Boolean(raw?.isDeepAnalysisLoaded),
    history: Array.isArray(raw?.history) ? raw.history : [],
    metrics: {
      ...raw?.metrics,
      yield: raw?.metrics?.yield === undefined ? raw?.dividendYield : raw.metrics.yield,
    },
    // A missing mix stays null; zeros would read as a known 0% equity fund.
    allocation: raw?.allocation
      ? {
          equities: raw.allocation.equities ?? 0,
          bonds: raw.allocation.bonds ?? 0,
          cash: raw.allocation.cash ?? 0,
          ...(raw.allocation.other !== undefined ? { other: raw.allocation.other } : {}),
        }
      : null,
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
