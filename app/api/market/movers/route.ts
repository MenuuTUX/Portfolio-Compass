import { NextRequest, NextResponse } from "next/server";
import { getMarketMovers } from "@/lib/scrapers/stock-analysis";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") as "gainers" | "losers";

  if (type !== "gainers" && type !== "losers") {
    return NextResponse.json(
      { error: 'Invalid type. Must be "gainers" or "losers"' },
      { status: 400 },
    );
  }

  try {
    const tickers = await getMarketMovers(type);
    return NextResponse.json({ tickers });
  } catch (error) {
    console.error("Error fetching market movers:", error);
    return NextResponse.json(
      { error: "Failed to fetch market movers" },
      { status: 500 },
    );
  }
}
