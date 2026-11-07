import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Portfolio, ETF } from "@/types";
import { loadPortfolio, PORTFOLIO_STORAGE_KEY, type LocalPortfolioItem } from "@/lib/storage";
import { normalizeTicker } from "@/lib/tickers";
import { PORTFOLIO_QUERY_KEY } from "@/lib/query-client";
import { toPortfolioEtf } from "./normalize";
import { selectReturnBasis } from "@/lib/math/history";
import { isExtendedMarketSession } from "@/lib/quote-session";

const hasAdjusted = (history: ETF["history"]) => selectReturnBasis([history]) === "total";

/**
 * A quote's short history normally wins, but a detail history with adjusted
 * closes replaces one without, so stored portfolios gain total-return math.
 */
export function pickHistory(current: ETF["history"], details: ETF["history"]): ETF["history"] {
  if (current.length === 0) return details;
  if (details.length >= current.length && hasAdjusted(details) && !hasAdjusted(current)) return details;
  return current;
}

function hasKnownMix(allocation: ETF["allocation"] | undefined): boolean {
  if (!allocation) return false;
  const total = allocation.equities + allocation.bonds + allocation.cash + (allocation.other ?? 0);
  return Number.isFinite(total) && total > 0;
}

function mergeQuoteWithDetails(current: ETF, details?: ETF): ETF {
  if (!details) return current;
  const quoteFields = Object.fromEntries(
    Object.entries(current).filter(([, value]) => value !== undefined),
  );
  const currentSectors = current.sectors && Object.keys(current.sectors).length > 0;
  return {
    ...details,
    ...quoteFields,
    history: pickHistory(current.history, details.history),
    metrics: {
      ...details.metrics,
      ...Object.fromEntries(
        Object.entries(current.metrics).filter(([, value]) => value != null),
      ),
    },
    // Older payloads stored a missing mix as all zeros; treat that as missing.
    allocation: hasKnownMix(current.allocation)
      ? current.allocation
      : hasKnownMix(details.allocation) ? details.allocation : null,
    sectors: currentSectors ? current.sectors : details.sectors,
    holdings: current.holdings?.length ? current.holdings : details.holdings,
    sector: current.sector ?? details.sector,
    industry: current.industry ?? details.industry,
  };
}

interface FundProfile {
  beta?: number | null;
  allocation?: { equities?: number; bonds?: number; cash?: number } | null;
  holdings?: { ticker: string; name: string; weight: number }[] | null;
  /** Sector weights as fractions (0-1), the same unit Sector X-Ray expects. */
  sectors?: Record<string, number> | null;
}

/** A fund still missing the mix, beta or holdings the optimizer and look-through use. */
export function needsFundProfile(item: ETF): boolean {
  if (item.assetType === "STOCK") return false;
  const a = item.allocation;
  return typeof item.beta !== "number" || !a || a.equities + a.bonds + a.cash <= 0 || !item.holdings?.length;
}

/** Fills fund fields the item is missing; never overwrites data it already has. */
export function mergeFundProfile<T extends ETF>(item: T, fund?: FundProfile | null): T {
  if (!fund) return item;
  const next = { ...item };
  if (typeof next.beta !== "number" && typeof fund.beta === "number" && Number.isFinite(fund.beta)) {
    next.beta = fund.beta;
  }
  const a = next.allocation;
  const hasMix = !!a && a.equities + a.bonds + a.cash > 0;
  const f = fund.allocation;
  if (!hasMix && f && (f.equities ?? 0) + (f.bonds ?? 0) + (f.cash ?? 0) > 0) {
    next.allocation = { equities: f.equities ?? 0, bonds: f.bonds ?? 0, cash: f.cash ?? 0 };
  }
  if (!next.holdings?.length && fund.holdings?.length) {
    next.holdings = fund.holdings.map((h) => ({ ticker: h.ticker, name: h.name, weight: h.weight }));
  }
  if ((!next.sectors || Object.keys(next.sectors).length === 0) && fund.sectors && Object.keys(fund.sectors).length > 0) {
    next.sectors = fund.sectors;
  }
  return next;
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
          allocation: null,
        };
    return {
      ...etf,
      quoteStatus: quote ? "ok" : old?.quoteStatus ?? "unavailable",
      weight: localItem.weight,
      shares: localItem.shares,
    };
  });
}

