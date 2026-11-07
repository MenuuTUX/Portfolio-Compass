import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Portfolio } from "@/types";
import { loadPortfolio, savePortfolio } from "@/lib/storage";
import { PORTFOLIO_QUERY_KEY } from "@/lib/query-client";
import { normalizeTicker } from "@/lib/tickers";

export const useRemoveStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticker: string) => {
      const currentItems = loadPortfolio();
      const newItems = currentItems.filter(
        (item) => normalizeTicker(item.ticker) !== normalizeTicker(ticker),
      );
      savePortfolio(newItems);

      return ticker;
    },
    onMutate: async (ticker) => {
      await queryClient.cancelQueries({ queryKey: PORTFOLIO_QUERY_KEY });

      const previousPortfolio = queryClient.getQueryData<Portfolio>(PORTFOLIO_QUERY_KEY);

      queryClient.setQueryData<Portfolio>(PORTFOLIO_QUERY_KEY, (old) => {
        if (!old) return [];
        return old.filter(
          (item) => normalizeTicker(item.ticker) !== normalizeTicker(ticker),
        );
      });

      return { previousPortfolio };
    },
    onError: (err, newTicker, context) => {
      if (context?.previousPortfolio) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousPortfolio);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY });
    },
  });
};
