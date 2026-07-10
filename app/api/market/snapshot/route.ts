import { NextRequest, NextResponse } from "next/server";
import { getFastQuotes, getFastHistory } from "@/lib/fast-market";

export const maxDuration = 30;

const MAX_TICKERS = 120;

// Batched quotes (+ optional history) for portfolio/trending cards.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tickersParam = searchParams.get("tickers") || "";
  const includeHistory = searchParams.get("history") !== "false";

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TICKERS);

  if (tickers.length === 0) {
    return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
  }

  try {
    const [quotes, histories] = await Promise.all([
      getFastQuotes(tickers),
      includeHistory
        ? getFastHistory(tickers, "1M")
        : Promise.resolve(new Map<string, { date: string; price: number }[]>()),
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
        isDeepAnalysisLoaded: false,
        history: histories.get(ticker) || [],
        metrics: {
          yield: q.dividendYield ?? 0,
          mer: q.expenseRatio ?? 0,
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
    console.error("[API] Snapshot failed:", error);
    return NextResponse.json(
      { error: "Failed to load market snapshot" },
      { status: 502 },
    );
  }
}
