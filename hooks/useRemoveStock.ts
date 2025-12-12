import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Portfolio } from '@/types';

// The DELETE endpoint returns { message: string }, not financial data.
// So we don't validate against PortfolioSchema.
// We keep this file as is.

export const useRemoveStock = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (ticker: string) => {
            const res = await fetch(`/api/portfolio?ticker=${ticker}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to remove stock');
            return res.json();
        },
        onMutate: async (ticker) => {
            // Cancel any outgoing refetches for the portfolio list
            await queryClient.cancelQueries({ queryKey: ['portfolio'] });

            // Snapshot the previous portfolio state
            const previousPortfolio = queryClient.getQueryData<Portfolio>(['portfolio']);

            // Optimistically Update: Remove the stock from the query cache array immediately
            queryClient.setQueryData<Portfolio>(['portfolio'], (old) => {
                const prev = old || [];

                const newPortfolio = prev.filter(item => item.ticker !== ticker);

                if (newPortfolio.length === 0) return [];

                // Auto-balance logic (replicated from backend logic)
                const evenWeight = 100 / newPortfolio.length;
                return newPortfolio.map(item => ({ ...item, weight: Number(evenWeight.toFixed(2)) }));
            });

            // Return context with the snapshotted value
            return { previousPortfolio };
        },
        onError: (err, ticker, context) => {
            // Rollback the cache to the previous snapshot
            if (context?.previousPortfolio) {
                queryClient.setQueryData(['portfolio'], context.previousPortfolio);
            }
            console.error("Error removing stock:", err);
        },
        onSettled: () => {
            // Invalidate the query to trigger a true background refresh
            queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        },
    });
};
