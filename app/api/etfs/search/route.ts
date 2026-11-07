import { jsonError, parseUpperTickers, redditCommunities } from "@/lib/api";
import { cacheUnlessEmpty, CACHE } from "@/lib/http-cache";
import { NextRequest, NextResponse } from "next/server";
import {
  getFastQuotes,
  getFastHistory,
  getFastDividendHistories,
  getFastEtfDetails,
  getFastMarketBetas,
  searchFastSymbols,
  quoteToAsset,
  type FastQuote,
  type HistoryPoint,
} from "@/lib/fast-market";
import type { DividendHistoryItem } from "@/lib/finance";
import type { AllocationWeights } from "@/lib/asset-class";
import type { BetaEstimate } from "@/lib/math/beta";
import pLimit from "p-limit";

/**
 * Live ETF and stock search with no database.
 * Quotes + history come from Yahoo (via fast-market). Portfolio storage
 * stays in the browser (LocalStorage).
 */

const MAX_TICKERS_PER_REQUEST = 50;
const MAX_QUERY_RESULTS = 20;

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface PortfolioInputs {
  beta?: BetaEstimate;
  allocation?: AllocationWeights | null;
}

function formatAsset(
  q: FastQuote,
  history: HistoryPoint[] = [],
  dividendHistory: DividendHistoryItem[] | null = null,
  inputs: PortfolioInputs = {},
) {
  const asset = quoteToAsset(q, history, dividendHistory);
  return {
    ...asset,
    ...(inputs.beta ? { beta: inputs.beta.beta } : {}),
    metrics: { ...asset.metrics, betaSource: inputs.beta?.source ?? null },
    allocation: inputs.allocation ?? asset.allocation,
    holdings: [],
    redditCommunities: redditCommunities(q.ticker, q.assetType),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("query") || "").trim();
  const tickersParam = searchParams.get("tickers");
  const includeHistory = searchParams.get("includeHistory") === "true";
  const includeProfiles = searchParams.get("profiles") !== "false";
  // Portfolio math needs dividend-adjusted closes; display-only callers skip them
  // because that path fetches each ticker separately instead of one spark call.
  const adjustedHistory = searchParams.get("adjusted") === "true";

  try {
    let tickers: string[] = [];

    if (tickersParam) {
      tickers = parseUpperTickers(tickersParam.split(","), MAX_TICKERS_PER_REQUEST);
    } else if (query) {
      const symbols = await searchFastSymbols(query, undefined, MAX_QUERY_RESULTS);
      // Always try the raw query as a ticker (e.g. "AAPL")
      const asTicker = parseUpperTickers(query.split(","), MAX_QUERY_RESULTS);
      tickers = Array.from(new Set([...asTicker, ...symbols])).slice(0, MAX_QUERY_RESULTS);
    }

    if (tickers.length === 0) {
      if (tickersParam) {
        return NextResponse.json(
          { error: "Ticker(s) not found", tickers: [] },
          { status: 404 },
        );
      }
      return NextResponse.json([]);
    }

    const [quotes, histories] = await Promise.all([
      getFastQuotes(tickers, { includeProfiles }),
      includeHistory
        ? getFastHistory(tickers, "1M", { adjusted: adjustedHistory })
        : Promise.resolve(new Map<string, HistoryPoint[]>()),
    ]);
    const quotedTickers = [...quotes.keys()];
    // Portfolio callers (adjusted=true) also need the optimizer's inputs: a
    // market beta and the fund's asset mix. Browse and autocomplete skip both.
    const etfTickers = adjustedHistory
      ? quotedTickers.filter((t) => quotes.get(t)?.assetType === "ETF")
      : [];
    const detailLimit = pLimit(4);
    const [dividendHistories, betas, allocations] = await Promise.all([
      getFastDividendHistories(quotedTickers),
      adjustedHistory
        ? getFastMarketBetas(quotedTickers)
        : Promise.resolve(new Map<string, BetaEstimate>()),
      Promise.all(etfTickers.map((t) => detailLimit(async () =>
        [t, (await getFastEtfDetails(t))?.allocation ?? null] as const,
      ))).then((entries) => new Map(entries)),
    ]);

    const assets = [];
    for (const ticker of tickers.map((t) => t.toUpperCase())) {
      const q = quotes.get(ticker);
      if (!q) continue;
      assets.push(
        formatAsset(q, histories.get(ticker) || [], dividendHistories.get(ticker), {
          beta: betas.get(ticker),
          allocation: allocations.get(ticker),
        }),
      );
    }

    if (tickersParam && assets.length === 0) {
      return NextResponse.json(
        {
          error: "Ticker(s) not found",
          tickers: tickers,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(assets, {
      headers: cacheUnlessEmpty(CACHE.search, assets.length),
    });
  } catch (error) {
    return jsonError(502, "Failed to search market data", "[API] Error searching ETFs (live):", error);
  }
}
