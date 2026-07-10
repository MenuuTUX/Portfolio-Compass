import { useQuery } from "@tanstack/react-query";
import { Portfolio, ETF } from "@/types";
import { loadPortfolio } from "@/lib/storage";

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function toPortfolioEtf(raw: any, fallbackTicker: string): ETF {
  const ticker = (raw?.ticker || fallbackTicker).toUpperCase();
  return {
    ticker,
    name: raw?.name || ticker,
    price: typeof raw?.price === "number" ? raw.price : 0,
    changePercent:
      typeof raw?.changePercent === "number" ? raw.changePercent : 0,
    assetType: raw?.assetType || "STOCK",
    isDeepAnalysisLoaded: Boolean(raw?.isDeepAnalysisLoaded),
    history: Array.isArray(raw?.history) ? raw.history : [],
    metrics: {
      mer: raw?.metrics?.mer ?? 0,
      yield: raw?.metrics?.yield ?? raw?.dividendYield ?? 0,
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

/**
 * Hook to fetch the user's portfolio.
 * Reads from LocalStorage and fetches rich data for each item.
 * Local-first: no login required.
 */
export const usePortfolio = () => {
  return useQuery<Portfolio>({
    queryKey: ["portfolio"],
    queryFn: async () => {
      const localItems = loadPortfolio();

      if (localItems.length === 0) {
        return [];
      }

      const etfByTicker = new Map<string, ETF>();

      // Batch DB-backed enrich
      try {
        const tickers = localItems.map((item) => item.ticker).join(",");
        const response = await fetch(
          `/api/etfs/search?tickers=${encodeURIComponent(tickers)}&includeHistory=true&includeHoldings=true`,
        );

        if (response.ok) {
          const etfs: ETF[] = await response.json();
          if (Array.isArray(etfs)) {
            etfs.forEach((e) =>
              etfByTicker.set(normalizeTicker(e.ticker), e),
            );
          }
        } else if (response.status !== 404) {
          console.error(
            "Failed to fetch portfolio data batch:",
            response.status,
          );
        }
      } catch (e) {
        console.error(`Failed to fetch portfolio details`, e);
      }

      // Market fallback for any unresolved tickers
      const missing = localItems
        .map((i) => normalizeTicker(i.ticker))
        .filter((t) => !etfByTicker.has(t));

      if (missing.length > 0) {
        await Promise.all(
          missing.map(async (ticker) => {
            try {
              const res = await fetch(
                `/api/market/search?query=${encodeURIComponent(ticker)}&limit=5`,
              );
              if (!res.ok) return;
              const data = await res.json();
              if (!Array.isArray(data)) return;
              const match = data.find(
                (r: any) => normalizeTicker(r.ticker) === ticker,
              );
              if (match) {
                etfByTicker.set(ticker, toPortfolioEtf(match, ticker));
              }
            } catch (e) {
              console.warn(`Portfolio market fallback failed for ${ticker}`, e);
            }
          }),
        );
      }

      const portfolio: Portfolio = [];
      localItems.forEach((localItem) => {
        const etf = etfByTicker.get(normalizeTicker(localItem.ticker));
        if (etf) {
          portfolio.push({
            ...etf,
            weight: localItem.weight,
            shares: localItem.shares,
          });
        }
      });

      return portfolio;
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
};
