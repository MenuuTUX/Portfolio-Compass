import { NextRequest, NextResponse } from 'next/server'
import { ETF } from '@/types'
import prisma from '@/lib/db'
import { fetchMarketSnapshot } from '@/lib/market-service'
import { syncEtfDetails } from '@/lib/etf-sync'
import { Decimal } from 'decimal.js'
import pLimit from 'p-limit'
import { toPrismaDecimalRequired, toPrismaDecimal } from '@/lib/prisma-utils'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  const assetType = searchParams.get('type')
  const tickersParam = searchParams.get('tickers')
  const limitParam = searchParams.get('limit')
  const skipParam = searchParams.get('skip')
  const isFullHistoryRequested = searchParams.get('full') === 'true';
  // Default to false for performance, client must explicitly request history if needed
  // If full history is requested, we force includeHistory to true
  const includeHistory = searchParams.get('includeHistory') === 'true' || isFullHistoryRequested
  const includeHoldings = searchParams.get('includeHoldings') === 'true' || isFullHistoryRequested;

  try {
    const whereClause: any = {};

    let requestedTickers: string[] = [];
    if (tickersParam) {
        // Parse comma-separated tickers and filter out empty strings
        requestedTickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length > 0);

        // SECURITY: Limit the number of tickers to prevent DoS (e.g. 50 max)
        if (requestedTickers.length > 50) {
            requestedTickers = requestedTickers.slice(0, 50);
            console.warn(`[API] Capped requested tickers to 50 items. Original count: ${tickersParam.split(',').length}`);
        }

        // SECURITY: Validate ticker format (alphanumeric, max length 12)
        // This prevents garbage input or overly long strings from reaching the DB/API
        requestedTickers = requestedTickers.filter(t => {
            const isValid = /^[A-Z0-9.-]{1,12}$/.test(t);
            if (!isValid) {
                console.warn(`[API] Filtered out invalid ticker format: ${t}`);
            }
            return isValid;
        });

        if (requestedTickers.length > 0) {
            // Use 'in' operator to match any of the requested tickers
            whereClause.ticker = { in: requestedTickers, mode: 'insensitive' as const };
        }
    }

    if (query) {
      whereClause.OR = [
        { ticker: { contains: query, mode: 'insensitive' as const } },
        { name: { contains: query, mode: 'insensitive' as const } },
      ];
    }

    if (assetType) {
      whereClause.assetType = assetType;
    }

    // Conditional include object
    const includeObj: any = {
      sectors: true,
      allocation: true,
    };
    if (includeHistory) {
      // Optimization: For list views (not full details), limit history fetch to last 6 months
      // This drastically reduces payload size and DB read time for large result sets
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      includeObj.history = {
          where: isFullHistoryRequested
            ? undefined // Fetch all history for detailed view
            : {
                interval: '1d',
                date: { gte: sixMonthsAgo }
              },
          orderBy: { date: 'asc' }
      };
    }
    if (includeHoldings) {
      includeObj.holdings = { orderBy: { weight: 'desc' } };
    }

    const MAX_LIMIT = 50;
    let takeLimit = isFullHistoryRequested ? 1 : (query ? 50 : 50);
    if (limitParam) {
        takeLimit = Math.min(parseInt(limitParam, 10), MAX_LIMIT);
    } else if (tickersParam) {
        // If specific tickers are requested, allow fetching all of them plus some buffer
        // (Though technically we only need exactly requestedTickers.length)
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
            // Ensure deterministic ordering for pagination
            orderBy: { ticker: 'asc' }
        });
    } catch (dbError) {
        console.error('[API] DB Read Failed:', dbError);
        etfs = [];
    }

    // Handle missing tickers if a specific list was requested via `tickers` param
    // This supports the "batch fetch" usage in usePortfolio
    if (requestedTickers.length > 0) {
        const foundTickers = new Set(etfs.map((e: any) => e.ticker.toUpperCase()));
        const missingTickers = requestedTickers.filter(t => !foundTickers.has(t));

        if (missingTickers.length > 0) {
            console.log(`[API] Missing tickers found: ${missingTickers.join(', ')}. Attempting live fetch...`);
            try {
                const liveData = await fetchMarketSnapshot(missingTickers);

                // Use p-limit to restrict concurrent DB writes
                // Reduced to 1 to prevent connection pool exhaustion (MaxClientsInSessionMode)
                const limit = pLimit(1);

                const upsertPromises = liveData.map((item) => limit(async () => {
                    try {
                        return await prisma.etf.upsert({
                            where: { ticker: item.ticker },
                            update: {
                                price: toPrismaDecimalRequired(item.price),
                                daily_change: toPrismaDecimalRequired(item.dailyChangePercent),
                            // Update name if it's currently the ticker (bad data fix) or just update it to ensure freshness
                            name: item.name,
                            },
                            create: {
                                ticker: item.ticker,
                                name: item.name,
                                // Explicitly convert Decimal to string/number for Prisma compatibility
                                price: toPrismaDecimalRequired(item.price),
                                daily_change: toPrismaDecimalRequired(item.dailyChangePercent),
                                currency: 'USD',
                                assetType: item.assetType || "ETF",
                                isDeepAnalysisLoaded: false,
                            },
                            include: includeObj
                        });
                    } catch (createError: any) {
                         // Downgrade connection errors to warnings
                         if (createError.toString().includes('MaxClientsInSessionMode') || createError.toString().includes('DriverAdapterError')) {
                             console.warn(`[API] DB Busy (upsert) for ${item.ticker}, using live data fallback.`);
                         } else {
                             console.error(`[API] Failed to upsert ETF ${item.ticker}:`, createError);
                         }

                         // Fallback: Use live data directly if DB write fails
                         // Construct an object matching the Prisma Etf shape expected by formattedEtfs
                         return {
                             ticker: item.ticker,
                             name: item.name,
                             price: item.price, // Decimal
                             daily_change: item.dailyChangePercent, // Decimal
                             assetType: item.assetType || "ETF",
                             isDeepAnalysisLoaded: false,
                             yield: new Decimal(0),
                             mer: new Decimal(0),
                             history: [],
                             sectors: [],
                             allocation: null,
                             updatedAt: new Date()
                         };
                    }
                }));

                const results = await Promise.all(upsertPromises);
                etfs.push(...(results as any[]));
            } catch (liveFetchError) {
                console.error('[API] Failed to fetch missing tickers live:', liveFetchError);
            }
        }
    }

    // Fallback for empty DB on general search (landing page scenario)
    // Only run this on the first page (skip === 0)
    if (etfs.length === 0 && !query && !tickersParam && skip === 0) {
        let defaultTickers = ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];

        console.log(`[API] Empty DB detected for general search (${assetType || 'General'}). Seeding default tickers...`);

        try {
            const liveData = await fetchMarketSnapshot(defaultTickers);
            const limit = pLimit(1); // Serial execution to save connections

            const seedPromises = liveData.map((item) => limit(async () => {
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
                            currency: 'USD',
                            assetType: item.assetType || "ETF",
                            isDeepAnalysisLoaded: false,
                        },
                        include: includeObj
                    });
                } catch (e) {
                    console.error(`[API] Failed to auto-seed ${item.ticker}:`, e);
                     // Fallback: Use live data directly if DB write fails
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
                         updatedAt: new Date()
                     };
                }
            }));

            const seededEtfs = await Promise.all(seedPromises);
            etfs.push(...(seededEtfs as any[]));
        } catch (e) {
            console.error('[API] Failed to fetch default tickers:', e);
        }
    }

    if ((query || tickersParam) && etfs.length > 0) {
      // Staleness check logic
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const staleEtfs = etfs.filter((e: any) => {
        // If deep analysis is not loaded, it's stale by definition
        if (e.isDeepAnalysisLoaded === false) return true;

        if (!e.updatedAt) return true; // Handle fallback objects without updatedAt (though we added it)
        if (e.updatedAt < oneHourAgo) return true;

        if (includeHistory) {
             if (e.history && e.history.length > 0) {
                const lastHistoryDate = e.history[e.history.length - 1].date;
                if (new Date(lastHistoryDate) < twoDaysAgo) return true;

                // Check for missing intervals if full history is requested
                // This fixes issues where partial syncs (1d only) prevent loading of long-term charts (1M, 1Y, 5Y)
                if (isFullHistoryRequested) {
                    const hasWeekly = e.history.some((h: any) => h.interval === '1wk');
                    const hasMonthly = e.history.some((h: any) => h.interval === '1mo');
                    // We check for 1wk OR 1mo missing.
                    // Note: Very new assets might genuinely not have monthly data, but syncEtfDetails handles that safely.
                    if (!hasWeekly || !hasMonthly) {
                         // console.log(`[API] ${e.ticker} is stale due to missing intervals (1wk/1mo).`);
                         return true;
                    }
                }
             } else {
                 // No history implies stale if it's supposed to have it
                 return true;
             }
        }

        return false;
      });

      if (staleEtfs.length > 0) {
        // Reduced concurrency to 1 to prevent DB pool exhaustion during heavy syncs
        const limit = pLimit(1);

        if (isFullHistoryRequested) {
           // If user specifically requested full details (Details Drawer), we must block and sync
           console.log(`[API] Full details requested for stale/incomplete items. Performing blocking sync...`);

           // CRITICAL FIX: Limit the number of items we sync in one request to avoid Vercel timeouts (10s/60s).
           // If there are 20 items, we only sync the first 1 or 2. The rest will remain stale but readable.
           const maxSyncItems = 1; // Extremely conservative for full sync
           const itemsToSync = staleEtfs.slice(0, maxSyncItems);
           if (staleEtfs.length > maxSyncItems) {
               console.warn(`[API] Capping sync to ${maxSyncItems} items (out of ${staleEtfs.length}) to prevent timeout.`);
           }

           await Promise.all(itemsToSync.map((staleEtf: any) => limit(async () => {
             try {
                // Perform full sync (explicitly request all intervals to override optimization)
                const synced = await syncEtfDetails(staleEtf.ticker, ['1h', '1d', '1wk', '1mo']);
                if (synced) {
                    // Replace the stale item in the local list with the fresh one
                    const index = etfs.findIndex(e => e.ticker === staleEtf.ticker);
                    if (index !== -1) {
                        etfs[index] = synced;
                    }
                }
             } catch (err) {
                 console.error(`[API] Blocking sync failed for ${staleEtf.ticker}:`, err);
             }
           })));
        } else {
            // Fire-and-forget background sync for list views
            // Limit the background noise significantly
            // If many items are stale, we only pick 2 to update in the background.
            // This prevents "sync storms" where one request triggers 50 background jobs.
            const maxBackgroundSyncs = 2; // Conservative limit
            const itemsToSync = staleEtfs.slice(0, maxBackgroundSyncs);

            if (itemsToSync.length > 0) {
                 console.log(`[API] Triggering background sync for ${itemsToSync.length} items (capped from ${staleEtfs.length}).`);
                 // We don't await this Promise.all, but we still want to limit the concurrency
                 Promise.all(itemsToSync.map((staleEtf: any) => limit(() =>
                    syncEtfDetails(staleEtf.ticker, ['1d']).catch(err => {
                        if (err.toString().includes('MaxClientsInSessionMode') || err.toString().includes('DriverAdapterError')) {
                            console.warn(`[API] DB Busy (sync) for ${staleEtf.ticker}, skipping sync.`);
                        } else {
                            console.error(`[API] Background sync failed for ${staleEtf.ticker}:`, err);
                        }
                    })
                 )));
            }
        }
      }
    }

    // Fallback Strategy: Check for missing specific tickers
    const rawTargets = query ? query.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length > 0) : [];
    // Also include requested tickers from the new param
    if (tickersParam) {
        requestedTickers.forEach(t => rawTargets.push(t));
    }

    // De-duplicate targets
    const uniqueTargets = Array.from(new Set(rawTargets));
    const loadedTickers = new Set(etfs.map((e: any) => e.ticker));
    let targetsToFetch = uniqueTargets.filter(t => !loadedTickers.has(t));

    if (etfs.length > 0) {
      targetsToFetch = targetsToFetch.filter(t => !t.includes(' ') && t.length <= 12);
    }

    // Only fallback fetch a small number to prevent abuse, unless it's a specific portfolio request (tickersParam)
    // If tickersParam is used, we already handled missing ones above via `fetchMarketSnapshot` + upsert.
    // This block is mostly for the `query` param fallback.
    const limitedTargets = targetsToFetch.slice(0, 5);

    if (limitedTargets.length > 0 && !tickersParam) {
      console.log(`[API] Processing fallback strategy for missing targets: ${limitedTargets.join(', ')}`);

      // Serial execution for fallback
      const limit = pLimit(1);

      {
        try {
          // 1. Check DB for these tickers (Exact Match)
           let existingInDb: any[] = [];
           try {
              existingInDb = await prisma.etf.findMany({
                where: { ticker: { in: limitedTargets } },
                include: includeObj
              });
           } catch (e) {
               console.error('[API] Fallback DB read failed', e);
           }

          // Add found ones
          existingInDb.forEach((e: any) => {
            if (!etfs.find((existing: any) => existing.ticker === e.ticker)) {
              etfs.push(e);
            }
          });

          // Identify what's still missing
          const foundTickerSet = new Set(etfs.map((e: any) => e.ticker));
          const missingTargets = limitedTargets.filter(t => !foundTickerSet.has(t));

          if (missingTargets.length > 0) {
            console.log(`[API] Attempting deep sync for missing: ${missingTargets.join(', ')}`);

            await Promise.all(missingTargets.map((ticker) => limit(async () => {
              try {
                const synced = await syncEtfDetails(ticker);
                if (synced) {
                  etfs.push(synced as any);
                }
              } catch (err) {
                console.error(`[API] Sync failed for ${ticker}`, err);
              }
            })));

            // Re-check what is still missing after sync attempts
            const foundAfterSync = new Set(etfs.map((e: any) => e.ticker));
            const stillMissing = limitedTargets.filter(t => !foundAfterSync.has(t));

            if (stillMissing.length > 0) {
              console.log(`[API] Deep sync failed for ${stillMissing.join(', ')}. Falling back to snapshot...`);
              try {
                const liveData = await fetchMarketSnapshot(stillMissing);

                const snapshotPromises = liveData.map((item) => limit(async () => {
                  try {
                      return await prisma.etf.upsert({
                        where: { ticker: item.ticker },
                        update: {
                            price: toPrismaDecimalRequired(item.price),
                            daily_change: toPrismaDecimalRequired(item.dailyChangePercent),
                        },
                        create: {
                          ticker: item.ticker,
                          name: item.name,
                          price: toPrismaDecimalRequired(item.price),
                          daily_change: toPrismaDecimalRequired(item.dailyChangePercent),
                          currency: 'USD',
                          assetType: item.assetType || "ETF",
                          isDeepAnalysisLoaded: false,
                        },
                        include: includeObj
                      });
                  } catch (createErr) {
                    console.error(`[API] Failed to create snapshot ETF ${item.ticker}`, createErr);
                    // Fallback
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
                         updatedAt: new Date()
                     };
                  }
                }));

                const snapshotEtfs = await Promise.all(snapshotPromises);
                etfs.push(...(snapshotEtfs as any[]));
              } catch (snapshotErr) {
                console.error('[API] Snapshot fallback failed', snapshotErr);
              }
            }
          }

        } catch (fallbackError) {
          console.error('[API] Fallback strategy failed:', fallbackError);
        }
      }
    }

    // Format & Return Local Data with Number conversion
    const formattedEtfs = etfs.map((etf: any) => {
      let history = etf.history ? etf.history.map((h: any) => ({
        date: h.date instanceof Date ? h.date.toISOString() : h.date,
        price: Number(h.close),
        interval: (h.interval === 'daily' || !h.interval) ? undefined : h.interval
      })) : [];

      if (!isFullHistoryRequested && history.length > 50) {
        const step = Math.ceil(history.length / 30);
        history = history.filter((_: any, index: number) => index % step === 0 || index === history.length - 1);
      }

      const safeDecimal = (val: any) => {
          if (Decimal.isDecimal(val)) return val.toNumber();
          if (typeof val === 'string') return parseFloat(val);
          if (typeof val === 'number') return val;
          return 0;
      };

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
            mer: etf.mer ? safeDecimal(etf.mer) : 0
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
        fiftyTwoWeekHigh: etf.fiftyTwoWeekHigh ? safeDecimal(etf.fiftyTwoWeekHigh) : undefined,
        fiftyTwoWeekLow: etf.fiftyTwoWeekLow ? safeDecimal(etf.fiftyTwoWeekLow) : undefined,

        // New ETF Metrics
        inceptionDate: etf.inceptionDate || undefined,
        payoutFrequency: etf.payoutFrequency || undefined,
        payoutRatio: etf.payoutRatio ? safeDecimal(etf.payoutRatio) : undefined,
        holdingsCount: etf.holdingsCount || undefined,
        bondMaturity: etf.bondMaturity ? safeDecimal(etf.bondMaturity) : undefined,
        bondDuration: etf.bondDuration ? safeDecimal(etf.bondDuration) : undefined,

        allocation: {
          equities: etf.allocation?.stocks_weight ? safeDecimal(etf.allocation.stocks_weight) : 0,
          bonds: etf.allocation?.bonds_weight ? safeDecimal(etf.allocation.bonds_weight) : 0,
          cash: etf.allocation?.cash_weight ? safeDecimal(etf.allocation.cash_weight) : 0,
        },
        sectors: (etf.sectors || []).reduce((acc: { [key: string]: number }, sector: any) => {
          acc[sector.sector_name] = safeDecimal(sector.weight)
          return acc
        }, {} as { [key: string]: number }),
        holdings: (etf.holdings || []).map((h: any) => ({
            ticker: h.ticker,
            name: h.name,
            weight: safeDecimal(h.weight),
            sector: h.sector,
            shares: h.shares ? safeDecimal(h.shares) : undefined
        })),
      };
    })

    return NextResponse.json(formattedEtfs)
  } catch (error) {
    console.error('[API] Error searching ETFs:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
