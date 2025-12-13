import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Portfolio, ETF } from '@/types';
// We import PortfolioSchema for validation if the API returns a full portfolio (which it doesn't always, but good to check context)
// The API returns { message: string } or similar for this POST.
// Wait, looking at the API code, POST returns { message: 'Stock added successfully' } or { message: 'Item already in portfolio' }.
// So validating against PortfolioSchema here is incorrect for the return value.
// However, the prompt asked to "Update the data fetching hooks to parse incoming JSON against this Zod schema".
// This implies we should validate where we get DATA.
// useAddStock *optimistically* updates the cache. It doesn't fetch the new portfolio in the response.
// But `onSettled` invalidates queries, which triggers `usePortfolio` (which IS validated).
// So `useAddStock` itself might not need validation of its response if it's just a success message.
// Let's check `useAddStock` again. It returns `res.json()`.
// If I look at the previous file content, it was just returning `res.json()`.
// The API returns `{ message: string }`.
// So no "Asset" schema validation is applicable here on the response.
// EXCEPT if the API changes to return the added item or the new portfolio.
// The current implementation of API returns: `NextResponse.json({ message: 'Stock added successfully' }, { status: 201 });`
// So I will NOT validate the response of `useAddStock` against `PortfolioSchema`.
// I will keep it as is, or maybe add validation for the success message if needed, but the prompt specified "external financial data" and "matches our API response structure" (referring to assetSchema).
// Since this hook doesn't fetch "financial data" (it sends it), and receives a status, I will leave it largely alone
// UNLESS I misunderstood and the user wants me to validate the `newStock` input? No, "parse incoming JSON".
// So `usePortfolio` is the main one.

// However, `useUpdatePortfolioItem` receives `formattedItem` which IS a `PortfolioItem`.
// `useRemoveStock` receives `{ message: string }`.

// So I will update `useUpdatePortfolioItem.ts`.

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
        const newPortfolio = [...prev, { ...newStock, weight: 0, shares: 0 }];
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
