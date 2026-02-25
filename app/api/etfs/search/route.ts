import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { fetchMarketSnapshot, MarketSnapshot } from "@/lib/market-service";
import { syncEtfDetails } from "@/lib/etf-sync";
import { Decimal } from "decimal.js";
import pLimit from "p-limit";
import { toPrismaDecimalRequired } from "@/lib/prisma-utils";
import { safeDecimal } from "@/lib/utils";

const MAX_TICKERS_PER_REQUEST = 50;

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow longer execution time for bulk syncs

// Shared rate limiter to prevent DB connection exhaustion
const dbLimit = pLimit(3);

// Helper to create a fallback ETF object from live data
function createFallbackEtf(item: MarketSnapshot) {
  return {
    ticker: item.ticker,
    name: item.name,
    price: item.price,
    daily_change: item.dailyChangePercent,
    assetType: item.assetType || "ETF",
    isDeepAnalysisLoaded: false,
    yield: new Decimal(0),
    mer: new Decimal(0),
    history: [],
    sectors: [],
    allocation: null,
    updatedAt: new Date(),
  };
}

// Helper to upsert ETF with fallback on error
async function upsertEtfWithFallback(
  item: MarketSnapshot,
  includeObj: any,
): Promise<any> {
  try {
    return await prisma.etf.upsert({
      where: { ticker: item.ticker },
      update: {
        price: toPrismaDecimalRequired(item.price),
        daily_change: toPrismaDecimalRequired(item.dailyChangePercent),
        name: item.name,
      },
      create: {
        ticker: item.ticker,
        name: item.name,
        price: toPrismaDecimalRequired(item.price),
        daily_change: toPrismaDecimalRequired(item.dailyChangePercent),
        currency: "USD",
        assetType: item.assetType || "ETF",
        isDeepAnalysisLoaded: false,
      },
      include: includeObj,
    });
  } catch (error: any) {
    const isDbBusy =
      error.toString().includes("MaxClientsInSessionMode") ||
      error.toString().includes("DriverAdapterError");
    if (isDbBusy) {
      console.warn(`[API] DB Busy for ${item.ticker}, using fallback.`);
    } else {
      console.error(`[API] Failed to upsert ${item.ticker}:`, error);
    }
    return createFallbackEtf(item);
  }
}

