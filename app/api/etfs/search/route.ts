import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { fetchMarketSnapshot } from "@/lib/market-service";
import { syncEtfDetails } from "@/lib/etf-sync";
import { Decimal } from "decimal.js";
import pLimit from "p-limit";
import { toPrismaDecimalRequired } from "@/lib/prisma-utils";
import { safeDecimal } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
    const whereClause: any = {};

    let requestedTickers: string[] = [];
    if (tickersParam) {
      requestedTickers = tickersParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0);

      // Limit max tickers per request
      if (requestedTickers.length > 50) {
        requestedTickers = requestedTickers.slice(0, 50);
      }

      requestedTickers = requestedTickers.filter((t) => {
        return /^[A-Z0-9.-]{1,12}$/.test(t);
      });

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
          : {
              interval: "1d",
              date: { gte: sixMonthsAgo },
            },
        orderBy: { date: "asc" },
      };
    }
    if (includeHoldings) {
      includeObj.holdings = { orderBy: { weight: "desc" } };
    }

    let takeLimit = isFullHistoryRequested ? 1 : query ? 50 : 50;
    if (limitParam) {
      takeLimit = parseInt(limitParam, 10);
    } else if (tickersParam) {
      takeLimit = requestedTickers.length;
    }

    const skip = skipParam ? parseInt(skipParam, 10) : 0;

    let etfs: any[] = [];
    try {
      etfs = await prisma.etf.findMany({
        where: whereClause,
        include: includeObj,
        take: takeLimit,
        skip: skip,
        orderBy: { ticker: "asc" },
      });
    } catch (dbError) {
      console.error("[API] DB Read Failed:", dbError);
      etfs = [];
    }

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
          const limit = pLimit(1);

          const upsertPromises = liveData.map((item) =>
            limit(async () => {
              try {
                return await prisma.etf.upsert({
                  where: { ticker: item.ticker },
                  update: {
                    price: toPrismaDecimalRequired(item.price),
                    daily_change: toPrismaDecimalRequired(
                      item.dailyChangePercent,
                    ),
                    name: item.name,
                  },
                  create: {
                    ticker: item.ticker,
                    name: item.name,
                    price: toPrismaDecimalRequired(item.price),
                    daily_change: toPrismaDecimalRequired(
                      item.dailyChangePercent,
                    ),
                    currency: "USD",
                    assetType: item.assetType || "ETF",
                    isDeepAnalysisLoaded: false,
                  },
                  include: includeObj,
                });
              } catch (createError: any) {
                if (
                  createError.toString().includes("MaxClientsInSessionMode") ||
                  createError.toString().includes("DriverAdapterError")
                ) {
                  console.warn(
                    `[API] DB Busy (upsert) for ${item.ticker}, using live data fallback.`,
                  );
                } else {
                  console.error(
                    `[API] Failed to upsert ETF ${item.ticker}:`,
                    createError,
                  );
                }

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
            }),
          );

          const results = await Promise.all(upsertPromises);
          etfs.push(...(results as any[]));
        } catch (liveFetchError) {
          console.error(
            "[API] Failed to fetch missing tickers live:",
            liveFetchError,
          );
        }
      }
    }

    // Default ticker seed fallback logic
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
        const limit = pLimit(1);

        const seedPromises = liveData.map((item) =>
          limit(async () => {
            try {
              return await prisma.etf.upsert({
                where: { ticker: item.ticker },
                update: {
                  price: toPrismaDecimalRequired(item.price),
                  daily_change: toPrismaDecimalRequired(
                    item.dailyChangePercent,
                  ),
                  name: item.name,
                },
                create: {
                  ticker: item.ticker,
                  name: item.name,
                  price: toPrismaDecimalRequired(item.price),
                  daily_change: toPrismaDecimalRequired(
                    item.dailyChangePercent,
                  ),
                  currency: "USD",
                  assetType: item.assetType || "ETF",
                  isDeepAnalysisLoaded: false,
                },
                include: includeObj,
              });
            } catch (e) {
              console.error(`[API] Failed to auto-seed ${item.ticker}:`, e);
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
          }),
        );

        const seededEtfs = await Promise.all(seedPromises);
        etfs.push(...(seededEtfs as any[]));
      } catch (e) {
        console.error("[API] Failed to fetch default tickers:", e);
      }
    }

    if ((query || tickersParam) && etfs.length > 0) {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const staleEtfs = etfs.filter((e: any) => {
        if (e.isDeepAnalysisLoaded === false) return true;

        if (!e.updatedAt) return true;
        if (e.updatedAt < oneHourAgo) return true;

        if (includeHistory) {
          if (e.history && e.history.length > 0) {
            const lastHistoryDate = e.history[e.history.length - 1].date;
            if (new Date(lastHistoryDate) < twoDaysAgo) return true;

            if (isFullHistoryRequested) {
              const hasWeekly = e.history.some(
                (h: any) => h.interval === "1wk",
              );
              const hasMonthly = e.history.some(
                (h: any) => h.interval === "1mo",
              );
              if (!hasWeekly || !hasMonthly) {
                return true;
              }
            }
          } else {
            return true;
          }
        }

        return false;
      });

      if (staleEtfs.length > 0) {
        const limit = pLimit(1);

        if (isFullHistoryRequested) {
          const maxSyncItems = 1;
          const itemsToSync = staleEtfs.slice(0, maxSyncItems);

          await Promise.all(
            itemsToSync.map((staleEtf: any) =>
              limit(async () => {
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
                    if (index !== -1) {
                      etfs[index] = synced;
                    }
                  }
                } catch (err) {
                  console.error(
                    `[API] Blocking sync failed for ${staleEtf.ticker}:`,
                    err,
                  );
                }
              }),
            ),
          );
        } else {
          const maxBackgroundSyncs = 2;
          const itemsToSync = staleEtfs.slice(0, maxBackgroundSyncs);

          if (itemsToSync.length > 0) {
            Promise.all(
              itemsToSync.map((staleEtf: any) =>
                limit(() =>
                  syncEtfDetails(staleEtf.ticker, ["1d"]).catch((err) => {
                    if (
                      err.toString().includes("MaxClientsInSessionMode") ||
                      err.toString().includes("DriverAdapterError")
                    ) {
                      console.warn(
                        `[API] DB Busy (sync) for ${staleEtf.ticker}, skipping sync.`,
                      );
                    } else {
                      console.error(
                        `[API] Background sync failed for ${staleEtf.ticker}:`,
                        err,
                      );
                    }
                  }),
                ),
              ),
            );
          }
        }
      }
    }

    const rawTargets = query
      ? query
          .split(",")
          .map((t) => t.trim().toUpperCase())
          .filter((t) => t.length > 0)
      : [];
    if (tickersParam) {
      requestedTickers.forEach((t) => rawTargets.push(t));
    }

    const uniqueTargets = Array.from(new Set(rawTargets));
    const loadedTickers = new Set(etfs.map((e: any) => e.ticker));
    let targetsToFetch = uniqueTargets.filter((t) => !loadedTickers.has(t));

    if (etfs.length > 0) {
      targetsToFetch = targetsToFetch.filter(
        (t) => !t.includes(" ") && t.length <= 12,
      );
    }

    const limitedTargets = targetsToFetch.slice(0, 5);

    if (limitedTargets.length > 0 && !tickersParam) {
      const limit = pLimit(1);

      {
        try {
          let existingInDb: any[] = [];
          try {
            existingInDb = await prisma.etf.findMany({
              where: { ticker: { in: limitedTargets } },
              include: includeObj,
            });
          } catch (e) {
            console.error("[API] Fallback DB read failed", e);
          }

          existingInDb.forEach((e: any) => {
            if (!etfs.find((existing: any) => existing.ticker === e.ticker)) {
              etfs.push(e);
            }
          });

          const foundTickerSet = new Set(etfs.map((e: any) => e.ticker));
          const missingTargets = limitedTargets.filter(
            (t) => !foundTickerSet.has(t),
          );

          if (missingTargets.length > 0) {
            await Promise.all(
              missingTargets.map((ticker) =>
                limit(async () => {
                  try {
                    const synced = await syncEtfDetails(ticker);
                    if (synced) {
                      etfs.push(synced as any);
                    }
                  } catch (err) {
                    console.error(`[API] Sync failed for ${ticker}`, err);
                  }
                }),
              ),
            );

            const foundAfterSync = new Set(etfs.map((e: any) => e.ticker));
            const stillMissing = limitedTargets.filter(
              (t) => !foundAfterSync.has(t),
            );

            if (stillMissing.length > 0) {
              try {
                const liveData = await fetchMarketSnapshot(stillMissing);

                const snapshotPromises = liveData.map((item) =>
                  limit(async () => {
                    try {
                      return await prisma.etf.upsert({
                        where: { ticker: item.ticker },
                        update: {
                          price: toPrismaDecimalRequired(item.price),
                          daily_change: toPrismaDecimalRequired(
                            item.dailyChangePercent,
                          ),
                        },
                        create: {
                          ticker: item.ticker,
                          name: item.name,
                          price: toPrismaDecimalRequired(item.price),
                          daily_change: toPrismaDecimalRequired(
                            item.dailyChangePercent,
                          ),
                          currency: "USD",
                          assetType: item.assetType || "ETF",
                          isDeepAnalysisLoaded: false,
                        },
                        include: includeObj,
                      });
                    } catch (createErr) {
                      console.error(
                        `[API] Failed to create snapshot ETF ${item.ticker}`,
                        createErr,
                      );
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
                  }),
                );

                const snapshotEtfs = await Promise.all(snapshotPromises);
                etfs.push(...(snapshotEtfs as any[]));
              } catch (snapshotErr) {
                console.error("[API] Snapshot fallback failed", snapshotErr);
              }
            }
          }
        } catch (fallbackError) {
          console.error("[API] Fallback strategy failed:", fallbackError);
        }
      }
    }

    const formattedEtfs = etfs.map((etf: any) => {
      let history = etf.history
        ? etf.history.map((h: any) => ({
            date: h.date instanceof Date ? h.date.toISOString() : h.date,
            price: Number(h.close),
            interval:
              h.interval === "daily" || !h.interval ? undefined : h.interval,
          }))
        : [];

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
        history: history,
        metrics: {
          yield: etf.yield ? safeDecimal(etf.yield) : 0,
          mer: etf.mer ? safeDecimal(etf.mer) : 0,
        },
        // Extended Metrics
        marketCap: etf.marketCap ? safeDecimal(etf.marketCap) : undefined,
        sharesOutstanding: etf.sharesOut
          ? safeDecimal(etf.sharesOut)
          : undefined,
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
        bondMaturity: etf.bondMaturity
          ? safeDecimal(etf.bondMaturity)
          : undefined,
        bondDuration: etf.bondDuration
          ? safeDecimal(etf.bondDuration)
          : undefined,

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
    });

    return NextResponse.json(formattedEtfs);
  } catch (error) {
    console.error("[API] Error searching ETFs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
