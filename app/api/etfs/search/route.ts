import { PrismaClient } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { ETF } from '@/types'
import { execFile } from 'child_process'
import util from 'util'
import path from 'path'
import os from 'os'

// Force Node.js runtime to allow child_process execution
export const dynamic = 'force-dynamic';

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
        history: { orderBy: { date: 'asc' } },
        sectors: true,
        allocation: true,
      },
      take: 10,
    })

    // 2. ON-DEMAND WRITE-THROUGH CACHE
    // If DB result is empty and we have a specific query, try to fetch it live via Python script.
    if (etfs.length === 0 && query) {
      console.log(`[API] Ticker "${query}" not found in DB. Triggering write-through cache (Python fetch)...`);

      try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_prices.py');

        // Determine python command (try to be cross-platform friendly)
        // In most production linux envs 'python3' is safe. In windows, often 'python'.
        // We'll try 'python3' first, as run.sh uses it.
        // If we were more robust we might check os.platform().
        // For now, consistent with existing code but with better logging.
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

        const { stdout, stderr } = await execFilePromise(pythonCommand, [scriptPath, query]);

        if (stdout) console.log('[Python Output]:', stdout);
        if (stderr) console.warn('[Python Log]:', stderr);

        // 3. Re-query the database to get the newly added data
        // Note: The python script might have added it as .TO, so we should search again loosely or checking exact match if we knew it.
        // But since we search with 'contains', if python added "VFV.TO" and we searched "VFV", it should show up.
        etfs = await prisma.etf.findMany({
          where: whereClause,
          include: {
            history: { orderBy: { date: 'asc' } },
            sectors: true,
            allocation: true,
          },
          take: 10,
        })
      } catch (scriptError: any) {
        console.error("[API] Failed to execute data fetch script:", scriptError);
        // We don't fail the request, just return empty list if script failed.
      }
    }

    // Map Prisma result to frontend ETF interface
    const formattedEtfs: ETF[] = etfs.map((etf) => ({
      ticker: etf.ticker,
      name: etf.name,
      price: etf.price,
      changePercent: etf.daily_change,
      history: etf.history.map((h) => ({ date: h.date.toISOString(), price: h.close })),
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
