import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import pLimit from 'p-limit';
import { toPrismaDecimalRequired } from '@/lib/prisma-utils';
import { Decimal } from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Invalid updates array' }, { status: 400 });
    }

    // Limit concurrency to avoid database locks/pool exhaustion
    // Since this is a background sync operation, we can be conservative
    const limit = pLimit(5);

    const promises = updates.map((update: any) => limit(async () => {
      const { ticker, price, changePercent } = update;

      if (!ticker || price === undefined || changePercent === undefined) {
        return null;
      }

      try {
        // We only update existing records to avoid "upserting" garbage or unknown tickers
        // that shouldn't be in our DB yet.
        return await prisma.etf.update({
          where: { ticker: ticker.toUpperCase() },
          data: {
            price: toPrismaDecimalRequired(new Decimal(price)),
            daily_change: toPrismaDecimalRequired(new Decimal(changePercent)),
            updatedAt: new Date()
          }
        });
      } catch (e: any) {
        // Ignore "Record to update not found" errors
        if (e.code === 'P2025') return null;
        console.error(`[Batch Update] Failed to update ${ticker}:`, e);
        return null;
      }
    }));

    await Promise.all(promises);

    return NextResponse.json({ success: true, count: updates.length });
  } catch (error) {
    console.error('[Batch Update] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
