import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Cron database sync is disabled. There is no server-side ETF cache.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      skipped: true,
      message:
        "No server database to sync. Market data is live; portfolios are client-local.",
      localFirst: true,
    },
    { status: 200 },
  );
}

export async function POST() {
  return GET();
}
