import { PrismaClient } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { ETF } from '@/types'

const prisma = new PrismaClient()

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

    const etfs = await prisma.etf.findMany({
      where: whereClause,
      include: {
        history: {
          orderBy: { date: 'asc' },
          take: 30, // Limit history points for sparkline
        },
        sectors: true,
        allocation: true,
      },
      take: 10,
    })

    // Map Prisma result to frontend ETF interface
    const formattedEtfs: ETF[] = etfs.map((etf) => ({
      ticker: etf.ticker,
      name: etf.name,
      price: etf.price,
      changePercent: etf.daily_change,
      history: etf.history.map((h) => h.close),
      metrics: {
        yield: etf.yield || 0,
        mer: etf.mer || 0,
      },
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
    console.error('Error searching ETFs:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
