import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Portfolio, ETF } from "@/types";
import { loadPortfolio, savePortfolio } from "@/lib/storage";

interface AddStockParams {
  ticker: string;
  /** Optional already-fetched asset. Prefer this over re-fetching. */
  etf?: ETF;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * Normalize a market/search payload into a portfolio-ready ETF shape.
 */
function toPortfolioEtf(raw: any, fallbackTicker: string): ETF {
  const ticker = (raw?.ticker || fallbackTicker).toUpperCase();
  return {
    ticker,
    name: raw?.name || ticker,
    price: typeof raw?.price === "number" ? raw.price : 0,
    changePercent:
      typeof raw?.changePercent === "number"
        ? raw.changePercent
        : typeof raw?.daily_change === "number"
          ? raw.daily_change
          : 0,
    assetType: raw?.assetType || "STOCK",
    isDeepAnalysisLoaded: Boolean(raw?.isDeepAnalysisLoaded),
    history: Array.isArray(raw?.history) ? raw.history : [],
    metrics: {
      mer: raw?.metrics?.mer ?? 0,
      yield: raw?.metrics?.yield ?? raw?.dividendYield ?? 0,
    },
    allocation: {
      equities: raw?.allocation?.equities ?? 0,
      bonds: raw?.allocation?.bonds ?? 0,
      cash: raw?.allocation?.cash ?? 0,
    },
    sectors: raw?.sectors || {},
    holdings: raw?.holdings,
    marketCap: raw?.marketCap,
    volume: raw?.volume,
    peRatio: raw?.peRatio,
    forwardPe: raw?.forwardPe,
    eps: raw?.eps,
    dividend: raw?.dividend,
    dividendYield: raw?.dividendYield,
    open: raw?.open,
    previousClose: raw?.previousClose,
    daysRange: raw?.daysRange,
    fiftyTwoWeekRange: raw?.fiftyTwoWeekRange,
    fiftyTwoWeekHigh: raw?.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: raw?.fiftyTwoWeekLow,
    earningsDate: raw?.earningsDate,
    sharesOutstanding: raw?.sharesOutstanding,
    sector: raw?.sector,
    industry: raw?.industry,
    beta: raw?.beta,
  };
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

  // Fast market fallback (same path the browse UI uses — no DB required)
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
