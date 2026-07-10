import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Bulk server sync is disabled — Portfolio Compass is local-first.
 * Clients refresh tickers on demand via /api/etfs/sync and /api/market/*.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Bulk sync disabled",
      message:
        "No server database. Portfolio data lives in the browser; market data is fetched live.",
      localFirst: true,
    },
    { status: 501 },
  );
}

export async function GET() {
  return POST();
}
