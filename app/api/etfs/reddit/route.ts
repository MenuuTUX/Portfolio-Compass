import { NextRequest, NextResponse } from "next/server";
import { getRedditCommunities } from "@/config/tickers";

export const dynamic = "force-dynamic";

/**
 * Reddit communities for a ticker, sourced only from static configuration.
 * No server DB; nothing is persisted server-side.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get("ticker");
  const assetType = searchParams.get("type") || undefined;

  if (!ticker) {
    return NextResponse.json(
      { error: "Ticker parameter is required" },
      { status: 400 },
    );
  }

  const communities = getRedditCommunities(ticker.toUpperCase(), assetType).map(
    (c) => ({
      subreddit: c.name,
      url: c.url,
    }),
  );

  return NextResponse.json(communities, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

/** Mutations are client-local and do not write to a server. */
export async function POST() {
  return NextResponse.json(
    {
      error: "Reddit communities are config-based (not stored on the server)",
      localFirst: true,
    },
    { status: 501 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: "Reddit communities are config-based (not stored on the server)",
      localFirst: true,
    },
    { status: 501 },
  );
}
