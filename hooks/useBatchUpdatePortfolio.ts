import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Portfolio } from '@/types';
import { loadPortfolio, savePortfolio } from '@/lib/storage';

export interface BatchUpdateItem {
  ticker: string;
  weight?: number;
  shares?: number;
}

export const useBatchUpdatePortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: BatchUpdateItem[]) => {
      // 1. Update Local Storage
      const currentItems = loadPortfolio();
      const newItems = currentItems.map((item) => {
        const update = updates.find(u => u.ticker.toUpperCase() === item.ticker.toUpperCase());
        if (update) {
          return {
            ...item,
            weight: update.weight !== undefined ? update.weight : item.weight,
            shares: update.shares !== undefined ? update.shares : item.shares,
          };
        }
        return item;
      });
      savePortfolio(newItems);
      return updates;
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['portfolio'] });

      // Snapshot the previous value
      const previousPortfolio = queryClient.getQueryData<Portfolio>(['portfolio']);

      // Optimistically update
      queryClient.setQueryData<Portfolio>(['portfolio'], (old) => {
        if (!old) return [];
        return old.map((item) => {
          const update = updates.find(u => u.ticker.toUpperCase() === item.ticker.toUpperCase());
          if (update) {
            return {
              ...item,
              weight: update.weight !== undefined ? update.weight : item.weight,
              shares: update.shares !== undefined ? update.shares : item.shares,
            };
          }
          return item;
        });
      });

      return { previousPortfolio };
    },
    onError: (err, variables, context) => {
      if (context?.previousPortfolio) {
        queryClient.setQueryData(['portfolio'], context.previousPortfolio);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
};
