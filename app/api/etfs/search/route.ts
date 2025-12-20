import { NextRequest, NextResponse } from 'next/server'
import { ETF } from '@/types'
import prisma from '@/lib/db'
import { fetchMarketSnapshot } from '@/lib/market-service'
import { syncEtfDetails } from '@/lib/etf-sync'
import { Decimal } from 'decimal.js'
// Import explicit types from Prisma to avoid 'any'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  const assetType = searchParams.get('type')
  const tickersParam = searchParams.get('tickers')
  const limitParam = searchParams.get('limit')
  const isFullHistoryRequested = searchParams.get('full') === 'true';
  // Default to false for performance, client must explicitly request history if needed
  // If full history is requested, we force includeHistory to true
  const includeHistory = searchParams.get('includeHistory') === 'true' || isFullHistoryRequested

  try {
    const whereClause: Prisma.EtfWhereInput = {};

    let requestedTickers: string[] = [];
    if (tickersParam) {
        requestedTickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
        if (requestedTickers.length > 0) {
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
      includeObj.history = { orderBy: { date: 'asc' } };
    }

    let takeLimit = isFullHistoryRequested ? 1 : (query ? 10 : 50);
    if (limitParam) {
        takeLimit = parseInt(limitParam, 10);
    } else if (tickersParam) {
        // If specific tickers are requested, allow fetching all of them plus some buffer
        takeLimit = requestedTickers.length;
    }

    let etfs: any[] = [];
    try {
        etfs = await prisma.etf.findMany({
            where: whereClause,
            include: includeObj,
            take: takeLimit,
        });
    } catch (dbError) {
        console.error('[API] DB Read Failed:', dbError);
        etfs = [];
    }

    // Handle missing tickers if a specific list was requested
    if (requestedTickers.length > 0) {
        const foundTickers = new Set(etfs.map((e: any) => e.ticker.toUpperCase()));
        const missingTickers = requestedTickers.filter(t => !foundTickers.has(t));

        if (missingTickers.length > 0) {
            console.log(`[API] Missing tickers found: ${missingTickers.join(', ')}. Attempting live fetch...`);
            try {
                const liveData = await fetchMarketSnapshot(missingTickers);

                // Create missing ETFs in DB
                for (const item of liveData) {
                    try {
                        const newEtf = await prisma.etf.upsert({
                            where: { ticker: item.ticker },
                            update: {
                                price: item.price.toString(),
                                daily_change: item.dailyChangePercent.toString(),
                                // Don't update name/assetType to prevent overwrites if user edited them
                            },
                            create: {
                                ticker: item.ticker,
                                name: item.name,
                                // Explicitly convert Decimal to string/number for Prisma compatibility
                                price: item.price.toString(),
                                daily_change: item.dailyChangePercent.toString(),
                                currency: 'USD',
                                assetType: item.assetType || "ETF",
                                isDeepAnalysisLoaded: false,
                            },
                            include: includeObj
                        });
                        // Add to the list of etfs to return
                        etfs.push(newEtf as any);
                    } catch (createError) {
                         console.error(`[API] Failed to upsert ETF ${item.ticker}:`, createError);

                         // Fallback: Use live data directly if DB write fails
                         // Construct an object matching the Prisma Etf shape expected by formattedEtfs
                         const fallbackEtf = {
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
                         etfs.push(fallbackEtf as any);
                    }
                }
            } catch (liveFetchError) {
                console.error('[API] Failed to fetch missing tickers live:', liveFetchError);
            }
        }
    }

    // Fallback for empty DB on general search (landing page scenario)
    if (etfs.length === 0 && !query && !tickersParam) {
        let defaultTickers = ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];

        if (assetType === 'CRYPTO') {
            defaultTickers = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD', 'ADA-USD', 'AVAX-USD', 'LINK-USD'];
        }

        console.log(`[API] Empty DB detected for general search (${assetType || 'General'}). Seeding default tickers...`);

        try {
            const liveData = await fetchMarketSnapshot(defaultTickers);
             for (const item of liveData) {
                try {
                     const newEtf = await prisma.etf.upsert({
                        where: { ticker: item.ticker },
                        update: {
                            price: item.price.toString(),
                            daily_change: item.dailyChangePercent.toString(),
                        },
                        create: {
                            ticker: item.ticker,
                            name: item.name,
                            price: item.price.toString(),
                            daily_change: item.dailyChangePercent.toString(),
                            currency: 'USD',
                            assetType: item.assetType || "ETF",
                            isDeepAnalysisLoaded: false,
                        },
                        include: includeObj
                    });
                    etfs.push(newEtf as any);
                } catch (e) {
                    console.error(`[API] Failed to auto-seed ${item.ticker}:`, e);
                     // Fallback: Use live data directly if DB write fails
                     const fallbackEtf = {
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
                     etfs.push(fallbackEtf as any);
                }
            }
        } catch (e) {
            console.error('[API] Failed to fetch default tickers:', e);
        }
    }

    if (query && etfs.length > 0 && etfs.length < 5) {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const staleEtfs = etfs.filter((e: any) => {
        if (!e.updatedAt) return true; // Handle fallback objects without updatedAt (though we added it)
        if (e.updatedAt < oneHourAgo) return true;

        if (e.history && e.history.length > 0) {
          const lastHistoryDate = e.history[e.history.length - 1].date;
          if (new Date(lastHistoryDate) < twoDaysAgo) return true;
        } else {
          return true;
        }

        return false;
      });

      if (staleEtfs.length > 0) {
        console.log(`[API] Found ${staleEtfs.length} stale ETFs for query "${query}". Syncing in background...`);

        // Fire-and-forget background sync
        Promise.all(staleEtfs.map((staleEtf: any) =>
          syncEtfDetails(staleEtf.ticker).catch(err =>
            console.error(`[API] Background sync failed for ${staleEtf.ticker}:`, err)
          )
        ));
      }
    }

    if (etfs.length === 0 && query && query.length > 1) {
      console.log(`[API] Local miss for "${query}". Processing fallback strategy...`);

      const targets = query.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length > 0);
      // Limit to 5 to prevent abuse
      const limitedTargets = targets.slice(0, 5);

      if (limitedTargets.length > 0) {
        try {
          // 1. Check DB for these tickers
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

            await Promise.all(missingTargets.map(async (ticker) => {
              try {
                const synced = await syncEtfDetails(ticker);
                if (synced) {
                  etfs.push(synced as any);
                }
              } catch (err) {
                console.error(`[API] Sync failed for ${ticker}`, err);
              }
            }));

            // Re-check what is still missing after sync attempts
            const foundAfterSync = new Set(etfs.map((e: any) => e.ticker));
            const stillMissing = limitedTargets.filter(t => !foundAfterSync.has(t));

            if (stillMissing.length > 0) {
              console.log(`[API] Deep sync failed for ${stillMissing.join(', ')}. Falling back to snapshot...`);
              try {
                const liveData = await fetchMarketSnapshot(stillMissing);
                for (const item of liveData) {
                  try {
                      const newEtf = await prisma.etf.upsert({
                        where: { ticker: item.ticker },
                        update: {
                            price: item.price.toString(),
                            daily_change: item.dailyChangePercent.toString(),
                        },
                        create: {
                          ticker: item.ticker,
                          name: item.name,
                          price: item.price.toString(),
                          daily_change: item.dailyChangePercent.toString(),
                          currency: 'USD',
                          assetType: item.assetType || "ETF",
                          isDeepAnalysisLoaded: false,
                        },
                        include: includeObj
                      });
                      etfs.push(newEtf as any);
                  } catch (createErr) {
                    console.error(`[API] Failed to create snapshot ETF ${item.ticker}`, createErr);
                    // Fallback
                     const fallbackEtf = {
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
                     etfs.push(fallbackEtf as any);
                  }
                }
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
    // We let TS infer the type from map, or explicit annotation.
    const formattedEtfs = etfs.map((etf: any) => {
      let history = etf.history ? etf.history.map((h: any) => ({
        date: h.date instanceof Date ? h.date.toISOString() : h.date, // Handle non-Date mocks/fallbacks if any
        price: Number(h.close),
        interval: h.interval
      })) : [];

      // Downsampling Logic: If not requesting full history and we have a lot of points,
      // reduce to ~30 points for performance (Sparklines)
      if (!isFullHistoryRequested && history.length > 50) {
        const step = Math.ceil(history.length / 30);
        history = history.filter((_: any, index: number) => index % step === 0 || index === history.length - 1);
      }

      // Handle Decimal conversion safely for potential fallback objects or DB objects
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
        allocation: {
          equities: etf.allocation?.stocks_weight ? safeDecimal(etf.allocation.stocks_weight) : 0,
          bonds: etf.allocation?.bonds_weight ? safeDecimal(etf.allocation.bonds_weight) : 0,
          cash: etf.allocation?.cash_weight ? safeDecimal(etf.allocation.cash_weight) : 0,
        },
        sectors: (etf.sectors || []).reduce((acc: { [key: string]: number }, sector: any) => {
          acc[sector.sector_name] = safeDecimal(sector.weight)
          return acc
        }, {} as { [key: string]: number }),
      };
    })

    return NextResponse.json(formattedEtfs)
  } catch (error) {
    console.error('[API] Error searching ETFs:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
