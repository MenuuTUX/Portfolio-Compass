import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Portfolio, PortfolioItem } from '@/types';
import { loadPortfolio, savePortfolio } from '@/lib/storage';

export interface ImportPortfolioItem {
  ticker: string;
  weight: number;
}

export const useImportPortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: ImportPortfolioItem[]) => {
      // 1. Update Local Storage
      const currentItems = loadPortfolio();

      // Create a map of existing items for quick lookup
      const existingItemsMap = new Map(
        currentItems.map(item => [item.ticker.toUpperCase(), item])
      );

      // Process new items
      items.forEach(newItem => {
        const key = newItem.ticker.toUpperCase();
        if (existingItemsMap.has(key)) {
          // Update existing item's weight
          const existing = existingItemsMap.get(key)!;
          existingItemsMap.set(key, { ...existing, weight: newItem.weight });
        } else {
          // Add new item
          existingItemsMap.set(key, {
            ticker: newItem.ticker, // Use the ticker provided (assuming valid from predefined list)
            weight: newItem.weight,
            shares: 0 // Default to 0 shares for new items
          });
        }
      });

      const newItems = Array.from(existingItemsMap.values());
      savePortfolio(newItems);
      return newItems;
    },
    onMutate: async (newItems) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['portfolio'] });

      // Snapshot the previous value
      const previousPortfolio = queryClient.getQueryData<Portfolio>(['portfolio']);

      // Optimistically update
      // Note: We don't have the full rich data (price, name, etc.) for new items yet.
      // The main usePortfolio query will fetch them when invalidated.
      // However, we can optimistically update with what we have for immediate UI feedback (names will be missing until fetch).
      queryClient.setQueryData<Portfolio>(['portfolio'], (old) => {
        if (!old) return [];

        // We need to merge 'newItems' (which are basic objects) with 'old' (which are full PortfolioItems)
        // But 'newItems' here is the argument to mutationFn which is ImportPortfolioItem[]
        // Wait, onMutate receives the variables passed to mutate.

        // Let's reconstruct the optimistic state
        const optimisticPortfolio: PortfolioItem[] = [...old];

        const itemsToImport = newItems as ImportPortfolioItem[]; // Cast for clarity

        itemsToImport.forEach(importItem => {
             const index = optimisticPortfolio.findIndex(p => p.ticker.toUpperCase() === importItem.ticker.toUpperCase());
             if (index >= 0) {
                 // Update weight
                 optimisticPortfolio[index] = {
                     ...optimisticPortfolio[index],
                     weight: importItem.weight
                 };
             } else {
                 // Add new placeholder
                 // We don't have name/price/etc, so we put placeholders.
                 // The UI handles loading/missing data gracefully usually?
                 // Or we can just let invalidation handle it.
                 // If we add it to the cache without full data, components expecting 'name' might break if strict.
                 // But PortfolioItem requires name, price, etc.
                 // So we can't easily optimistically update the *full* portfolio query with partial data.
                 // It's safer to NOT optimistically update the 'portfolio' query with partial data,
                 // but rely on invalidateQueries to refetch everything.
             }
        });

        // Because we can't easily fake the full ETF object synchronously without fetching,
        // we will skip optimistic updates for *new* items in the main query cache
        // and just rely on the refetch.
        // However, we CAN update weights of existing items.

        return optimisticPortfolio;
      });

      return { previousPortfolio };
    },
    onSettled: () => {
      // This will trigger a fetch of the full portfolio data, including the new items
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
};
