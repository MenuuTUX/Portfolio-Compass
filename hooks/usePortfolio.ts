import { useQuery } from '@tanstack/react-query';
import { Portfolio, ETF } from '@/types';
import { loadPortfolio } from '@/lib/storage';

/**
 * Hook to fetch the user's portfolio.
 * Reads from LocalStorage and fetches rich data for each item.
 */
export const usePortfolio = () => {
  return useQuery<Portfolio>({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const localItems = loadPortfolio();

      if (localItems.length === 0) {
        return [];
      }

      // Fetch details for each ticker individually as per requirements
      const results = await Promise.all(
        localItems.map(async (item) => {
          try {
            const response = await fetch(`/api/etfs/search?query=${item.ticker}&includeHistory=true`);
            if (!response.ok) return null;
            const etfs: ETF[] = await response.json();
            // Find exact match (case-insensitive)
            const etf = etfs.find(e => e.ticker.toUpperCase() === item.ticker.toUpperCase());
            return etf || null;
          } catch (e) {
            console.error(`Failed to fetch details for ${item.ticker}`, e);
            return null;
          }
        })
      );

      // Merge local config with server data
      const portfolio: Portfolio = [];

      localItems.forEach((localItem, index) => {
        const etf = results[index];
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
