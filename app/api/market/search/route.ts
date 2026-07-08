import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  searchFastSymbols,
} from "@/lib/fast-market";
import { TOP_ETFS, TOP_STOCKS } from "@/config/tickers";

export const maxDuration = 30;

const MAX_RESULTS = 100;

// Fast, DB-free browse + search for the ETFs/Stocks tab and the comparison
// modal's "search to compare" box. Typed queries resolve via Yahoo's public
// symbol search; an empty query falls back to a curated list of liquid
// tickers so the grid always has something to show on first load.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("query") || "").trim();
  const assetType = searchParams.get("type") as "STOCK" | "ETF" | null;
  const skip = Math.max(0, parseInt(searchParams.get("skip") || "0", 10) || 0);
  const limit = Math.min(
    MAX_RESULTS,
    Math.max(1, parseInt(searchParams.get("limit") || "24", 10) || 24),
  );

  try {
    let tickers: string[];

    if (query) {
      tickers = await searchFastSymbols(query, assetType || undefined, 20);
    } else {
      const curated =
        assetType === "ETF"
          ? TOP_ETFS
          : assetType === "STOCK"
            ? TOP_STOCKS
            : [...TOP_STOCKS, ...TOP_ETFS];
      tickers = Array.from(new Set(curated)).slice(skip, skip + limit);
    }

    // Search results are already capped small; only browse mode paginates
    const pageTickers = query ? tickers : tickers;

    const [quotes, histories] = await Promise.all([
      getFastQuotes(pageTickers),
      getFastHistory(pageTickers, "1M"),
    ]);

    const assets = [];
    for (const ticker of pageTickers.map((t) => t.toUpperCase())) {
      const q = quotes.get(ticker);
      if (!q) continue;
      if (assetType && q.assetType !== assetType) continue;

      assets.push({
        ticker: q.ticker,
        name: q.name,
        price: q.price,
        changePercent: q.changePercent,
        assetType: q.assetType,
        isDeepAnalysisLoaded: false,
        history: histories.get(ticker) || [],
        metrics: {
          yield: q.dividendYield ?? 0,
          mer: 0,
        },
        allocation: { equities: 0, bonds: 0, cash: 0 },
        sectors: {},
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
      });
    }

    return NextResponse.json(assets, {
      headers: {
        "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[API] Fast market search failed:", error);
    return NextResponse.json(
      { error: "Failed to search market data" },
      { status: 502 },
    );
  }
}
