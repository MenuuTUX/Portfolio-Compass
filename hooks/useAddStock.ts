import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Portfolio, ETF } from "@/types";
import { loadPortfolio, savePortfolio } from "@/lib/storage";

interface AddStockParams {
  ticker: string;
}

/**
 * Hook to add a stock to the local portfolio.
 * Fetches details from API to validate, then saves to LocalStorage.
 */
export const useAddStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticker }: AddStockParams) => {
      // 1. Fetch rich data first to ensure ticker is valid and get details
      const response = await fetch(
        `/api/etfs/search?query=${ticker}&includeHistory=true`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch stock details");
      }
      const results: ETF[] = await response.json();
      const stock = results.find(
        (r) => r.ticker.toUpperCase() === ticker.toUpperCase(),
      );

      if (!stock) {
        throw new Error(`Ticker ${ticker} not found`);
      }

      // 2. Update Local Storage
      const currentItems = loadPortfolio();

      // Prevent duplicates
      if (
        currentItems.some(
          (item) => item.ticker.toUpperCase() === ticker.toUpperCase(),
        )
      ) {
        return; // Or throw error "Already in portfolio"
      }

      const newItem = {
        ticker: stock.ticker, // Use canonical ticker from API
        weight: 0,
        shares: 0,
      };

      const newItems = [...currentItems, newItem];
      savePortfolio(newItems);

      return stock;
    },
    onSuccess: (newStock) => {
      if (!newStock) return;

      // 3. Optimistic Update (or rather, immediate update after successful fetch)
      queryClient.setQueryData<Portfolio>(["portfolio"], (oldPortfolio) => {
        if (!oldPortfolio) return [];

        // Check if already exists in query cache (should match storage check)
        if (
          oldPortfolio.some(
            (item) =>
              item.ticker.toUpperCase() === newStock.ticker.toUpperCase(),
          )
        ) {
          return oldPortfolio;
        }

        const newPortfolioItem = {
          ...newStock,
          weight: 0,
          shares: 0,
        };

        return [...oldPortfolio, newPortfolioItem];
      });

      // Optional: Invalidate to ensure consistency, though we just updated cache
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
};
