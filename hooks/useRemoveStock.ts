import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Portfolio } from '@/types';
import { loadPortfolio, savePortfolio } from '@/lib/storage';

export const useRemoveStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticker: string) => {
      // 1. Update Local Storage
      const currentItems = loadPortfolio();
      const newItems = currentItems.filter(
        (item) => item.ticker.toUpperCase() !== ticker.toUpperCase()
      );
      savePortfolio(newItems);

      return ticker;
    },
    onMutate: async (ticker) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['portfolio'] });

      // Snapshot the previous value
      const previousPortfolio = queryClient.getQueryData<Portfolio>(['portfolio']);

      // Optimistically update to the new value
      queryClient.setQueryData<Portfolio>(['portfolio'], (old) => {
        if (!old) return [];
        return old.filter((item) => item.ticker.toUpperCase() !== ticker.toUpperCase());
      });

      // Return a context object with the snapshotted value
      return { previousPortfolio };
    },
    onError: (err, newTicker, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousPortfolio) {
        queryClient.setQueryData(['portfolio'], context.previousPortfolio);
      }
    },
    onSettled: () => {
      // Always refetch after error or success:
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
};
