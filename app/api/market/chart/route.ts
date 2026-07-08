import { NextRequest, NextResponse } from "next/server";
import { getFastHistory, isChartRange } from "@/lib/fast-market";

export const maxDuration = 30;

// Fast, DB-free price history. One upstream request for any number of
// tickers via Yahoo's spark endpoint; responses are memory-cached so
// repeated chart opens are effectively instant.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tickersParam = searchParams.get("tickers") || "";
  const rangeParam = (searchParams.get("range") || "1M").toUpperCase();

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (tickers.length === 0) {
    return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
  }
  if (!isChartRange(rangeParam)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
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
