import { NextRequest, NextResponse } from "next/server";
import { getFastQuotes, getFastHistory, getFastDividendHistories, quoteToAsset } from "@/lib/fast-market";

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
    const dividendHistories = await getFastDividendHistories([...quotes.keys()]);

    const assets = [];
    for (const ticker of tickers.map((t) => t.toUpperCase())) {
      const q = quotes.get(ticker);
      if (!q) continue;

      assets.push(quoteToAsset(q, histories.get(ticker) || [], dividendHistories.get(ticker)));
    }

    return NextResponse.json(assets, {
      headers: {
        "Cache-Control": "public, max-age=5, stale-while-revalidate=15",
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
