import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Portfolio } from "@/types";
import { loadPortfolio, savePortfolio } from "@/lib/storage";
import { PORTFOLIO_QUERY_KEY } from "@/lib/query-client";
import { normalizeTicker } from "@/lib/tickers";

interface UpdateParams {
  ticker: string;
  weight?: number;
  shares?: number;
}

export const useUpdatePortfolioItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticker, weight, shares }: UpdateParams) => {
      const currentItems = loadPortfolio();
      const newItems = currentItems.map((item) => {
        if (normalizeTicker(item.ticker) === normalizeTicker(ticker)) {
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
      await queryClient.cancelQueries({ queryKey: PORTFOLIO_QUERY_KEY });

      const previousPortfolio = queryClient.getQueryData<Portfolio>(PORTFOLIO_QUERY_KEY);

      queryClient.setQueryData<Portfolio>(PORTFOLIO_QUERY_KEY, (old) => {
        if (!old) return [];
        return old.map((item) => {
          if (normalizeTicker(item.ticker) === normalizeTicker(ticker)) {
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
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousPortfolio);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY });
    },
  });
};
