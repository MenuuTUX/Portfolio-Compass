import { useQuery } from "@tanstack/react-query";
import { Portfolio, ETF } from "@/types";
import { loadPortfolio } from "@/lib/storage";

/**
 * Hook to fetch the user's portfolio.
 * Reads from LocalStorage and fetches rich data for each item.
 */
export const usePortfolio = () => {
  return useQuery<Portfolio>({
    queryKey: ["portfolio"],
    queryFn: async () => {
      const localItems = loadPortfolio();

      if (localItems.length === 0) {
        return [];
      }

      // Fetch details for all tickers in a single batch request to prevent connection exhaustion
      // We request includeHoldings=true to support the Optimizer
      try {
        const tickers = localItems.map((item) => item.ticker).join(",");
        const response = await fetch(
          `/api/etfs/search?tickers=${tickers}&includeHistory=true&includeHoldings=true`,
        );

        if (!response.ok) {
          console.error("Failed to fetch portfolio data batch");
          return [];
        }

        const etfs: ETF[] = await response.json();

        // Merge local config with server data
        const portfolio: Portfolio = [];

        localItems.forEach((localItem) => {
          // Find exact match (case-insensitive)
          const etf = etfs.find(
            (e) => e.ticker.toUpperCase() === localItem.ticker.toUpperCase(),
          );
          if (etf) {
            portfolio.push({
              ...etf,
              weight: localItem.weight,
              shares: localItem.shares,
            });
          }
        });

        return portfolio;
      } catch (e) {
        console.error(`Failed to fetch portfolio details`, e);
        return [];
      }
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
};
