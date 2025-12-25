import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Portfolio } from '@/types';
import { loadPortfolio, savePortfolio } from '@/lib/storage';

interface UpdateParams {
  ticker: string;
  weight?: number;
  shares?: number;
}

export const useUpdatePortfolioItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticker, weight, shares }: UpdateParams) => {
      // 1. Update Local Storage
      const currentItems = loadPortfolio();
      const newItems = currentItems.map((item) => {
        if (item.ticker.toUpperCase() === ticker.toUpperCase()) {
          return {
            ...item,
            weight: weight !== undefined ? weight : item.weight,
            shares: shares !== undefined ? shares : item.shares,
          };
        }
        return item;
      });
      savePortfolio(newItems);

      return { ticker, weight, shares };
    },
    onMutate: async ({ ticker, weight, shares }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['portfolio'] });

      // Snapshot the previous value
      const previousPortfolio = queryClient.getQueryData<Portfolio>(['portfolio']);

      // Optimistically update
      queryClient.setQueryData<Portfolio>(['portfolio'], (old) => {
        if (!old) return [];
        return old.map((item) => {
          if (item.ticker.toUpperCase() === ticker.toUpperCase()) {
            return {
              ...item,
              weight: weight !== undefined ? weight : item.weight,
              shares: shares !== undefined ? shares : item.shares,
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
