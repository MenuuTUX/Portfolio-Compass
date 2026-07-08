import { NextRequest, NextResponse } from "next/server";
import { getFastEtfDetails } from "@/lib/fast-market";

export const maxDuration = 30;

// Fast, DB-free ETF/fund technicals (expense ratio, sectors, holdings,
// description) for a single ticker. Not batchable like quote()/spark(), but
// still one Yahoo request — no scraping, no sync pipeline, no SQL.
export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get("ticker") || "").trim();

  if (!ticker || !/^[A-Za-z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  try {
    const details = await getFastEtfDetails(ticker);
    if (!details) {
      return NextResponse.json(
        { error: "No details available" },
        { status: 404 },
      );
    }
    return NextResponse.json(details, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[API] ETF details failed:", error);
    return NextResponse.json(
      { error: "Failed to load ETF details" },
      { status: 502 },
    );
  }
}
