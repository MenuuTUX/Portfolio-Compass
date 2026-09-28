import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Portfolio, ETF } from "@/types";
import { loadPortfolio, savePortfolio } from "@/lib/storage";
import { normalizeTicker, toPortfolioEtf } from "./normalize";

interface AddStockParams {
  ticker: string;
  /** Optional already-fetched asset. Prefer this over re-fetching. */
  etf?: ETF;
}




/**
 * Resolve asset details for a ticker.
 * Prefers client-provided data, then exact ticker lookup, then market search.
 */
async function resolveStock(
  ticker: string,
  provided?: ETF,
): Promise<ETF> {
  const target = normalizeTicker(ticker);

  if (provided && normalizeTicker(provided.ticker) === target) {
    return toPortfolioEtf(provided, target);
  }

  // Exact ticker match via DB-backed search (enriches history/holdings when available)
  const exactRes = await fetch(
    `/api/etfs/search?tickers=${encodeURIComponent(target)}&includeHistory=true`,
  );

  if (exactRes.ok) {
    const results = await exactRes.json();
    if (Array.isArray(results)) {
      const match = results.find(
        (r: any) => normalizeTicker(r.ticker) === target,
      );
      if (match) return toPortfolioEtf(match, target);
    }
  }

  // Fast market fallback using the same database-free path as the browse UI.
  const marketRes = await fetch(
    `/api/market/search?query=${encodeURIComponent(target)}&limit=10`,
  );
  if (marketRes.ok) {
    const marketResults = await marketRes.json();
    if (Array.isArray(marketResults)) {
      const match = marketResults.find(
        (r: any) => normalizeTicker(r.ticker) === target,
      );
      if (match) return toPortfolioEtf(match, target);
    }
  }

  // Surface non-OK search status so callers see real failures (not silent 200s)
  if (!exactRes.ok && exactRes.status !== 404) {
    throw new Error(
      `Failed to fetch stock details (${exactRes.status})`,
    );
  }

  throw new Error(`Ticker ${target} not found`);
}

/**
 * Hook to add a stock/ETF to the local portfolio.
 * Local-first: writes to LocalStorage; optional API enrich is best-effort.
 */
export const useAddStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticker, etf }: AddStockParams) => {
      const target = normalizeTicker(ticker);
      if (!target) {
        throw new Error("Ticker is required");
      }

      const currentItems = loadPortfolio();

      if (
        currentItems.some(
          (item) => normalizeTicker(item.ticker) === target,
        )
      ) {
        throw new Error(`${target} is already in your portfolio`);
      }

      const stock = await resolveStock(target, etf);

      const newItem = {
        ticker: stock.ticker,
        weight: 0,
        shares: 0,
      };

      savePortfolio([...currentItems, newItem]);
      return stock;
    },
    onSuccess: (newStock) => {
      queryClient.setQueryData<Portfolio>(["portfolio"], (oldPortfolio) => {
        if (!oldPortfolio) {
          return [
            {
              ...newStock,
              weight: 0,
              shares: 0,
            },
          ];
        }

        if (
          oldPortfolio.some(
            (item) =>
              normalizeTicker(item.ticker) ===
              normalizeTicker(newStock.ticker),
          )
        ) {
          return oldPortfolio;
        }

        return [
          ...oldPortfolio,
          {
            ...newStock,
            weight: 0,
            shares: 0,
          },
        ];
      });

      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
};
