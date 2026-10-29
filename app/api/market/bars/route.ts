import { NextRequest, NextResponse } from "next/server";
import { isAcceptedThrough, lastCompletedSession } from "@/lib/lab/bar-types";
import { getTickerHistory } from "@/lib/lab/bars";
import { parseTickers } from "@/lib/tickers";

export const maxDuration = 30;

// One URL per ticker per day (`?ticker=SPY&through=2026-10-28`), so Vercel's
// CDN serves repeat requests without running this function or calling Yahoo.
// Vercel caches a function response only with s-maxage or a CDN-Cache-Control
// header; plain max-age reaches the browser alone.

const DAY = 86_400;

function cached(browserSeconds: number, cdnSeconds: number): HeadersInit {
  return {
    "Cache-Control": `public, max-age=${browserSeconds}`,
    "Vercel-CDN-Cache-Control": `max-age=${cdnSeconds}, stale-while-revalidate=${DAY}`,
  };
}

const NO_STORE = { "Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const [ticker] = parseTickers([params.get("ticker") ?? ""], 1);
  const through = params.get("through") ?? "";

  if (!ticker) {
    return NextResponse.json({ error: "A valid ticker is required" }, { status: 400, headers: cached(DAY, DAY) });
  }
  if (!isAcceptedThrough(through)) {
    // Only the last two sessions are served, which bounds the cache per ticker. Not cached: the answer changes daily.
    // `expected` lets a client whose clock is off retry with the right key. The server never
    // clamps instead: a clamped answer would be cached under the wrong URL.
    return NextResponse.json(
      { error: "through must be the last completed session", expected: lastCompletedSession() },
      { status: 400, headers: NO_STORE },
    );
  }

  const symbol = ticker.toUpperCase();
  try {
    const series = await getTickerHistory(symbol, through);
    if (!series) {
      // Cache the miss too, so a mistyped ticker does not reach Yahoo on every request.
      return NextResponse.json({ error: `No price history for ${symbol}`, ticker: symbol }, { status: 404, headers: cached(3600, 3600) });
    }
    // A history that reaches `through` will not change today. One that stops short
    // (a holiday, or Yahoo settling late) is rechecked within the hour.
    const complete = series.d[series.d.length - 1] === through;
    return NextResponse.json(series, { headers: complete ? cached(DAY, DAY) : cached(1800, 1800) });
  } catch (error) {
    console.error(`[API] Lab bars failed for ${symbol}:`, error);
    // Never cache an upstream failure: one Yahoo outage would otherwise reach every user.
    return NextResponse.json({ error: "Failed to load price history", ticker: symbol }, { status: 502, headers: NO_STORE });
  }
}
