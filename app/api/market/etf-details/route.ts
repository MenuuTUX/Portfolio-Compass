import { cacheHeaders, CACHE } from "@/lib/http-cache";
import { NextRequest, NextResponse } from "next/server";
import { isTicker } from "@/lib/tickers";
import {
  getFastEtfDetails,
  enrichEtfDetailsGaps,
} from "@/lib/fast-market";

export const maxDuration = 30;

/**
 * Fund technicals for the details drawer.
 * 1) Yahoo quoteSummary (fast; bonds → credit ratings / allocation)
 * 2) Gap-fill via stockanalysis for US + CA when MER/holdings/desc missing
 */
export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get("ticker") || "").trim();

  if (!ticker || !isTicker(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  try {
    const yahoo = await getFastEtfDetails(ticker);
    if (!yahoo) {
      return NextResponse.json(
        { error: "No details available" },
        { status: 404 },
      );
    }

    const details = await enrichEtfDetailsGaps(yahoo);

    return NextResponse.json(details, {
      headers: cacheHeaders(CACHE.etfDetails),
    });
  } catch (error) {
    console.error("[API] ETF details failed:", error);
    return NextResponse.json(
      { error: "Failed to load ETF details" },
      { status: 502 },
    );
  }
}
