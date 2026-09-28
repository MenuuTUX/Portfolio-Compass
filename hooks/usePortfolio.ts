import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Portfolio, ETF } from "@/types";
import { loadPortfolio, type LocalPortfolioItem } from "@/lib/storage";
import { normalizeTicker, toPortfolioEtf } from "./normalize";
import { isExtendedMarketSession } from "@/lib/quote-session";

function mergeQuoteWithDetails(current: ETF, details?: ETF): ETF {
  if (!details) return current;
  const quoteFields = Object.fromEntries(
    Object.entries(current).filter(([, value]) => value !== undefined),
  );
  const currentSectors = current.sectors && Object.keys(current.sectors).length > 0;
  return {
    ...details,
    ...quoteFields,
    history: current.history.length > 0 ? current.history : details.history,
    metrics: {
      ...details.metrics,
      ...Object.fromEntries(
        Object.entries(current.metrics).filter(([, value]) => value != null),
      ),
    },
    allocation:
      current.allocation.equities + current.allocation.bonds + current.allocation.cash > 0
        ? current.allocation
        : details.allocation,
    sectors: currentSectors ? current.sectors : details.sectors,
    holdings: current.holdings?.length ? current.holdings : details.holdings,
    sector: current.sector ?? details.sector,
    industry: current.industry ?? details.industry,
  };
}

export function mergeLocalPortfolio(
  localItems: LocalPortfolioItem[],
  etfByTicker: Map<string, ETF>,
  previous: Portfolio = [],
): Portfolio {
  const previousByTicker = new Map(previous.map((item) => [item.ticker, item]));
  return localItems.map((localItem) => {
    const ticker = normalizeTicker(localItem.ticker);
    const quote = etfByTicker.get(ticker);
    const old = previousByTicker.get(ticker);
    const etf = quote
      ? mergeQuoteWithDetails(quote, old)
      : old ?? {
          ticker,
          name: ticker,
          price: 0,
          changePercent: 0,
          history: [],
          metrics: {},
          allocation: { equities: 0, bonds: 0, cash: 0 },
        };
    return {
      ...etf,
      quoteStatus: quote ? "ok" : old?.quoteStatus ?? "unavailable",
      weight: localItem.weight,
      shares: localItem.shares,
    };
  });
}

/**
 * Fetch portfolio prices first. Profiles and chart history hydrate afterward
 * so those slower requests do not hold up the current valuation.
 */
export const usePortfolio = (refreshEnabled = false) => {
  const queryClient = useQueryClient();
  const wasRefreshEnabled = useRef(false);
  const query = useQuery<Portfolio>({
    queryKey: ["portfolio"],
    queryFn: async ({ client }) => {
      const localItems = loadPortfolio();
      if (localItems.length === 0) return [];

      const tickers = localItems.map((item) => normalizeTicker(item.ticker));
      const previous = client.getQueryData<Portfolio>(["portfolio"]) ?? [];
      const previousTickers = previous.map((item) => item.ticker).join(",");
      if (
        previous.length > 0 &&
        previousTickers === tickers.join(",") &&
        !isExtendedMarketSession()
      ) {
        return previous;
      }
      const etfByTicker = new Map<string, ETF>();

      try {
        const response = await fetch(
          `/api/market/snapshot?tickers=${encodeURIComponent(tickers.join(","))}&history=false`,
        );
        if (response.ok) {
          const assets: ETF[] = await response.json();
          if (Array.isArray(assets)) {
            assets.forEach((asset) =>
              etfByTicker.set(normalizeTicker(asset.ticker), asset),
            );
          }
        }
      } catch (error) {
        console.error("Failed to fetch portfolio quotes:", error);
      }

      const missing = tickers.filter((ticker) => !etfByTicker.has(ticker));
      if (missing.length > 0) {
        await Promise.all(missing.map(async (ticker) => {
          try {
            const response = await fetch(
              `/api/market/search?query=${encodeURIComponent(ticker)}&limit=5&history=false&profiles=false`,
            );
            if (!response.ok) return;
            const assets = await response.json();
            const match = Array.isArray(assets)
              ? assets.find((asset: ETF) => normalizeTicker(asset.ticker) === ticker)
              : undefined;
            if (match) etfByTicker.set(ticker, toPortfolioEtf(match, ticker));
          } catch (error) {
            console.warn(`Portfolio quote fallback failed for ${ticker}`, error);
          }
        }));
      }

      return mergeLocalPortfolio(localItems, etfByTicker, previous);
    },
    staleTime: 15000,
    refetchOnWindowFocus: true,
    refetchInterval: refreshEnabled ? 60000 : false,
    refetchIntervalInBackground: false,
  });
  const { data, isStale, refetch } = query;

  useEffect(() => {
    if (refreshEnabled && !wasRefreshEnabled.current && data && isStale) {
      void refetch();
    }
    wasRefreshEnabled.current = refreshEnabled;
  }, [refreshEnabled, data, isStale, refetch]);

  const tickersKey = (data ?? []).map((item) => item.ticker).join(",");
  useEffect(() => {
    if (!tickersKey) return;
    let cancelled = false;

    fetch(`/api/etfs/search?tickers=${encodeURIComponent(tickersKey)}&includeHistory=true&profiles=true`)
      .then((response) => response.ok ? response.json() : [])
      .then((assets: ETF[]) => {
        if (cancelled || !Array.isArray(assets)) return;
        const detailsByTicker = new Map(
          assets.map((asset) => [normalizeTicker(asset.ticker), asset]),
        );
        queryClient.setQueryData<Portfolio>(["portfolio"], (current) => {
          if (!current || current.map((item) => item.ticker).join(",") !== tickersKey) {
            return current;
          }
          return current.map((item) => ({
            ...mergeQuoteWithDetails(item, detailsByTicker.get(item.ticker)),
            weight: item.weight,
            shares: item.shares,
          }));
        });
      })
      .catch((error) => console.warn("Portfolio details failed to load:", error));

    return () => {
      cancelled = true;
    };
  }, [tickersKey, queryClient]);

  return query;
};
