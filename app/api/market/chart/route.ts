import { NextRequest, NextResponse } from "next/server";
import { getFastCandles, getFastHistory, isChartRange } from "@/lib/fast-market";
import { parseTickers } from "@/lib/tickers";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tickersParam = searchParams.get("tickers") || "";
  const rangeParam = (searchParams.get("range") || "1M").toUpperCase();

  const tickers = parseTickers(tickersParam.split(","), 60);

  if (tickers.length === 0) {
    return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
  }
  if (!isChartRange(rangeParam)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  if (searchParams.get("ohlc") === "1") {
    try {
      const candles = await getFastCandles(tickers[0], rangeParam);
      return NextResponse.json(
        { range: rangeParam, candles },
        {
          headers: {
            "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
          },
        },
      );
    } catch (error) {
      console.error("[API] Candle chart failed:", error);
      return NextResponse.json(
        { error: "Failed to load chart data" },
        { status: 502 },
      );
    }
  }

  try {
    const series = await getFastHistory(tickers, rangeParam);
    const payload: Record<string, { date: string; price: number }[]> = {};
    for (const [ticker, points] of series) payload[ticker] = points;

    return NextResponse.json(
      { range: rangeParam, series: payload },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("[API] Fast chart failed:", error);
    return NextResponse.json(
      { error: "Failed to load chart data" },
      { status: 502 },
    );
  }
}
