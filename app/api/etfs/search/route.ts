import { PrismaClient } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { ETF } from '@/types'
import { execFile } from 'child_process'
import util from 'util'
import path from 'path'

// Force Node.js runtime to allow child_process execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const prisma = new PrismaClient()
const execFilePromise = util.promisify(execFile)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')

  try {
    const whereClause = query
      ? {
          OR: [
            { ticker: { contains: query, mode: 'insensitive' as const } },
            { name: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // 1. Attempt to fetch from Database
    let etfs = await prisma.etf.findMany({
      where: whereClause,
      include: {
        history: { orderBy: { date: 'asc' }, take: 30 },
        sectors: true,
        allocation: true,
      },
      take: 10,
    })

    // 2. ON-DEMAND FETCH: If DB is empty and we have a specific query, try to fetch it live.
    if (etfs.length === 0 && query) {
      console.log(`[API] Ticker "${query}" not found in DB. Triggering live Python fetch...`);

      try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_prices.py');
        // Execute python script using execFile to prevent command injection
        const { stdout, stderr } = await execFilePromise('python3', [scriptPath, query]);

        if (stdout) console.log('[Python Output]:', stdout);
        if (stderr) console.warn('[Python Warning]:', stderr);

        // 3. Re-query the database
        etfs = await prisma.etf.findMany({
          where: whereClause,
          include: {
            history: { orderBy: { date: 'asc' }, take: 30 },
            sectors: true,
            allocation: true,
          },
          take: 10,
        })
      } catch (scriptError) {
        console.error("[API] Failed to execute data fetch script:", scriptError);
      }
    }

    // Map Prisma result to frontend ETF interface
    const formattedEtfs: ETF[] = etfs.map((etf) => ({
      ticker: etf.ticker,
      name: etf.name,
      price: etf.price,
      changePercent: etf.daily_change,
      history: etf.history.map((h) => h.close),
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
