import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { syncEtfDetails } from '@/lib/etf-sync';
import pLimit from 'p-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout for bulk sync

export async function POST() {
    try {
        // 1. Get all tickers from DB
        const allEtfs = await prisma.etf.findMany({
            select: { ticker: true }
        });

        if (allEtfs.length === 0) {
            return NextResponse.json({ message: 'No ETFs to sync', results: [] });
        }

        console.log(`Starting bulk sync for ${allEtfs.length} ETFs...`);

        // Limit concurrency to 5 to avoid rate limits/timeouts
        const limit = pLimit(5);
        let successCount = 0;
        let failureCount = 0;

        // 2. Sync concurrently with limit
        const promises = allEtfs.map((etf) => limit(async () => {
            try {
                await syncEtfDetails(etf.ticker);
                successCount++;
                return { ticker: etf.ticker, status: 'success' };
            } catch (error: any) {
                console.error(`Failed to sync ${etf.ticker}:`, error);
                failureCount++;
                return { ticker: etf.ticker, status: 'error', error: error.message };
            }
        }));

        const results = await Promise.all(promises);

        return NextResponse.json({
            message: `Sync complete. Success: ${successCount}, Failed: ${failureCount}`,
            results
        });

    } catch (error) {
        console.error('Error in bulk sync:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
