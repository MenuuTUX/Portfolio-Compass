import { NextRequest, NextResponse } from 'next/server'
import { ETF } from '@/types'
import prisma from '@/lib/db'
import { fetchMarketSnapshot } from '@/lib/market-service'
import { syncEtfDetails } from '@/lib/etf-sync'

import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  const tickers = searchParams.get('tickers') // Comma separated list of tickers
  const type = searchParams.get('type') // 'ETF' or 'STOCK'
  const sort = searchParams.get('sort') // 'changePercent' | 'price' | 'ticker'
  const order = searchParams.get('order') // 'asc' | 'desc'
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  try {
    const whereClause: Prisma.EtfWhereInput = {};

    if (tickers) {
        const tickerList = tickers.split(',').map(t => t.trim());
        whereClause.ticker = { in: tickerList };
    } else if (query) {
      whereClause.OR = [
        { ticker: { contains: query, mode: 'insensitive' as const } },
        { name: { contains: query, mode: 'insensitive' as const } },
      ];
    }

    if (type) {
        whereClause.assetType = type;
    }

    // Determine sorting
    let orderBy: Prisma.EtfOrderByWithRelationInput = {};
    if (sort === 'changePercent') {
        orderBy = { daily_change: order === 'asc' ? 'asc' : 'desc' };
    } else if (sort === 'price') {
        orderBy = { price: order === 'asc' ? 'asc' : 'desc' };
    } else if (sort === 'ticker') {
        orderBy = { ticker: order === 'asc' ? 'asc' : 'desc' };
    } else {
        orderBy = { ticker: 'asc' };
    }

    // 1. Attempt Local DB Fetch with Pagination
    const skip = (page - 1) * limit;

    let etfs = await prisma.etf.findMany({
      where: whereClause,
      include: {
        history: { orderBy: { date: 'asc' } },
        sectors: true,
        allocation: true,
        holdings: true,
      },
      take: limit,
      skip: skip,
      orderBy: orderBy,
    })

    // 1.5 Check for Stale Data (Auto-Sync) - Only if specific tickers or query provided
    // If fetching "Best" (sorted by change), we trust the DB mostly, but if it's very old we might need a background job.
    // Here we stick to the existing logic: if specific query/tickers and result count is small, check staleness.
    if ((query || tickers) && page === 1 && etfs.length > 0 && etfs.length < 10) {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const staleEtfs = etfs.filter(e => {
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
        console.log(`[API] Found ${staleEtfs.length} stale ETFs. Syncing...`);
        await Promise.all(staleEtfs.map(async (staleEtf) => {
          try {
            const updated = await syncEtfDetails(staleEtf.ticker);
            if (updated) {
              const index = etfs.findIndex(e => e.ticker === staleEtf.ticker);
              if (index !== -1) etfs[index] = updated as any;
            }
          } catch (err) {
            console.error(`[API] Failed to auto-sync ${staleEtf.ticker}:`, err);
          }
        }));
      }
    }

    // 2. Live Market Fallback
    // Only if searching for a specific query/ticker and we found nothing locally.
    // If searching by "Best" (no query, just sort), we don't fetch live.
    // Fix: We also check if tickers list is provided, not just query length.
    const shouldFallback = page === 1 && etfs.length === 0 && (
      (query && query.length > 1) || (tickers && tickers.length > 0)
    );

    if (shouldFallback) {
       // Logic for fallback is mainly for single query. Multi-ticker fallback is complex.
       // We'll stick to single query fallback for now or simple ticker list.
       const targets = tickers ? tickers.split(',') : [query!];

       if (targets.length > 0 && targets.length <= 5) {
          console.log(`[API] Local miss for "${targets}". Attempting live fetch...`);
          try {
            const liveData = await fetchMarketSnapshot(targets);

            if (Array.isArray(liveData) && liveData.length > 0) {
               // We only return what we found
               const newEtfs: any[] = [];
               for (const item of liveData) {
                    const existing = await prisma.etf.findUnique({ where: { ticker: item.ticker } });
                    if (!existing) {
                        const newEtf = await prisma.etf.create({
                            data: {
                            ticker: item.ticker,
                            name: item.name,
                            price: item.price,
                            daily_change: item.dailyChangePercent,
                            currency: 'USD',
                            assetType: item.assetType || "ETF",
                            isDeepAnalysisLoaded: false,
                            }
                        });
                        newEtfs.push(newEtf);
                    } else {
                        newEtfs.push(existing);
                    }
               }

               // Return newly found items formatted
               // Note: This bypasses pagination for this specific fallback case, which is fine.
               return NextResponse.json(newEtfs.map((etf) => ({
                    ticker: etf.ticker,
                    name: etf.name,
                    price: etf.price,
                    changePercent: etf.daily_change,
                    assetType: etf.assetType,
                    isDeepAnalysisLoaded: etf.isDeepAnalysisLoaded,
                    history: [],
                    metrics: { yield: 0, mer: 0 },
                    allocation: { equities: 0, bonds: 0, cash: 0 },
                    sectors: {},
                    holdings: [],
                })));
            }
          } catch (liveError) {
            console.error('[API] Live fetch failed:', liveError);
          }
       }
    }

    // 3. Format & Return Local Data
    const formattedEtfs: ETF[] = etfs.map((etf) => ({
      ticker: etf.ticker,
      name: etf.name,
      price: etf.price,
      changePercent: etf.daily_change,
      assetType: etf.assetType,
      isDeepAnalysisLoaded: etf.isDeepAnalysisLoaded,
      history: etf.history.map((h) => ({
        date: h.date.toISOString(),
        price: h.close,
        interval: h.interval
      })),
      metrics: { yield: etf.yield || 0, mer: etf.mer || 0 },
      allocation: {
        equities: etf.allocation?.stocks_weight || 0,
        bonds: etf.allocation?.bonds_weight || 0,
        cash: etf.allocation?.cash_weight || 0,
      },
      sectors: etf.sectors.reduce((acc: { [key: string]: number }, sector) => {
        acc[sector.sector_name] = sector.weight
        return acc
      }, {} as { [key: string]: number }),
      holdings: etf.holdings ? etf.holdings.map(h => ({
        symbol: h.symbol,
        name: h.name,
        weight: h.weight
      })) : []
    }))

    return NextResponse.json(formattedEtfs)
  } catch (error) {
    console.error('[API] Error searching ETFs:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
