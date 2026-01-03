import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { syncEtfDetails } from '@/lib/etf-sync';
import { isMarketOpen } from '@/lib/market-hours';
import pLimit from 'p-limit';

// Force dynamic to ensure we don't cache the result of the stale check
export const dynamic = 'force-dynamic';

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];

export async function GET(req: NextRequest) {
  try {
    // SECURITY: Authorization check
    // Vercel Cron sends the `Authorization` header automatically if `CRON_SECRET` is configured.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');

    // 1. Fail securely if the secret is not configured in the environment at all.
    // This prevents the endpoint from "failing open" (becoming public) if the env var is missing.
    if (!cronSecret) {
        // In development, we might allow bypass for testing convenience, but warn loudly.
        if (process.env.NODE_ENV === 'development') {
            console.warn('[Cron] WARNING: CRON_SECRET is not set. Allowing access for local development.');
        } else {
            console.error('[Cron] CRITICAL: CRON_SECRET is not set in production. Access denied.');
            return NextResponse.json({ error: 'Server Configuration Error: Missing CRON_SECRET' }, { status: 500 });
        }
    }
    // 2. If configured, strictly enforce the Bearer token match.
    else if (authHeader !== `Bearer ${cronSecret}`) {
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

    let tickersToSync = staleDefaultTickers.map((t: { ticker: string }) => t.ticker);

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
      tickersToSync = staleOthers.map((t: { ticker: string }) => t.ticker);
    }

    if (tickersToSync.length === 0) {
      return NextResponse.json({ message: 'No stale ETFs found', synced: [] });
    }

    console.log(`[Cron] Syncing stale ETFs: ${tickersToSync.join(', ')}`);

    // Use p-limit to strictly sequence these syncs
    // Even though we only take 3-5, running them in parallel can trigger 429s
    const limit = pLimit(1);

    const results = await Promise.allSettled(tickersToSync.map((ticker: string) => limit(() => {
      console.log(`Incremental sync: ${ticker}`);
      return syncEtfDetails(ticker, ['1h', '1d']);
    })));

    const successCount = results.filter((r: PromiseSettledResult<any>) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value).length;
    const failedCount = results.filter((r: PromiseSettledResult<any>) => r.status === 'rejected' || (r.status === 'fulfilled' && !(r as PromiseFulfilledResult<any>).value)).length;

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
