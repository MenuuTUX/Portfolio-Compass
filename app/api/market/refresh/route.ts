import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  invalidateMarketCache,
} from "@/lib/fast-market";

export const maxDuration = 30;

const MAX_TICKERS = 80;

/**
 * User-facing market refresh (Settings → Refresh data).
 *
 * Unlike /api/etfs/sync/all (cron-only, CRON_SECRET, deep DB hydrate), this
 * busts the in-memory quote cache and returns fresh prices for the tickers
 * the client cares about — portfolio + on-screen market cards.
 */
export async function POST(request: NextRequest) {
  try {
    let tickers: string[] = [];
    try {
      const body = await request.json();
      if (Array.isArray(body?.tickers)) {
        tickers = body.tickers
          .map((t: unknown) => String(t || "").trim())
          .filter(Boolean)
          .slice(0, MAX_TICKERS);
      }
    } catch {
      // empty body is fine — full cache bust + no snapshot
    }

    if (tickers.length === 0) {
      invalidateMarketCache();
      return NextResponse.json({
        message: "Market cache cleared. Open a tab to load fresh quotes.",
        count: 0,
        assets: [],
      });
    }

    invalidateMarketCache(tickers);

    const [quotes, histories] = await Promise.all([
      getFastQuotes(tickers, { bypassCache: true, includeProfiles: true }),
      getFastHistory(tickers, "1M"),
    ]);

    const assets = [];
    for (const ticker of tickers.map((t) => t.toUpperCase())) {
      const q = quotes.get(ticker);
      if (!q) continue;
      assets.push({
        ticker: q.ticker,
        name: q.name,
        price: q.price,
        changePercent: q.changePercent,
        assetType: q.assetType,
        history: histories.get(ticker) || [],
        metrics: {
          yield: q.dividendYield ?? 0,
          mer: q.expenseRatio ?? 0,
        },
        allocation: { equities: 0, bonds: 0, cash: 0 },
        sector: q.sector,
        industry: q.industry,
        marketCap: q.marketCap,
        volume: q.volume,
        peRatio: q.peRatio,
        dividendYield: q.dividendYield,
      });
    }

    return NextResponse.json({
      message: `Refreshed ${assets.length} ticker${assets.length === 1 ? "" : "s"}.`,
      count: assets.length,
      assets,
    });
  } catch (error) {
    console.error("[API] Market refresh failed:", error);
    return NextResponse.json(
      { error: "Failed to refresh market data" },
      { status: 502 },
    );
  }
}
