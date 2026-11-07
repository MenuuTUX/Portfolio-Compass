import { cacheUnlessEmpty, CACHE } from "@/lib/http-cache";
import { NextRequest, NextResponse } from "next/server";
import { getMarketMovers } from "@/lib/scrapers/stock-analysis";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");

  if (type !== "gainers" && type !== "losers") {
    return NextResponse.json(
      { error: 'Invalid type. Must be "gainers" or "losers"' },
      { status: 400 },
    );
  }

  try {
    const tickers = await getMarketMovers(type);
    // An empty list can mean the provider blocked us; do not keep that.
    return NextResponse.json({ tickers }, { headers: cacheUnlessEmpty(CACHE.movers, tickers.length) });
  } catch (error) {
    console.error("Error fetching market movers:", error);
    return NextResponse.json(
      { error: "Failed to fetch market movers" },
      { status: 502 },
    );
  }
}
