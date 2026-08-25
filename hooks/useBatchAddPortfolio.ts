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

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function finiteNumber(value: any): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPortfolioEtf(raw: any, fallbackTicker: string): ETF {
  const ticker = (raw?.ticker || fallbackTicker).toUpperCase();
  return {
    ticker,
    name: raw?.name || ticker,
    price: finiteNumber(raw?.price),
    changePercent: finiteNumber(raw?.changePercent),
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

async function fetchStocksByTickers(tickers: string[]): Promise<ETF[]> {
  if (tickers.length === 0) return [];

  const unique = Array.from(new Set(tickers.map(normalizeTicker)));
  const found = new Map<string, ETF>();

  // Primary: DB-backed bulk search
  try {
    const response = await fetch(
      `/api/etfs/search?tickers=${encodeURIComponent(unique.join(","))}&includeHistory=true`,
    );
    if (response.ok) {
      const rawData = await response.json();
      if (Array.isArray(rawData)) {
        let stocks: ETF[] = [];
        try {
          stocks = z.array(ETFSchema).parse(rawData);
        } catch {
          stocks = rawData.map((r: any) =>
            toPortfolioEtf(r, r.ticker || ""),
          );
        }
        stocks.forEach((s) => found.set(normalizeTicker(s.ticker), s));
      }
    }
  } catch (e) {
    console.warn("Batch etfs/search failed, trying market fallback", e);
  }

  // Fallback: fast market search for any missing tickers
  const missing = unique.filter((t) => !found.has(t));
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (ticker) => {
        try {
          const res = await fetch(
            `/api/market/search?query=${encodeURIComponent(ticker)}&limit=5`,
          );
          if (!res.ok) return;
          const data = await res.json();
          if (!Array.isArray(data)) return;
          const match = data.find(
            (r: any) => normalizeTicker(r.ticker) === ticker,
          );
          if (match) found.set(ticker, toPortfolioEtf(match, ticker));
        } catch (e) {
          console.warn(`Market fallback failed for ${ticker}`, e);
        }
      }),
    );
  }

  return unique
    .map((ticker) => found.get(ticker))
    .filter((stock): stock is ETF => Boolean(stock));
}

export const useBatchAddPortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BatchAddPayload | BatchAddItem[]) => {
      const items = Array.isArray(payload) ? payload : payload.items;
      const replace = Array.isArray(payload) ? false : payload.replace;

      if (items.length === 0) return { stocks: [], updatedPortfolio: [] };

      const stocks = await fetchStocksByTickers(items.map((i) => i.ticker));

      if (stocks.length === 0) {
        throw new Error("Could not resolve any tickers for portfolio import");
      }

      const currentItems = replace ? [] : loadPortfolio();
      const updatedPortfolio = currentItems.map((item) => ({ ...item }));

      const inputMap = new Map<string, BatchAddItem>();
      items.forEach((i) => inputMap.set(normalizeTicker(i.ticker), i));

      updatedPortfolio.forEach((item) => {
        const update = inputMap.get(normalizeTicker(item.ticker));
        if (update) {
          if (update.weight !== undefined) item.weight = update.weight;
          if (update.shares !== undefined) item.shares = update.shares;
          inputMap.delete(normalizeTicker(item.ticker));
        }
      });

      stocks.forEach((stock) => {
        const input = inputMap.get(normalizeTicker(stock.ticker));
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
        const oldMap = new Map<string, Portfolio[number]>();
        if (oldPortfolio) {
          oldPortfolio.forEach((p) =>
            oldMap.set(normalizeTicker(p.ticker), p),
          );
        }

        const stockMap = new Map<string, ETF>();
        stocks.forEach((s) => stockMap.set(normalizeTicker(s.ticker), s));

        return updatedPortfolio.map((item) => {
          const richData =
            stockMap.get(normalizeTicker(item.ticker)) ||
            oldMap.get(normalizeTicker(item.ticker));

          return {
            ...(richData ?? toPortfolioEtf({}, item.ticker)),
            ...item,
          };
        });
      });

      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
};
