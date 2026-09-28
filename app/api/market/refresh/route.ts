import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  invalidateMarketCache,
  quoteToAsset,
} from "@/lib/fast-market";
import { z } from "zod";

export const maxDuration = 30;

const MAX_TICKERS = 80;
const RefreshRequestSchema = z.object({
  tickers: z.array(z.string()).default([]),
});

/**
 * User-facing market refresh (Settings → Refresh data).
 *
 * Unlike /api/etfs/sync/all (cron-only, CRON_SECRET, deep DB hydrate), this
 * busts the in-memory quote cache and returns fresh prices for the tickers
 * used by the portfolio and visible market cards.
 */
export async function POST(request: NextRequest) {
  try {
    let tickers: string[] = [];
    try {
      const result = RefreshRequestSchema.safeParse(await request.json());
      if (result.success) {
        tickers = result.data.tickers
          .map((ticker) => ticker.trim())
          .filter(Boolean)
          .slice(0, MAX_TICKERS);
      }
    } catch {
      // An empty body clears the full cache without returning a snapshot.
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
      getFastQuotes(tickers, { bypassCache: true }),
      getFastHistory(tickers, "1M"),
    ]);

    const assets = [];
    for (const ticker of tickers.map((t) => t.toUpperCase())) {
      const q = quotes.get(ticker);
      if (!q) continue;
      assets.push(quoteToAsset(q, histories.get(ticker) || []));
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
