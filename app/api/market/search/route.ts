import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  getFastDividendHistories,
  searchFastSymbols,
  quoteToAsset,
} from "@/lib/fast-market";
import { TOP_ETFS, TOP_STOCKS } from "@/config/tickers";
import { toYahooSymbol } from "@/lib/tickers";

export const maxDuration = 30;

const MAX_RESULTS = 100;

function parseAssetType(value: string | null): "STOCK" | "ETF" | undefined {
  return value === "STOCK" || value === "ETF" ? value : undefined;
}

// Browse/search for the market grid and comparison modal.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("query") || "").trim();
  const assetType = parseAssetType(searchParams.get("type"));
  const includeHistory = searchParams.get("history") !== "false";
  const includeProfiles = searchParams.get("profiles") !== "false";
  const skip = Math.max(0, parseInt(searchParams.get("skip") || "0", 10) || 0);
  const limit = Math.min(
    MAX_RESULTS,
    Math.max(1, parseInt(searchParams.get("limit") || "24", 10) || 24),
  );

  try {
    let tickers: string[];
    // Set when the query was tried as a ticker first; if Yahoo has no such
    // ticker, the same text is searched by name ("apple", "vanguard").
    let triedAsTicker = false;

    if (query) {
      const exactTicker = toYahooSymbol(query);
      // US tickers have at most 5 letters, so a longer all-letter word is a name.
      const isTicker =
        /^[A-Z0-9.^=-]{1,12}$/.test(exactTicker) && !/^[A-Z]{6,}$/.test(exactTicker);
      triedAsTicker = isTicker;
      tickers = isTicker
        ? [exactTicker]
        : await searchFastSymbols(query, assetType, 20);
    } else {
      const curated =
        assetType === "ETF"
          ? TOP_ETFS
          : assetType === "STOCK"
            ? TOP_STOCKS
            : [...TOP_STOCKS, ...TOP_ETFS];
      tickers = Array.from(new Set(curated)).slice(skip, skip + limit);
    }

    const load = (symbols: string[]) =>
      Promise.all([
        getFastQuotes(symbols, { includeProfiles }),
        includeHistory
          ? getFastHistory(symbols, "1M")
          : Promise.resolve(new Map<string, { date: string; price: number }[]>()),
      ]);

    let [quotes, histories] = await load(tickers);
    if (triedAsTicker && quotes.size === 0 && /^[A-Z]+$/i.test(query)) {
      tickers = await searchFastSymbols(query, assetType, 20);
      if (tickers.length > 0) [quotes, histories] = await load(tickers);
    }
    const dividendHistories = await getFastDividendHistories([...quotes.keys()]);

    const assets = [];
    for (const ticker of tickers.map((t) => t.toUpperCase())) {
      const q = quotes.get(ticker);
      if (!q) continue;
      if (assetType && q.assetType !== assetType) continue;

      assets.push(quoteToAsset(q, histories.get(ticker) || [], dividendHistories.get(ticker)));
    }

    return NextResponse.json(assets, {
      headers: {
        "Cache-Control": "public, max-age=5, stale-while-revalidate=15",
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
