import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Portfolio, ETF } from "@/types";
import { loadPortfolio, savePortfolio } from "@/lib/storage";
import { z } from "zod";
import { ETFSchema } from "@/schemas/assetSchema";

export interface BatchAddItem {
  ticker: string;
  weight?: number;
  shares?: number;
}

interface BatchAddPayload {
  items: BatchAddItem[];
  replace?: boolean;
}

export const useBatchAddPortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BatchAddPayload | BatchAddItem[]) => {
      // Normalization to handle both signatures if necessary, but we are enforcing payload object for advanced features
      const items = Array.isArray(payload) ? payload : payload.items;
      const replace = Array.isArray(payload) ? false : payload.replace;

      if (items.length === 0) return { stocks: [], updatedPortfolio: [] };

      const tickers = items.map((i) => i.ticker).join(",");
      // Fetch details for all tickers to ensure validity and get rich data
      const response = await fetch(
        `/api/etfs/search?tickers=${tickers}&includeHistory=true`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch stocks details");
      }
      const rawData = await response.json();

      let stocks: ETF[] = [];
      try {
        stocks = z.array(ETFSchema).parse(rawData);
      } catch (e) {
        console.warn("Validation failed for batch add", e);
        stocks = rawData as ETF[];
      }

      // 2. Update Local Storage
      // If replace is true, start with empty portfolio, else load current
      const currentItems = replace ? [] : loadPortfolio();

      // Clone current items to avoid mutation
      const updatedPortfolio = currentItems.map((item) => ({ ...item }));

      // Map input items for easy access
      const inputMap = new Map<string, BatchAddItem>();
      items.forEach((i) => inputMap.set(i.ticker.toUpperCase(), i));

      // Update existing items
      updatedPortfolio.forEach((item) => {
        const update = inputMap.get(item.ticker.toUpperCase());
        if (update) {
          if (update.weight !== undefined) item.weight = update.weight;
          if (update.shares !== undefined) item.shares = update.shares;
          // Remove from map so we know what's left to add
          inputMap.delete(item.ticker.toUpperCase());
        }
      });

      // Add new items (only those that were successfully fetched)
      stocks.forEach((stock) => {
        const input = inputMap.get(stock.ticker.toUpperCase());
        if (input) {
          updatedPortfolio.push({
            ticker: stock.ticker,
            weight: input.weight || 0,
            shares: input.shares || 0,
          });
        }
      });

      savePortfolio(updatedPortfolio);
      return { stocks, updatedPortfolio };
    },
    onSuccess: (data) => {
      const { stocks, updatedPortfolio } = data;

      queryClient.setQueryData<Portfolio>(["portfolio"], (oldPortfolio) => {
        // oldPortfolio contains the Rich Data for existing items
        const oldMap = new Map<string, any>();
        if (oldPortfolio) {
          oldPortfolio.forEach((p) => oldMap.set(p.ticker.toUpperCase(), p));
        }

        // stockMap contains Rich Data for NEW items (and potentially existing ones if they were re-fetched)
        const stockMap = new Map<string, ETF>();
        stocks.forEach((s) => stockMap.set(s.ticker.toUpperCase(), s));

        // Reconstruct the full portfolio state
        // We map over 'updatedPortfolio' (the source of truth for structural data)
        // and attach the rich data from either stockMap or oldMap
        return updatedPortfolio.map((item) => {
          const richData =
            stockMap.get(item.ticker.toUpperCase()) ||
            oldMap.get(item.ticker.toUpperCase());

          // If we somehow miss rich data (e.g. fetch failed but item exists?), preserve what we can
          // The 'item' has ticker, weight, shares.
          return {
            ...(richData || {}),
            ...item,
          } as any; // Cast to avoid strict type issues with partial data during transition
        });
      });

      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
};
