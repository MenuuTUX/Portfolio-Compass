import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { syncEtfDetails } from '@/lib/etf-sync';
import { isMarketOpen } from '@/lib/market-hours';

// Force dynamic to ensure we don't cache the result of the stale check
export const dynamic = 'force-dynamic';

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];

export async function GET(req: NextRequest) {
  try {
    // Check for authorization via CRON_SECRET if provided in environment
    // Vercel Cron sends this header automatically if configured.
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if market is open
    if (!isMarketOpen()) {
      console.log('[Cron] Market is closed. Skipping sync.');
      return NextResponse.json({ message: 'Market Closed', synced: [] });
    }

    // 1. Check Default Tickers for Staleness
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const staleDefaultTickers = await prisma.etf.findMany({
      where: {
        ticker: { in: DEFAULT_TICKERS },
        updatedAt: { lt: oneHourAgo }
      },
      select: { ticker: true },
      take: 3 // Limit to prevent timeout
    });

    let tickersToSync = staleDefaultTickers.map(t => t.ticker);

    // 2. If no default tickers are stale, check for other stale ETFs (Oldest Updated)
    if (tickersToSync.length === 0) {
      const staleOthers = await prisma.etf.findMany({
        where: {
          updatedAt: { lt: oneHourAgo },
          ticker: { notIn: DEFAULT_TICKERS } // Exclude default ones as we already checked
        },
        orderBy: { updatedAt: 'asc' }, // Oldest first
        select: { ticker: true },
        take: 5 // Sync up to 5 others
      });
      tickersToSync = staleOthers.map(t => t.ticker);
    }

    if (tickersToSync.length === 0) {
      return NextResponse.json({ message: 'No stale ETFs found', synced: [] });
    }

    console.log(`[Cron] Syncing stale ETFs: ${tickersToSync.join(', ')}`);

    const results = await Promise.allSettled(tickersToSync.map(ticker => {
      console.log(`Incremental sync: ${ticker}`);
      return syncEtfDetails(ticker);
    }));

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failedCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)).length;

    return NextResponse.json({
      message: 'Sync complete',
      synced: tickersToSync,
      successCount,
      failedCount
    });

  } catch (error: any) {
    console.error('[Cron] Error syncing stale ETFs:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
