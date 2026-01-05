import { NextResponse } from "next/server";
import { getMarketRiskState } from "@/lib/sentiment";

export async function GET() {
  try {
    const riskState = await getMarketRiskState();
    return NextResponse.json(riskState);
  } catch (error) {
    console.error("Error fetching market sentiment:", error);
    return NextResponse.json(
      { error: "Failed to fetch market sentiment" },
      { status: 500 },
    );
  }
}
