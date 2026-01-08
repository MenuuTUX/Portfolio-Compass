import { NextRequest, NextResponse } from "next/server";
import { getStockProfile } from "@/lib/scrapers/stock-analysis";
import { getEtfDescription } from "@/lib/scrapers/etf-dot-com";
import { isValidTicker } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  const type = searchParams.get("type") || "STOCK"; // 'STOCK' or 'ETF'

  if (!ticker || !isValidTicker(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  try {
    // Primary source: StockAnalysis.com for financial metrics and general profile
    // It provides superior data for both Stocks and ETFs compared to free APIs.
    const profile = await getStockProfile(ticker);

    // For ETFs, ETF.com provides higher quality descriptions than StockAnalysis.
    // If it's an ETF, we attempt to overlay the description from ETF.com.
    if (type === "ETF") {
      const etfDescription = await getEtfDescription(ticker);
      if (etfDescription) {
        profile.description = etfDescription;
      }
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error(`Error fetching info for ${ticker}:`, error);
    // Return a partial/empty profile instead of 500 to prevent UI crashes
    return NextResponse.json({
      sector: "Unknown",
      industry: "Unknown",
      description: "Data unavailable",
    });
  }
}