/** A holding with no usable price is retried at most this often while the market is closed. */
const UNAVAILABLE_RETRY_MS = 30_000;

/** Holdings and their weights and shares, as one string, so any edit changes it. */
const holdingsSignature = (items: { ticker: string; weight: number; shares: number }[]) =>
  items.map((item) => `${item.ticker}|${item.weight}|${item.shares}`).join(",");

/**
 * Fetch portfolio prices first. Profiles and chart history hydrate afterward
 * so those slower requests do not hold up the current valuation.
 */
export const usePortfolio = (refreshEnabled = false) => {
  const queryClient = useQueryClient();
  const wasRefreshEnabled = useRef(false);
  // When quotes were last requested. Reused answers do not count, so the retry window stays fixed.
  const lastNetworkFetch = useRef(0);
  const query = useQuery<Portfolio>({
    queryKey: PORTFOLIO_QUERY_KEY,
    queryFn: async ({ client }) => {
      const localItems = loadPortfolio();
      if (localItems.length === 0) return [];

      const tickers = localItems.map((item) => normalizeTicker(item.ticker));
      const previous = client.getQueryData<Portfolio>(PORTFOLIO_QUERY_KEY) ?? [];
      const sameHoldings =
        previous.length > 0 &&
        holdingsSignature(previous) === holdingsSignature(
          localItems.map((item) => ({ ticker: normalizeTicker(item.ticker), weight: item.weight, shares: item.shares })),
        );
      // Outside market hours the prices do not move, so the last answer is reused,
      // except a holding with no price is retried (at most every 30 seconds).
      const missingPrice = previous.some((item) => item.quoteStatus === "unavailable" || !(item.price > 0));
      const retryDue = Date.now() - lastNetworkFetch.current >= UNAVAILABLE_RETRY_MS;
      if (sameHoldings && !isExtendedMarketSession() && (!missingPrice || !retryDue)) {
        return previous;
      }
      const etfByTicker = new Map<string, ETF>();
      lastNetworkFetch.current = Date.now();

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

  // Another tab changed the portfolio: refetch here so its edits show up.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === PORTFOLIO_STORAGE_KEY) {
        void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

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

    fetch(`/api/etfs/search?tickers=${encodeURIComponent(tickersKey)}&includeHistory=true&adjusted=true&profiles=true`)
      .then((response) => response.ok ? response.json() : [])
      .then((assets: ETF[]) => {
        if (cancelled || !Array.isArray(assets)) return;
        const detailsByTicker = new Map(
          assets.map((asset) => [normalizeTicker(asset.ticker), asset]),
        );
        queryClient.setQueryData<Portfolio>(PORTFOLIO_QUERY_KEY, (current) => {
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

  // Fund profiles (asset mix, beta, holdings, sectors). The search route
  // leaves these empty for many funds, which made every ETF look identical to
  // the optimizer and left the look-through and Sector X-Ray empty. Only funds
  // still missing them are fetched, once per set.
  const profileKey = (data ?? []).filter(needsFundProfile).map((item) => item.ticker).join(",");
  useEffect(() => {
    if (!profileKey) return;
    let cancelled = false;
    Promise.all(profileKey.split(",").map((ticker) =>
      fetch(`/api/market/etf-details?ticker=${encodeURIComponent(ticker)}`)
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null),
    )).then((funds) => {
      if (cancelled) return;
      const fundByTicker = new Map(
        funds.filter(Boolean).map((fund) => [normalizeTicker(fund.ticker), fund]),
      );
      if (fundByTicker.size === 0) return;
      queryClient.setQueryData<Portfolio>(PORTFOLIO_QUERY_KEY, (current) =>
        current?.map((item) => mergeFundProfile(item, fundByTicker.get(item.ticker))),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [profileKey, queryClient]);

  return query;
};
