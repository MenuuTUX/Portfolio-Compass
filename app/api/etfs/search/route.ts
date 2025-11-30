import { NextRequest, NextResponse } from 'next/server'
import { ETF } from '@/types'
import prisma from '@/lib/db'
import { execFile } from 'child_process'
import path from 'path'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  const type = searchParams.get('type')

  try {
    const whereClause: any = {};

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
      },
      take: 10,
    })

    // 2. Live Market Fallback
    if (etfs.length === 0 && query && query.length > 1) {
      console.log(`[API] Local miss for "${query}". Attempting live fetch...`);

      try {
        const pythonScript = path.join(process.cwd(), 'scripts', 'fetch_market_snapshot.py');

        const liveDataRaw = await new Promise<string>((resolve, reject) => {
          execFile('python3', [pythonScript, query], (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
          });
        });

        const liveData = JSON.parse(liveDataRaw);

        if (Array.isArray(liveData) && liveData.length > 0) {
          const item = liveData[0];

          const newEtf = await prisma.etf.create({
            data: {
              ticker: item.ticker,
              name: item.name,
              price: item.price,
              daily_change: item.daily_change,
              currency: 'USD',
              assetType: item.asset_type || "ETF",
              isDeepAnalysisLoaded: false,
            }
          });

          // Return newly created item with assetType
          return NextResponse.json([{
            ticker: newEtf.ticker,
            name: newEtf.name,
            price: newEtf.price,
            changePercent: newEtf.daily_change,
            assetType: newEtf.assetType, // <--- ADDED THIS
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

    // 3. Format & Return Local Data
    const formattedEtfs: ETF[] = etfs.map((etf) => ({
      ticker: etf.ticker,
      name: etf.name,
      price: etf.price,
      changePercent: etf.daily_change,
      assetType: etf.assetType, // <--- ADDED THIS
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
      sectors: etf.sectors.reduce((acc, sector) => {
        acc[sector.sector_name] = sector.weight
        return acc
      }, {} as { [key: string]: number }),
    }))

    return NextResponse.json(formattedEtfs)
  } catch (error) {
    console.error('[API] Error searching ETFs:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}