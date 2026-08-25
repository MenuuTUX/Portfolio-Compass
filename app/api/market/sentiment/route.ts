import { NextResponse } from "next/server";
import {
  getMarketRiskState,
  NEUTRAL_MARKET_RISK,
} from "@/lib/sentiment";

export const dynamic = "force-dynamic";

/**
 * Legacy market sentiment endpoint.
 * Always returns 200 with usable defaults if the data source is unavailable.
 * never 500 for connectivity (production Neon tenant can disappear).
 */
export async function GET() {
  try {
    const riskState = await getMarketRiskState();
    return NextResponse.json(riskState, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error fetching market sentiment:", error);
    return NextResponse.json(
      { ...NEUTRAL_MARKET_RISK, degraded: true },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  }
}
