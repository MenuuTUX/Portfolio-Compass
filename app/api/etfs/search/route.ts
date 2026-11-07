import { isTicker } from "@/lib/tickers";
import { cacheUnlessEmpty, CACHE } from "@/lib/http-cache";
import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  getFastDividendHistories,
  getFastEtfDetails,
  getFastMarketBetas,
  searchFastSymbols,
  quoteToAsset,
  type FastQuote,
  type HistoryPoint,
} from "@/lib/fast-market";
import type { DividendHistoryItem } from "@/lib/finance";
import type { AllocationWeights } from "@/lib/asset-class";
import type { BetaEstimate } from "@/lib/math/beta";
import pLimit from "p-limit";
import { TOP_ETFS, TOP_STOCKS } from "@/config/tickers";
import { getRedditCommunities } from "@/config/tickers";

/**
 * Live ETF and stock search with no database.
 * Quotes + history come from Yahoo (via fast-market). Portfolio storage
 * stays in the browser (LocalStorage).
 */

const MAX_TICKERS_PER_REQUEST = 50;
const MAX_RESULTS = 50;

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Whole numbers only ("12abc" and "1.5" are refused); null when out of range. */
function parseCount(value: string | null, fallback: number, min: number, max: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function parseAssetType(value: string | null): "STOCK" | "ETF" | undefined {
  return value === "STOCK" || value === "ETF" ? value : undefined;
}

interface PortfolioInputs {
  beta?: BetaEstimate;
  allocation?: AllocationWeights | null;
}

function formatAsset(
  q: FastQuote,
  history: HistoryPoint[] = [],
  dividendHistory: DividendHistoryItem[] | null = null,
  inputs: PortfolioInputs = {},
) {
  const asset = quoteToAsset(q, history, dividendHistory);
  return {
    ...asset,
    ...(inputs.beta ? { beta: inputs.beta.beta } : {}),
    metrics: { ...asset.metrics, betaSource: inputs.beta?.source ?? null },
    allocation: inputs.allocation ?? asset.allocation,
    holdings: [],
    redditCommunities: getRedditCommunities(q.ticker, q.assetType).map((c) => ({
      subreddit: c.name,
      url: c.url,
    })),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("query") || "").trim();
  const assetType = parseAssetType(searchParams.get("type"));
  const tickersParam = searchParams.get("tickers");
  const skip = parseCount(searchParams.get("skip"), 0, 0, 10_000);
  const limit = parseCount(searchParams.get("limit"), MAX_RESULTS, 1, MAX_RESULTS);
  if (skip === null || limit === null) {
    return NextResponse.json(
      { error: "skip must be a whole number from 0 to 10000 and limit from 1 to 50" },
      { status: 400 },
    );
  }
  const isFullHistoryRequested = searchParams.get("full") === "true";
  const includeHistory =
    searchParams.get("includeHistory") === "true" || isFullHistoryRequested;
  const includeProfiles = searchParams.get("profiles") !== "false";
  // Portfolio math needs dividend-adjusted closes; display-only callers skip them
  // because that path fetches each ticker separately instead of one spark call.
  const adjustedHistory = searchParams.get("adjusted") === "true";

  try {
    let tickers: string[] = [];

    if (tickersParam) {
      tickers = tickersParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(isTicker)
        .slice(0, MAX_TICKERS_PER_REQUEST);
    } else if (query) {
      // Free-text / exact ticker search via Yahoo autocomplete
      const symbols = await searchFastSymbols(
        query,
        assetType,
        20,
      );
      // Always try the raw query as a ticker (e.g. "AAPL")
      const asTicker = query
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(isTicker);
      tickers = Array.from(new Set([...asTicker, ...symbols])).slice(0, 20);
    } else {
      // Browse defaults
      const curated =
        assetType === "ETF"
          ? TOP_ETFS
          : assetType === "STOCK"
            ? TOP_STOCKS
            : [...TOP_STOCKS, ...TOP_ETFS];
      tickers = Array.from(new Set(curated)).slice(skip, skip + limit);
    }

    if (tickers.length === 0) {
      if (tickersParam) {
        return NextResponse.json(
          { error: "Ticker(s) not found", tickers: [] },
          { status: 404 },
        );
      }
      return NextResponse.json([]);
    }

    const [quotes, histories] = await Promise.all([
      getFastQuotes(tickers, { includeProfiles }),
      includeHistory
        ? getFastHistory(tickers, isFullHistoryRequested ? "1Y" : "1M", {
            adjusted: isFullHistoryRequested || adjustedHistory,
          })
        : Promise.resolve(new Map<string, HistoryPoint[]>()),
    ]);
    const quotedTickers = [...quotes.keys()];
    // Portfolio callers (adjusted=true) also need the optimizer's inputs: a
    // market beta and the fund's asset mix. Browse and autocomplete skip both.
    const etfTickers = adjustedHistory
      ? quotedTickers.filter((t) => quotes.get(t)?.assetType === "ETF")
      : [];
    const detailLimit = pLimit(4);
    const [dividendHistories, betas, allocations] = await Promise.all([
      getFastDividendHistories(quotedTickers),
      adjustedHistory
        ? getFastMarketBetas(quotedTickers)
        : Promise.resolve(new Map<string, BetaEstimate>()),
      Promise.all(etfTickers.map((t) => detailLimit(async () =>
        [t, (await getFastEtfDetails(t))?.allocation ?? null] as const,
      ))).then((entries) => new Map(entries)),
    ]);

    const assets = [];
    for (const ticker of tickers.map((t) => t.toUpperCase())) {
      const q = quotes.get(ticker);
      if (!q) continue;
      if (assetType && q.assetType !== assetType) continue;
      assets.push(
        formatAsset(q, histories.get(ticker) || [], dividendHistories.get(ticker), {
          beta: betas.get(ticker),
          allocation: allocations.get(ticker),
        }),
      );
    }

    if (tickersParam && assets.length === 0) {
      return NextResponse.json(
        {
          error: "Ticker(s) not found",
          tickers: tickers,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(assets, {
      headers: cacheUnlessEmpty(CACHE.search, assets.length),
    });
  } catch (error) {
    console.error("[API] Error searching ETFs (live):", error);
    return NextResponse.json(
      { error: "Failed to search market data" },
      { status: 502 },
    );
  }
}