// Helper to format ETF for response
function formatEtfForResponse(etf: any, isFullHistoryRequested: boolean) {
  let history = etf.history
    ? etf.history.map((h: any) => ({
        date: h.date instanceof Date ? h.date.toISOString() : h.date,
        price: Number(h.close),
        interval:
          h.interval === "daily" || !h.interval ? undefined : h.interval,
      }))
    : [];

  // Downsample history for non-full requests to reduce payload
  if (!isFullHistoryRequested && history.length > 50) {
    const step = Math.ceil(history.length / 30);
    history = history.filter(
      (_: any, index: number) =>
        index % step === 0 || index === history.length - 1,
    );
  }

  return {
    ticker: etf.ticker,
    name: etf.name,
    price: safeDecimal(etf.price),
    changePercent: safeDecimal(etf.daily_change),
    assetType: etf.assetType,
    isDeepAnalysisLoaded: etf.isDeepAnalysisLoaded,
    history,
    metrics: {
      yield: etf.yield ? safeDecimal(etf.yield) : 0,
      mer: etf.mer ? safeDecimal(etf.mer) : 0,
    },
    // Extended Metrics
    marketCap: etf.marketCap ? safeDecimal(etf.marketCap) : undefined,
    sharesOutstanding: etf.sharesOut ? safeDecimal(etf.sharesOut) : undefined,
    eps: etf.eps ? safeDecimal(etf.eps) : undefined,
    revenue: etf.revenue ? safeDecimal(etf.revenue) : undefined,
    netIncome: etf.netIncome ? safeDecimal(etf.netIncome) : undefined,
    dividend: etf.dividend ? safeDecimal(etf.dividend) : undefined,
    dividendYield: etf.yield ? safeDecimal(etf.yield) : undefined,
    exDividendDate: etf.exDividendDate || undefined,
    volume: etf.volume ? safeDecimal(etf.volume) : undefined,
    open: etf.open ? safeDecimal(etf.open) : undefined,
    previousClose: etf.prevClose ? safeDecimal(etf.prevClose) : undefined,
    earningsDate: etf.earningsDate || undefined,
    daysRange: etf.daysRange || undefined,
    fiftyTwoWeekRange: etf.fiftyTwoWeekRange || undefined,
    beta: etf.beta5Y ? safeDecimal(etf.beta5Y) : undefined,
    peRatio: etf.peRatio ? safeDecimal(etf.peRatio) : undefined,
    forwardPe: etf.forwardPe ? safeDecimal(etf.forwardPe) : undefined,
    fiftyTwoWeekHigh: etf.fiftyTwoWeekHigh
      ? safeDecimal(etf.fiftyTwoWeekHigh)
      : undefined,
    fiftyTwoWeekLow: etf.fiftyTwoWeekLow
      ? safeDecimal(etf.fiftyTwoWeekLow)
      : undefined,
    inceptionDate: etf.inceptionDate || undefined,
    payoutFrequency: etf.payoutFrequency || undefined,
    payoutRatio: etf.payoutRatio ? safeDecimal(etf.payoutRatio) : undefined,
    holdingsCount: etf.holdingsCount || undefined,
    bondMaturity: etf.bondMaturity ? safeDecimal(etf.bondMaturity) : undefined,
    bondDuration: etf.bondDuration ? safeDecimal(etf.bondDuration) : undefined,
    allocation: {
      equities: etf.allocation?.stocks_weight
        ? safeDecimal(etf.allocation.stocks_weight)
        : 0,
      bonds: etf.allocation?.bonds_weight
        ? safeDecimal(etf.allocation.bonds_weight)
        : 0,
      cash: etf.allocation?.cash_weight
        ? safeDecimal(etf.allocation.cash_weight)
        : 0,
    },
    sectors: (etf.sectors || []).reduce(
      (acc: { [key: string]: number }, sector: any) => {
        acc[sector.sector_name] = safeDecimal(sector.weight);
        return acc;
      },
      {} as { [key: string]: number },
    ),
    holdings: (etf.holdings || []).map((h: any) => ({
      ticker: h.ticker,
      name: h.name,
      weight: safeDecimal(h.weight),
      sector: h.sector,
      shares: h.shares ? safeDecimal(h.shares) : undefined,
    })),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");
  const assetType = searchParams.get("type");
  const tickersParam = searchParams.get("tickers");
  const limitParam = searchParams.get("limit");
  const skipParam = searchParams.get("skip");
  const isFullHistoryRequested = searchParams.get("full") === "true";
  const includeHistory =
    searchParams.get("includeHistory") === "true" || isFullHistoryRequested;
  const includeHoldings =
    searchParams.get("includeHoldings") === "true" || isFullHistoryRequested;

  try {
    // Build where clause
    const whereClause: any = {};
    let requestedTickers: string[] = [];

    if (tickersParam) {
      requestedTickers = tickersParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0 && /^[A-Z0-9.-]{1,12}$/.test(t))
        .slice(0, MAX_TICKERS_PER_REQUEST); // Limit to prevent abuse

      if (requestedTickers.length > 0) {
        whereClause.ticker = {
          in: requestedTickers,
          mode: "insensitive" as const,
        };
      }
    }

    if (query) {
      whereClause.OR = [
        { ticker: { contains: query, mode: "insensitive" as const } },
        { name: { contains: query, mode: "insensitive" as const } },
      ];
    }

    if (assetType) {
      whereClause.assetType = assetType;
    }

    // Build include object for related data
    const includeObj: any = {
      sectors: true,
      allocation: true,
    };

    if (includeHistory) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      includeObj.history = {
        where: isFullHistoryRequested
          ? undefined
          : { interval: "1d", date: { gte: sixMonthsAgo } },
        orderBy: { date: "asc" },
      };
    }

    if (includeHoldings) {
      includeObj.holdings = { orderBy: { weight: "desc" } };
    }

    // Calculate limits
    const takeLimit = limitParam
      ? parseInt(limitParam, 10)
      : tickersParam
        ? requestedTickers.length
        : isFullHistoryRequested
          ? 1
          : 50;
    const skip = skipParam ? parseInt(skipParam, 10) : 0;

    // Fetch from database
    let etfs: any[] = [];
    try {
      etfs = await prisma.etf.findMany({
        where: whereClause,
        include: includeObj,
        take: takeLimit,
        skip,
        orderBy: { ticker: "asc" },
      });
    } catch (dbError) {
      console.error("[API] DB Read Failed:", dbError);
    }

    // Handle missing tickers when specific tickers were requested
    if (requestedTickers.length > 0) {
      const foundTickers = new Set(
        etfs.map((e: any) => e.ticker.toUpperCase()),
      );
      const missingTickers = requestedTickers.filter(
        (t) => !foundTickers.has(t),
      );

      if (missingTickers.length > 0) {
        try {
          const liveData = await fetchMarketSnapshot(missingTickers);
          const results = await Promise.all(
            liveData.map((item) =>
              dbLimit(() => upsertEtfWithFallback(item, includeObj)),
            ),
          );
          etfs.push(...results);
        } catch (error) {
          console.error("[API] Failed to fetch missing tickers:", error);
        }
      }
    }

    // Default ticker seed when DB is empty
    if (etfs.length === 0 && !query && !tickersParam && skip === 0) {
      const defaultTickers = [
        "SPY",
        "QQQ",
        "IWM",
        "AAPL",
        "MSFT",
        "NVDA",
        "GOOGL",
        "AMZN",
        "META",
        "TSLA",
      ];

      try {
        const liveData = await fetchMarketSnapshot(defaultTickers);
        const results = await Promise.all(
          liveData.map((item) =>
            dbLimit(() => upsertEtfWithFallback(item, includeObj)),
          ),
        );
        etfs.push(...results);
      } catch (error) {
        console.error("[API] Failed to seed default tickers:", error);
      }
    }

    // Background sync for stale data
    if ((query || tickersParam) && etfs.length > 0) {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const staleEtfs = etfs.filter((e: any) => {
        if (!e.isDeepAnalysisLoaded) return true;
        if (!e.updatedAt || e.updatedAt < oneHourAgo) return true;

        if (includeHistory) {
          if (!e.history || e.history.length === 0) return true;

          // Check for insufficient history depth
          if (isFullHistoryRequested) {
            const dailyCount = e.history.filter((h: any) => h.interval === "1d")
              .length;
            if (dailyCount < 200) return true; // Ensure enough data points for Monte Carlo
          }

          const lastHistoryDate = e.history[e.history.length - 1].date;
          if (new Date(lastHistoryDate) < twoDaysAgo) return true;

          if (isFullHistoryRequested) {
            const hasWeekly = e.history.some((h: any) => h.interval === "1wk");
            const hasMonthly = e.history.some((h: any) => h.interval === "1mo");
            if (!hasWeekly || !hasMonthly) return true;
          }
        }
        return false;
      });

      if (staleEtfs.length > 0) {
        // Increase concurrency for full history requests to speed up batch processing
        const concurrency = isFullHistoryRequested ? 5 : 1;
        const syncLimit = pLimit(concurrency);

        // If full history is requested, we likely need to fix multiple items for simulation (e.g. Monte Carlo)
        // so we process all stale items up to the max request limit.
        const maxSyncItems = isFullHistoryRequested
          ? Math.min(staleEtfs.length, MAX_TICKERS_PER_REQUEST)
          : 2;
        const itemsToSync = staleEtfs.slice(0, maxSyncItems);

        if (isFullHistoryRequested) {
          // Blocking sync for full history requests
          await Promise.all(
            itemsToSync.map((staleEtf: any) =>
              syncLimit(async () => {
                try {
                  const synced = await syncEtfDetails(staleEtf.ticker, [
                    "1h",
                    "1d",
                    "1wk",
                    "1mo",
                  ]);
                  if (synced) {
                    const index = etfs.findIndex(
                      (e) => e.ticker === staleEtf.ticker,
                    );
                    if (index !== -1) etfs[index] = synced;
                  }
                } catch (err) {
                  console.error(`[API] Sync failed for ${staleEtf.ticker}:`, err);
                }
              }),
            ),
          );
        } else {
          // Non-blocking background sync
          Promise.all(
            itemsToSync.map((staleEtf: any) =>
              syncLimit(() =>
                syncEtfDetails(staleEtf.ticker, ["1d"]).catch((err) => {
                  console.warn(`[API] Background sync failed for ${staleEtf.ticker}:`, err);
                }),
              ),
            ),
          );
        }
      }
    }

    // Handle query-based fetching for missing tickers (not when tickers param is used)
    if (query && !tickersParam) {
      const rawTargets = query
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0 && !t.includes(" ") && t.length <= 12);

      const loadedTickers = new Set(etfs.map((e: any) => e.ticker.toUpperCase()));
      const missingTargets = rawTargets
        .filter((t) => !loadedTickers.has(t))
        .slice(0, 5);

      if (missingTargets.length > 0) {
        try {
          // Check DB first
          const existingInDb = await prisma.etf.findMany({
            where: { ticker: { in: missingTargets } },
            include: includeObj,
          });

          existingInDb.forEach((e: any) => {
            if (!etfs.find((existing: any) => existing.ticker === e.ticker)) {
              etfs.push(e);
            }
          });

          // Sync remaining missing
          const stillMissing = missingTargets.filter(
            (t) => !etfs.find((e: any) => e.ticker.toUpperCase() === t),
          );

          if (stillMissing.length > 0) {
            const syncLimit = pLimit(1);
            await Promise.all(
              stillMissing.map((ticker) =>
                syncLimit(async () => {
                  try {
                    const synced = await syncEtfDetails(ticker);
                    if (synced) etfs.push(synced);
                  } catch (err) {
                    console.error(`[API] Sync failed for ${ticker}:`, err);
                  }
                }),
              ),
            );

            // Final fallback to live snapshot
            const finalMissing = stillMissing.filter(
              (t) => !etfs.find((e: any) => e.ticker.toUpperCase() === t),
            );

            if (finalMissing.length > 0) {
              const liveData = await fetchMarketSnapshot(finalMissing);
              const results = await Promise.all(
                liveData.map((item) =>
                  dbLimit(() => upsertEtfWithFallback(item, includeObj)),
                ),
              );
              etfs.push(...results);
            }
          }
        } catch (error) {
          console.error("[API] Fallback strategy failed:", error);
        }
      }
    }

    // Format and return response
    const formattedEtfs = etfs.map((etf) =>
      formatEtfForResponse(etf, isFullHistoryRequested),
    );

    return NextResponse.json(formattedEtfs);
  } catch (error) {
    console.error("[API] Error searching ETFs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
