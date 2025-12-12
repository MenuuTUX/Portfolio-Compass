import { NextRequest, NextResponse } from 'next/server'
import { ETF } from '@/types'
import prisma from '@/lib/db'
import { fetchMarketSnapshot } from '@/lib/market-service'
import { syncEtfDetails } from '@/lib/etf-sync'
import { Decimal } from 'decimal.js'

import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')

  try {
    const whereClause: Prisma.EtfWhereInput = {};

    if (query) {
      whereClause.OR = [
        { ticker: { contains: query, mode: 'insensitive' as const } },
        { name: { contains: query, mode: 'insensitive' as const } },
      ];
    }

    let etfs = await prisma.etf.findMany({
      where: whereClause,
      include: {
        history: { orderBy: { date: 'asc' } },
        sectors: true,
        allocation: true,
      },
      take: query ? 10 : 1000,
    })

    if (query && etfs.length > 0 && etfs.length < 5) {
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
        console.log(`[API] Found ${staleEtfs.length} stale ETFs for query "${query}". Syncing...`);

        await Promise.all(staleEtfs.map(async (staleEtf) => {
          try {
            const updated = await syncEtfDetails(staleEtf.ticker);
            if (updated) {
              const index = etfs.findIndex(e => e.ticker === staleEtf.ticker);
              if (index !== -1) {
                etfs[index] = updated as any;
              }
            }
          } catch (err) {
            console.error(`[API] Failed to auto-sync ${staleEtf.ticker}:`, err);
          }
        }));
      }
    }

    if (etfs.length === 0 && query && query.length > 1) {
      console.log(`[API] Local miss for "${query}". Attempting live fetch...`);

      try {
        const liveData = await fetchMarketSnapshot([query]);

        if (Array.isArray(liveData) && liveData.length > 0) {
          const item = liveData[0];

          // create returns Decimal for price/daily_change
          const newEtf = await prisma.etf.create({
            data: {
              ticker: item.ticker,
              name: item.name,
              price: item.price, // Decimal
              daily_change: item.dailyChangePercent, // Decimal
              currency: 'USD',
              assetType: item.assetType || "ETF",
              isDeepAnalysisLoaded: false,
            }
          });

          // Return newly created item with formatting
          return NextResponse.json([{
            ticker: newEtf.ticker,
            name: newEtf.name,
            price: Number(newEtf.price),
            changePercent: Number(newEtf.daily_change),
            assetType: newEtf.assetType,
            isDeepAnalysisLoaded: false,
            history: [],
            metrics: { yield: 0, mer: 0 },
            allocation: { equities: 0, bonds: 0, cash: 0 },
            sectors: {},
          }]);
        }
      } catch (liveError) {
        console.error('[API] Live fetch failed:', liveError);
      }
    }

    // Format & Return Local Data with Number conversion
    const formattedEtfs: any[] = etfs.map((etf) => ({
      ticker: etf.ticker,
      name: etf.name,
      price: Number(etf.price),
      changePercent: Number(etf.daily_change),
      assetType: etf.assetType,
      isDeepAnalysisLoaded: etf.isDeepAnalysisLoaded,
      history: etf.history.map((h) => ({
        date: h.date.toISOString(),
        price: Number(h.close),
        interval: h.interval
      })),
      metrics: {
          yield: etf.yield ? Number(etf.yield) : 0,
          mer: etf.mer ? Number(etf.mer) : 0
      },
      allocation: {
        equities: etf.allocation?.stocks_weight ? Number(etf.allocation.stocks_weight) : 0,
        bonds: etf.allocation?.bonds_weight ? Number(etf.allocation.bonds_weight) : 0,
        cash: etf.allocation?.cash_weight ? Number(etf.allocation.cash_weight) : 0,
      },
      sectors: etf.sectors.reduce((acc: { [key: string]: number }, sector) => {
        acc[sector.sector_name] = Number(sector.weight)
        return acc
      }, {} as { [key: string]: number }),
    }))

    return NextResponse.json(formattedEtfs)
  } catch (error) {
    console.error('[API] Error searching ETFs:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
