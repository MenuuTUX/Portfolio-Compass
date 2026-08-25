import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  searchFastSymbols,
  type FastQuote,
  type HistoryPoint,
} from "@/lib/fast-market";
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

function parseAssetType(value: string | null): "STOCK" | "ETF" | undefined {
  return value === "STOCK" || value === "ETF" ? value : undefined;
}

function formatAsset(
  q: FastQuote,
  history: HistoryPoint[] = [],
) {
  const communities = getRedditCommunities(q.ticker, q.assetType).map((c) => ({
    subreddit: c.name,
    url: c.url,
  }));

  return {
    ticker: q.ticker,
    name: q.name,
    price: q.price,
    changePercent: q.changePercent,
    assetType: q.assetType,
    isDeepAnalysisLoaded: false,
    history,
    metrics: {
      yield: q.dividendYield ?? 0,
      mer: q.expenseRatio ?? 0,
    },
    allocation: { equities: 0, bonds: 0, cash: 0 },
    sectors: {},
    holdings: [],
    marketCap: q.marketCap,
    volume: q.volume,
    peRatio: q.peRatio,
    forwardPe: q.forwardPe,
    eps: q.eps,
    dividend: q.dividend,
    dividendYield: q.dividendYield,
    open: q.open,
    previousClose: q.previousClose,
    daysRange: q.daysRange,
    fiftyTwoWeekRange: q.fiftyTwoWeekRange,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    earningsDate: q.earningsDate,
    sharesOutstanding: q.sharesOutstanding,
    sector: q.sector,
    industry: q.industry,
    redditCommunities: communities,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("query") || "").trim();
  const assetType = parseAssetType(searchParams.get("type"));
  const tickersParam = searchParams.get("tickers");
  const limitParam = searchParams.get("limit");
  const skipParam = searchParams.get("skip");
  const isFullHistoryRequested = searchParams.get("full") === "true";
  const includeHistory =
    searchParams.get("includeHistory") === "true" || isFullHistoryRequested;

  try {
    let tickers: string[] = [];

    if (tickersParam) {
      tickers = tickersParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0 && /^[A-Z0-9.-]{1,12}$/.test(t))
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
        .filter((t) => /^[A-Z0-9.-]{1,12}$/.test(t) && !t.includes(" "));
      tickers = Array.from(new Set([...asTicker, ...symbols])).slice(0, 20);
    } else {
      // Browse defaults
      const curated =
        assetType === "ETF"
          ? TOP_ETFS
          : assetType === "STOCK"
            ? TOP_STOCKS
            : [...TOP_STOCKS, ...TOP_ETFS];
      const skip = Math.max(0, parseInt(skipParam || "0", 10) || 0);
      const limit = Math.min(
        MAX_RESULTS,
        Math.max(1, parseInt(limitParam || "50", 10) || 50),
      );
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
      getFastQuotes(tickers, { includeProfiles: true }),
      includeHistory
        ? getFastHistory(tickers, isFullHistoryRequested ? "1Y" : "1M")
        : Promise.resolve(new Map<string, HistoryPoint[]>()),
    ]);

    const assets = [];
    for (const ticker of tickers.map((t) => t.toUpperCase())) {
      const q = quotes.get(ticker);
      if (!q) continue;
      if (assetType && q.assetType !== assetType) continue;
      assets.push(
        formatAsset(q, histories.get(ticker) || []),
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
      headers: {
        "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[API] Error searching ETFs (live):", error);
    return NextResponse.json(
      { error: "Failed to search market data" },
      { status: 502 },
    );
  }
}
