import { NextRequest, NextResponse } from 'next/server'
import { ETF } from '@/types'
import { execFile } from 'child_process'
import util from 'util'
import path from 'path'
import prisma from '@/lib/db'

// Force Node.js runtime to allow child_process execution
export const dynamic = 'force-dynamic';
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
    if (etfs.length === 0 && query) {
      console.log(`[API] Ticker "${query}" not found in DB. Triggering write-through cache (Python fetch)...`);

      try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_prices.py');
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

        const { stdout, stderr } = await execFilePromise(pythonCommand, [scriptPath, query]);

        if (stderr) console.warn('[Python Log]:', stderr);

        if (stdout) {
            const fetchedData = JSON.parse(stdout);

            for (const data of fetchedData) {
                // Upsert ETF
                await prisma.etf.upsert({
                    where: { ticker: data.ticker },
                    update: {
                        name: data.name,
                        currency: data.currency,
                        exchange: data.exchange,
                        price: data.price,
                        daily_change: data.daily_change,
                        yield: data.yield,
                        mer: data.mer,
                    },
                    create: {
                        ticker: data.ticker,
                        name: data.name,
                        currency: data.currency,
                        exchange: data.exchange,
                        price: data.price,
                        daily_change: data.daily_change,
                        yield: data.yield,
                        mer: data.mer,
                    }
                });

                // Update Sectors
                await prisma.etfSector.deleteMany({ where: { etfId: data.ticker } });
                if (data.sectors && data.sectors.length > 0) {
                    await prisma.etfSector.createMany({
                        data: data.sectors.map((s: any) => ({
                            etfId: data.ticker,
                            sector_name: s.sector_name,
                            weight: s.weight
                        }))
                    });
                }

                // Update Allocation
                await prisma.etfAllocation.deleteMany({ where: { etfId: data.ticker } });
                if (data.allocation) {
                    await prisma.etfAllocation.create({
                        data: {
                            etfId: data.ticker,
                            stocks_weight: data.allocation.stocks_weight,
                            bonds_weight: data.allocation.bonds_weight,
                            cash_weight: data.allocation.cash_weight,
                        }
                    });
                }

                // Update History (Batch Insert with Interval)
                // We delete existing history to avoid duplicates/conflicts when refreshing
                // Or better, we should probably delete only overlapping ranges if we want to be smart,
                // but given the fetch logic fetches "last X time", replacing is safest to ensure data integrity.
                // However, deleting ALL history might be aggressive if we only fetched part.
                // But the script fetches a comprehensive set of intervals.
                await prisma.etfHistory.deleteMany({ where: { etfId: data.ticker } });

                if (data.history && data.history.length > 0) {
                    await prisma.etfHistory.createMany({
                        data: data.history.map((h: any) => ({
                            etfId: data.ticker,
                            date: new Date(h.date),
                            close: h.close,
                            interval: h.interval
                        }))
                    });
                }
            }
        }

        // 3. Re-query the database
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
      }
    }

    // Map Prisma result to frontend ETF interface
    const formattedEtfs: ETF[] = etfs.map((etf) => ({
      ticker: etf.ticker,
      name: etf.name,
      price: etf.price,
      changePercent: etf.daily_change,
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
