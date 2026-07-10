import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  getFastEtfDetails,
  enrichEtfDetailsGaps,
} from "@/lib/fast-market";
import { getRedditCommunities } from "@/config/tickers";
import { z } from "zod";

/**
 * "Sync" a ticker = refresh live market + fund details.
 * No database write — response is for the client to cache if it wants.
 */

const tickerSchema = z.string().min(1).max(12).regex(/^[A-Z0-9.-]+$/i);

const syncRequestSchema = z.object({
  ticker: tickerSchema,
});

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const validation = syncRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid ticker format" },
        { status: 400 },
      );
    }

    const normalizedTicker = validation.data.ticker.toUpperCase();

    const [quotes, histories, details] = await Promise.all([
      getFastQuotes([normalizedTicker], { includeProfiles: true }),
      getFastHistory([normalizedTicker], "1Y"),
      getFastEtfDetails(normalizedTicker).then((d) =>
        d ? enrichEtfDetailsGaps(d) : null,
      ),
    ]);

    const q = quotes.get(normalizedTicker);
    if (!q) {
      return NextResponse.json(
        { error: "Ticker not found", deleted: true },
        { status: 404 },
      );
    }

    const history = histories.get(normalizedTicker) || [];
    const communities = getRedditCommunities(
      normalizedTicker,
      q.assetType,
    ).map((c) => ({
      subreddit: c.name,
      url: c.url,
    }));

    const formattedEtf = {
      ticker: q.ticker,
      name: q.name,
      price: q.price,
      changePercent: q.changePercent,
      isDeepAnalysisLoaded: Boolean(details),
      history,
      metrics: {
        yield: q.dividendYield ?? details?.expenseRatio ?? 0,
        mer: q.expenseRatio ?? details?.expenseRatio ?? 0,
      },
      dividend: q.dividend,
      dividendYield: q.dividendYield,
      allocation: details?.allocation || { equities: 0, bonds: 0, cash: 0 },
      sectors: details?.sectors || {},
      holdings: (details?.holdings || []).map((h) => ({
        ticker: h.ticker,
        name: h.name,
        weight: h.weight,
      })),
      assetType: q.assetType,
      redditCommunities: communities,
      fundClass: details?.fundClass,
      category: details?.category,
      family: details?.family,
      bondMaturity: details?.bondMaturity,
      bondDuration: details?.bondDuration,
      creditQuality: details?.creditQuality,
      marketCap: q.marketCap,
      volume: q.volume,
      peRatio: q.peRatio,
      sector: q.sector,
      industry: q.industry,
    };

    return NextResponse.json(formattedEtf, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Error syncing ETF (live):", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
