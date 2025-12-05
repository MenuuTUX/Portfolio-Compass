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

  try {
    const whereClause: Prisma.EtfWhereInput = {};

    if (query) {
      whereClause.OR = [
        { ticker: { contains: query, mode: 'insensitive' as const } },
        { name: { contains: query, mode: 'insensitive' as const } },
      ];
    }

    // 1. Attempt Local DB Fetch
    let etfs = await prisma.etf.findMany({
      where: whereClause,
      include: {
        history: { orderBy: { date: 'asc' } },
        sectors: true,
        allocation: true,
        holdings: true,
      },
      take: query ? 10 : 1000,
    })

    // 1.5 Check for Stale Data (Auto-Sync)
    // If we have a specific query and found results, check if they are stale.
    // Only do this for small result sets to avoid massive sync storms.
    if (query && etfs.length > 0 && etfs.length < 5) {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const staleEtfs = etfs.filter(e => {
        // 1. Check if the record itself hasn't been updated in 1 hour
        if (e.updatedAt < oneHourAgo) return true;

        // 2. Check if the latest history data point is older than 2 days
        // This catches cases where sync ran but didn't get recent data, or market was closed
        if (e.history && e.history.length > 0) {
          const lastHistoryDate = e.history[e.history.length - 1].date;
          if (new Date(lastHistoryDate) < twoDaysAgo) return true;
        } else {
          // No history implies stale/incomplete data
          return true;
        }

        return false;
      });

      if (staleEtfs.length > 0) {
        console.log(`[API] Found ${staleEtfs.length} stale ETFs for query "${query}". Syncing...`);

        // Sync in parallel
        await Promise.all(staleEtfs.map(async (staleEtf) => {
          try {
            const updated = await syncEtfDetails(staleEtf.ticker);
            if (updated) {
              // Update the local object in the array so we return fresh data
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

    // 2. Live Market Fallback
    if (etfs.length === 0 && query && query.length > 1) {
      console.log(`[API] Local miss for "${query}". Attempting live fetch...`);

      try {
        const liveData = await fetchMarketSnapshot([query]);

        if (Array.isArray(liveData) && liveData.length > 0) {
          const item = liveData[0];

          const newEtf = await prisma.etf.create({
            data: {
              ticker: item.ticker,
              name: item.name,
              price: item.price,
              daily_change: item.dailyChangePercent, // Storing percent as daily_change
              currency: 'USD',
              assetType: item.assetType || "ETF",
              isDeepAnalysisLoaded: false,
            }
          });

          // Return newly created item with assetType
          return NextResponse.json([{
            ticker: newEtf.ticker,
            name: newEtf.name,
            price: newEtf.price,
            changePercent: newEtf.daily_change,
            assetType: newEtf.assetType,
            isDeepAnalysisLoaded: false,
            history: [],
            metrics: { yield: 0, mer: 0 },
            allocation: { equities: 0, bonds: 0, cash: 0 },
            sectors: {},
            holdings: [],
          }]);
        }
      } catch (liveError) {
        console.error('[API] Live fetch failed:', liveError);
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
