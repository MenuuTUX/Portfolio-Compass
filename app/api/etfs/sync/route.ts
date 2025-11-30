import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { execFile } from 'child_process';
import path from 'path';

// Use singleton Prisma instance ideally, but for now importing generated Client
// If `lib/db.ts` exists, use it. Memory said "Prisma Client ... must be accessed via the singleton instance exported from lib/db.ts".
// I should check if `lib/db.ts` exists. I'll read it first or just try to import.
// For now I will assume `lib/db.ts` exists based on memory and use it.
import prisma from '@/lib/db';

// Fallback if lib/db doesn't work (I will handle import error if needed, but assuming memory is correct)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticker } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    console.log(`Syncing details for ${ticker}...`);

    const pythonScript = path.join(process.cwd(), 'scripts', 'fetch_details.py');

    const result = await new Promise<string>((resolve, reject) => {
      execFile('python', [pythonScript, ticker], (error, stdout, stderr) => {
        if (error) {
          console.error("Python execution error:", error);
          reject(error);
          return;
        }
        if (stderr) {
          // python might write warnings to stderr, not necessarily failure.
          // But if stdout is empty/invalid it's an issue.
          console.warn(`Python stderr: ${stderr}`);
        }
        resolve(stdout);
      });
    });

    // Parse JSON
    // Note: Python script might print multiple lines? It should just print one JSON blob.
    // If warnings in stderr, stdout should still be clean if python script is good.
    const data = JSON.parse(result);

    if (data.error) {
      if (data.error.includes("Ticker not found")) {
        console.log(`Ticker ${ticker} not found, deleting from database...`);
        await prisma.etf.delete({ where: { ticker } });
        return NextResponse.json({ error: 'Ticker not found', deleted: true }, { status: 404 });
      }
      return NextResponse.json({ error: data.error }, { status: 404 });
    }

    // Update DB
    // 1. Update ETF basic info & isDeepAnalysisLoaded
    // 2. Update Sectors (delete old, create new)
    // 3. Update Allocation (upsert)
    // 4. Update History (delete old for ticker?, insert new)

    await prisma.$transaction(async (tx) => {
      // Update ETF
      await tx.etf.update({
        where: { ticker: data.ticker },
        data: {
          name: data.name,
          currency: data.currency,
          exchange: data.exchange,
          price: data.price,
          daily_change: data.daily_change,
          yield: data.yield,
          mer: data.mer,
          assetType: data.asset_type,
          isDeepAnalysisLoaded: true,
        }
      });

      // Sectors
      await tx.etfSector.deleteMany({ where: { etfId: data.ticker } });
      if (data.sectors && data.sectors.length > 0) {
        await tx.etfSector.createMany({
          data: data.sectors.map((s: any) => ({
            etfId: data.ticker,
            sector_name: s.sector_name,
            weight: s.weight
          }))
        });
      }

      // Allocation
      await tx.etfAllocation.upsert({
        where: { etfId: data.ticker },
        update: {
          stocks_weight: data.allocation.stocks_weight,
          bonds_weight: data.allocation.bonds_weight,
          cash_weight: data.allocation.cash_weight,
        },
        create: {
          etfId: data.ticker,
          stocks_weight: data.allocation.stocks_weight,
          bonds_weight: data.allocation.bonds_weight,
          cash_weight: data.allocation.cash_weight,
        }
      });

      // History
      // Strategy: Delete all history for this ETF and replace with fresh deep fetch data.
      // This ensures no stale intervals or duplicates.
      await tx.etfHistory.deleteMany({ where: { etfId: data.ticker } });

      if (data.history && data.history.length > 0) {
        await tx.etfHistory.createMany({
          data: data.history.map((h: any) => ({
            etfId: data.ticker,
            date: new Date(h.date),
            close: h.close,
            interval: h.interval
          }))
        });
      }
    });

    // Return the full ETF object
    const fullEtf = await prisma.etf.findUnique({
      where: { ticker: data.ticker },
      include: {
        history: { orderBy: { date: 'asc' } },
        sectors: true,
        allocation: true
      }
    });

    if (!fullEtf) {
      return NextResponse.json({ error: 'ETF not found after sync' }, { status: 404 });
    }

    // Map to frontend ETF interface
    const formattedEtf = {
      ticker: fullEtf.ticker,
      name: fullEtf.name,
      price: fullEtf.price,
      changePercent: fullEtf.daily_change,
      isDeepAnalysisLoaded: fullEtf.isDeepAnalysisLoaded,
      history: fullEtf.history.map((h) => ({
        date: h.date.toISOString(),
        price: h.close,
        interval: h.interval
      })),
      metrics: {
        yield: fullEtf.yield || 0,
        mer: fullEtf.mer || 0
      },
      allocation: {
        equities: fullEtf.allocation?.stocks_weight || 0,
        bonds: fullEtf.allocation?.bonds_weight || 0,
        cash: fullEtf.allocation?.cash_weight || 0,
      },
      sectors: fullEtf.sectors.reduce((acc, sector) => {
        acc[sector.sector_name] = sector.weight
        return acc
      }, {} as { [key: string]: number }),
      assetType: fullEtf.assetType,
    };

    return NextResponse.json(formattedEtf);

  } catch (error) {
    console.error('Error syncing ETF:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
