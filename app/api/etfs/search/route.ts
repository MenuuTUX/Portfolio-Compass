
import { type NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchMarketSnapshot } from '@/lib/market-service';
import pLimit from 'p-limit';

// Limit READ operations (batch fetch) to 5 at a time to prevent DB pool exhaustion
const readLimit = pLimit(5);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const tickers = searchParams.get('tickers');
  const limitCount = parseInt(searchParams.get('limit') || '50');
  const skip = parseInt(searchParams.get('skip') || '0');
  const includeHistory = searchParams.get('includeHistory') === 'true';
  const includeHoldings = searchParams.get('includeHoldings') === 'true';
  const full = searchParams.get('full') === 'true';
  const type = searchParams.get('type'); // 'STOCK' or 'ETF'

  // Batch Fetch
  if (tickers) {
    const tickersList = tickers.split(',').map((t) => t.trim());

    // Use readLimit to throttle concurrent DB operations
    const results = await Promise.all(
      tickersList.map((ticker) => readLimit(async () => {
        let etf = await prisma.etf.findUnique({
          where: { ticker },
          include: {
            history: includeHistory
              ? {
                  orderBy: { date: 'asc' },
                  where: full ? undefined : {
                      interval: '1d', // Prefer daily for sparklines
                      date: {
                          gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) // Last 1 year
                      }
                  }
                }
              : false,
             holdings: includeHoldings ? true : false,
          },
        });

        // If missing, try to seed quickly (snapshot).
        if (!etf) {
           try {
             const snapshot = await fetchMarketSnapshot([ticker]);
             if (snapshot[ticker]) {
               const s = snapshot[ticker];
               etf = await prisma.etf.create({
                 data: {
                   ticker: s.ticker,
                   name: s.name || s.ticker,
                   price: s.price,
                   dailyChange: s.changePercent,
                   assetType: s.assetType || 'ETF',
                   lastUpdated: new Date()
                 },
                 include: { history: false, holdings: false } // No history on fresh seed
               });
             }
           } catch (e) {
             console.error(`Failed to seed ${ticker}`, e);
           }
        }
        // Removed server-side background sync.
        // The client (TrendingTab/ComparisonEngine) now handles live price hydration and sync.

        if (!etf) return null;

        // Map to Schema
        return mapEtfToSchema(etf, full);
      }))
    );

    return NextResponse.json(results.filter((r) => r !== null));
  }

  // Search Query
  if (query) {
    const where: any = {
      OR: [
        { ticker: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (type) {
        where.assetType = type;
    }

    const etfs = await prisma.etf.findMany({
      where,
      take: limitCount,
      skip: skip,
      orderBy: {
        ticker: 'asc'
      },
      include: {
        history: includeHistory
            ? {
                orderBy: { date: 'asc' },
                where: {
                    interval: '1d',
                    date: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) }
                }
            }
            : false,
      },
    });

    return NextResponse.json(etfs.map(e => mapEtfToSchema(e, full)));
  }

  // Default List (Paginated)
  const where: any = {};
  if (type) where.assetType = type;

  const etfs = await prisma.etf.findMany({
    where,
    take: limitCount,
    skip: skip,
    orderBy: { ticker: 'asc' },
     include: {
        history: includeHistory
            ? {
                orderBy: { date: 'asc' },
                where: {
                    interval: '1d',
                    date: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) }
                }
            }
            : false,
      },
  });

  return NextResponse.json(etfs.map(e => mapEtfToSchema(e, full)));
}

function mapEtfToSchema(etf: any, full: boolean) {
  // Safe Decimal to Number
  const price = etf.price?.toNumber?.() ?? etf.price ?? 0;
  const changePercent = etf.dailyChange?.toNumber?.() ?? etf.dailyChange ?? 0;
  const yieldVal = etf.yield?.toNumber?.() ?? etf.yield ?? 0;
  const mer = etf.mer?.toNumber?.() ?? etf.mer ?? 0;

  return {
    ticker: etf.ticker,
    name: etf.name,
    price,
    changePercent,
    assetType: etf.assetType,
    isDeepAnalysisLoaded: etf.isDeepAnalysisLoaded ?? false,
    history: (etf.history || []).map((h: any) => ({
      date: h.date.toISOString(),
      price: h.price?.toNumber?.() ?? h.price ?? 0,
      interval: (h.interval === 'daily' || !h.interval) ? undefined : h.interval,
    })),
    dividendHistory: [], // Not fetching deep history for list view usually
    metrics: {
      yield: yieldVal,
      mer: mer,
    },
    allocation: {
       // Mock or use real if available
       equities: 100, // Simplify for list
       bonds: 0,
       cash: 0
    },
    sectors: {}, // Simplify for list
    // Include extra fields if full
    ...(full && {
       holdings: (etf.holdings || []).map((h: any) => ({
         ticker: h.ticker,
         name: h.name,
         weight: h.weight?.toNumber?.() ?? h.weight ?? 0,
         sector: h.sector,
         shares: h.shares?.toNumber?.() ?? h.shares ?? undefined
       }))
    })
  };
}
