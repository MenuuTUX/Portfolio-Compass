import { NextRequest, NextResponse } from 'next/server';
import { syncEtfDetails } from '@/lib/etf-sync';
import { EtfHistory } from '@prisma/client';
import { Decimal } from 'decimal.js';


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticker } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    const fullEtf = await syncEtfDetails(ticker);

    if (!fullEtf) {
      return NextResponse.json({ error: 'Failed to sync ETF' }, { status: 404 });
    }

    // Map to frontend ETF interface
    // Convert all Decimals to numbers for frontend (Option A)
    const formattedEtf = {
      ticker: fullEtf.ticker,
      name: fullEtf.name,
      price: Number(fullEtf.price),
      changePercent: Number(fullEtf.daily_change),
      isDeepAnalysisLoaded: fullEtf.isDeepAnalysisLoaded,
      history: fullEtf.history.map((h: EtfHistory) => ({
        date: h.date.toISOString(),
        price: Number(h.close),
        interval: h.interval
      })),
      metrics: {
        yield: fullEtf.yield ? Number(fullEtf.yield) : 0,
        mer: fullEtf.mer ? Number(fullEtf.mer) : 0
      },
      allocation: {
        equities: fullEtf.allocation?.stocks_weight ? Number(fullEtf.allocation.stocks_weight) : 0,
        bonds: fullEtf.allocation?.bonds_weight ? Number(fullEtf.allocation.bonds_weight) : 0,
        cash: fullEtf.allocation?.cash_weight ? Number(fullEtf.allocation.cash_weight) : 0,
      },
      sectors: fullEtf.sectors.reduce((acc: { [key: string]: number }, sector) => {
        acc[sector.sector_name] = Number(sector.weight)
        return acc
      }, {} as { [key: string]: number }),
      assetType: fullEtf.assetType,
    };

    return NextResponse.json(formattedEtf);

  } catch (error: any) {
    console.error('Error syncing ETF:', error);
    if (error.message === 'Ticker not found') {
      return NextResponse.json({ error: 'Ticker not found', deleted: true }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
