import { useQuery } from "@tanstack/react-query";
import { Portfolio, ETF } from "@/types";
import { loadPortfolio, type LocalPortfolioItem } from "@/lib/storage";
import { normalizeTicker, toPortfolioEtf } from "./normalize";

export function mergeLocalPortfolio(
  localItems: LocalPortfolioItem[],
  etfByTicker: Map<string, ETF>,
): Portfolio {
  return localItems.map((localItem) => {
    const ticker = normalizeTicker(localItem.ticker);
    const etf = etfByTicker.get(ticker);
    return {
      ...(etf ?? {
        ticker,
        name: ticker,
        price: 0,
        changePercent: 0,
        history: [],
        metrics: {},
        allocation: { equities: 0, bonds: 0, cash: 0 },
      }),
      quoteStatus: etf ? "ok" : "unavailable",
      weight: localItem.weight,
      shares: localItem.shares,
    };
  });
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

      // Batch live-market enrichment
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

      return mergeLocalPortfolio(localItems, etfByTicker);
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });
};
