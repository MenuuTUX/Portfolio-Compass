import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import pLimit from 'p-limit';
import { toPrismaDecimalRequired } from '@/lib/prisma-utils';
import { Decimal } from 'decimal.js';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation Schema
const UpdateSchema = z.object({
  ticker: z.string().min(1).max(20),
  price: z.number().nonnegative(), // Price can be 0 (e.g., bankrupt) but not negative
  changePercent: z.number().min(-1000).max(1000) // Reasonable bounds for percent change
});

const BatchUpdateSchema = z.object({
  updates: z.array(UpdateSchema).min(1).max(100) // Limit batch size to prevent overload
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Basic Validation to prevent garbage data injection
    const validation = BatchUpdateSchema.safeParse(body);
    if (!validation.success) {
      console.warn('[Batch Update] Invalid payload:', validation.error);
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    const { updates } = validation.data;

    // Limit concurrency to avoid database locks/pool exhaustion
    // Since this is a background sync operation, we can be conservative
    const limit = pLimit(5);

    const promises = updates.map((update) => limit(async () => {
      const { ticker, price, changePercent } = update;

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
        // Ignore "Record to update not found" errors (P2025)
        if (e.code !== 'P2025') {
            console.error(`[Batch Update] Failed to update ${ticker}:`, e);
        }
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
