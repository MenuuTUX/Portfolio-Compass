import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Portfolio, ETF } from '@/types';

export const useAddStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newStock: ETF) => {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStock),
      });
      if (!res.ok) throw new Error('Failed to add stock');
      return res.json();
    },
    onMutate: async (newStock) => {
      // Cancel any outgoing refetches for the portfolio list
      await queryClient.cancelQueries({ queryKey: ['portfolio'] });

      // Snapshot the previous portfolio state
      const previousPortfolio = queryClient.getQueryData<Portfolio>(['portfolio']);

      // Optimistically Update: Manually inject the new stock into the query cache array immediately
      queryClient.setQueryData<Portfolio>(['portfolio'], (old) => {
        const prev = old || [];

        // Prevent duplicate addition
        if (prev.find(item => item.ticker === newStock.ticker)) return prev;

        // Auto-balance logic (replicated from backend logic)
        const newPortfolio = [...prev, { ...newStock, weight: 0 }];
        const evenWeight = 100 / newPortfolio.length;
        return newPortfolio.map(item => ({ ...item, weight: Number(evenWeight.toFixed(2)) }));
      });

      // Return context with the snapshotted value
      return { previousPortfolio };
    },
    onError: (err, newStock, context) => {
      // Rollback the cache to the previous snapshot
      if (context?.previousPortfolio) {
        queryClient.setQueryData(['portfolio'], context.previousPortfolio);
      }
      console.error("Error adding stock:", err);
    },
    onSettled: () => {
      // Invalidate the query to trigger a true background refresh
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
};
