import { cacheUnlessEmpty, CACHE } from "@/lib/http-cache";
import { NextRequest, NextResponse } from "next/server";
import { getFastQuotes, getFastHistory, getFastDividendHistories, quoteToAsset } from "@/lib/fast-market";
import { jsonError, parseUpperTickers } from "@/lib/api";

export const maxDuration = 30;

const MAX_TICKERS = 120;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tickersParam = searchParams.get("tickers") || "";
  const includeHistory = searchParams.get("history") !== "false";

  const tickers = parseUpperTickers(tickersParam.split(","), MAX_TICKERS);

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
    for (const ticker of tickers) {
      const q = quotes.get(ticker);
      if (!q) continue;

      assets.push(quoteToAsset(q, histories.get(ticker) || [], dividendHistories.get(ticker)));
    }

    return NextResponse.json(assets, {
      headers: cacheUnlessEmpty(CACHE.quotes, assets.length),
    });
  } catch (error) {
    return jsonError(502, "Failed to load market snapshot", "[API] Snapshot failed:", error);
  }
}
