import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  getFastDividendHistories,
  invalidateMarketCache,
  quoteToAsset,
} from "@/lib/fast-market";
import { z } from "zod";
import { jsonError, parseUpperTickers } from "@/lib/api";

export const maxDuration = 30;

const MAX_TICKERS = 80;
const RefreshRequestSchema = z.object({
  tickers: z.array(z.string()).default([]),
});

/** The same ticker is re-fetched from Yahoo at most this often, however many requests ask. */
const MIN_REFRESH_INTERVAL_MS = 10_000;
const lastRefreshed = new Map<string, number>();

/**
 * User-facing market refresh (Settings → Refresh data).
 *
 * This busts the in-memory quote cache for the tickers it is given and returns
 * fresh prices for them. It never clears the whole cache: that was open to any
 * caller and let one request send every other visitor's lookups back to Yahoo.
 * A ticker refreshed in the last few seconds is served from cache instead.
 */
export async function POST(request: NextRequest) {
  try {
    let tickers: string[] = [];
    try {
      const result = RefreshRequestSchema.safeParse(await request.json());
      if (result.success) {
        tickers = parseUpperTickers(result.data.tickers, MAX_TICKERS);
      }
    } catch {
      // No usable body: there is nothing to refresh.
    }

    if (tickers.length === 0) {
      return NextResponse.json({
        message: "Nothing to refresh yet. Add holdings to your portfolio first.",
        count: 0,
        assets: [],
      });
    }

    const now = Date.now();
    const due = tickers.filter((t) => now - (lastRefreshed.get(t) ?? 0) >= MIN_REFRESH_INTERVAL_MS);
    for (const t of due) lastRefreshed.set(t, now);
    if (lastRefreshed.size > 5_000) {
      for (const [t, at] of lastRefreshed) if (now - at >= MIN_REFRESH_INTERVAL_MS) lastRefreshed.delete(t);
    }
    if (due.length > 0) invalidateMarketCache(due);

    // Invalidated tickers miss the cache and are fetched; recently refreshed ones are served from it.
    const [quotes, histories] = await Promise.all([
      getFastQuotes(tickers),
      getFastHistory(tickers, "1M"),
    ]);
    const dividendHistories = await getFastDividendHistories([...quotes.keys()]);

    const assets = [];
    for (const ticker of tickers) {
      const q = quotes.get(ticker);
      if (!q) continue;
      assets.push(quoteToAsset(q, histories.get(ticker) || [], dividendHistories.get(ticker)));
    }

    const recent = tickers.length - due.length;
    return NextResponse.json({
      message:
        `Refreshed ${assets.length} ticker${assets.length === 1 ? "" : "s"}.` +
        (recent > 0 ? ` ${recent} refreshed moments ago were left as they are.` : ""),
      count: assets.length,
      assets,
    });
  } catch (error) {
    return jsonError(502, "Failed to refresh market data", "[API] Market refresh failed:", error);
  }
}
