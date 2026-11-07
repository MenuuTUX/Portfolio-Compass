import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  getFastDividendHistory,
  getFastEtfDetails,
  enrichEtfDetailsGaps,
  getFastMarketBetas,
} from "@/lib/fast-market";
import { calculateTTMYield } from "@/lib/finance";
import { z } from "zod";
import { isTicker, normalizeTicker } from "@/lib/tickers";
import { jsonError, redditCommunities } from "@/lib/api";
import { NO_STORE } from "@/lib/http-cache";

/**
 * "Sync" a ticker = refresh live market + fund details.
 * This route does not write to a database. The client may cache the response.
 */

const tickerSchema = z.string().refine(isTicker);

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

    const normalizedTicker = normalizeTicker(validation.data.ticker);

    const [quotes, histories, dividendHistory, details, betas] = await Promise.all([
      getFastQuotes([normalizedTicker], { includeProfiles: true, throwOnError: true }),
      getFastHistory([normalizedTicker], "1Y", { adjusted: true }),
      getFastDividendHistory(normalizedTicker),
      getFastEtfDetails(normalizedTicker).then((d) =>
        d ? enrichEtfDetailsGaps(d) : null,
      ),
      getFastMarketBetas([normalizedTicker]),
    ]);
    // Yahoo's fund beta is relative to the category benchmark, not the market,
    // so the payload carries the SPY-relative estimate instead.
    const beta = betas.get(normalizedTicker);

    const q = quotes.get(normalizedTicker);
    if (!q) {
      return NextResponse.json(
        { error: "Ticker not found", deleted: true },
        { status: 404 },
      );
    }

    const history = histories.get(normalizedTicker) || [];
    const calculatedYield = dividendHistory === null
      ? null
      : calculateTTMYield(dividendHistory, q.price, { historyComplete: true })?.toNumber() ?? null;
    const yieldRetrievedAt = new Date().toISOString();

    const formattedEtf = {
      ticker: q.ticker,
      name: q.name,
      price: q.price,
      currency: q.currency,
      quoteAsOf: q.quoteAsOf,
      changePercent: q.changePercent,
      isDeepAnalysisLoaded: Boolean(details),
      history,
      metrics: {
        yield: calculatedYield ?? q.dividendYield ?? null,
        yieldSource: calculatedYield !== null
          ? "Yahoo Finance dividend history (TTM)"
          : q.dividendYield !== undefined ? "Yahoo Finance quote" : null,
        yieldRetrievedAt: calculatedYield !== null
          ? yieldRetrievedAt
          : q.dividendYield !== undefined ? q.retrievedAt ?? null : null,
        yieldSourceField: calculatedYield !== null ? null : q.dividendYieldField ?? null,
        yieldInputUnit: calculatedYield !== null ? null : q.dividendYieldInputUnit ?? null,
        yieldNormalization: calculatedYield !== null
          ? "12-month cash distributions ÷ current share price × 100"
          : q.dividendYieldField === "trailingAnnualDividendYield"
          ? "fraction × 100 to percent"
          : q.dividendYieldField === "dividendYield" ? "already percent" : null,
        yieldMeasurementDate: calculatedYield !== null ? q.quoteAsOf ?? null : null,
        mer: q.expenseRatio ?? details?.expenseRatio ?? null,
        merSource: q.expenseRatio !== undefined
          ? "Yahoo Finance quote"
          : details?.expenseRatioSource ?? null,
        merRetrievedAt: q.expenseRatio !== undefined
          ? q.retrievedAt ?? null
          : details?.expenseRatioRetrievedAt ?? null,
        merSourceField: q.expenseRatio !== undefined
          ? q.expenseRatioField ?? null
          : details?.expenseRatioField ?? null,
        merInputUnit: q.expenseRatio !== undefined
          ? q.expenseRatioInputUnit ?? null
          : details?.expenseRatioInputUnit ?? null,
        merNormalization: q.expenseRatio !== undefined
          ? q.expenseRatioNormalization ?? null
          : details?.expenseRatioNormalization ?? null,
        merMeasurementDate: q.expenseRatio !== undefined
          ? q.expenseRatioMeasurementDate ?? null
          : details?.expenseRatioMeasurementDate ?? null,
        betaSource: beta?.source ?? null,
      },
      ...(beta ? { beta: beta.beta } : {}),
      dividend: q.dividend,
      dividendYield: q.dividendYield,
      allocation: details?.allocation ?? null,
      sectors: details?.sectors || {},
      holdings: (details?.holdings || []).map((h) => ({
        ticker: h.ticker,
        name: h.name,
        weight: h.weight,
      })),
      assetType: q.assetType,
      redditCommunities: redditCommunities(normalizedTicker, q.assetType),
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

    return NextResponse.json(formattedEtf, { headers: NO_STORE });
  } catch (error) {
    return jsonError(500, "Internal Server Error", "Error syncing ETF (live):", error);
  }
}
