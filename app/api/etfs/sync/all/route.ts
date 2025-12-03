import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { syncEtf } from '@/lib/etf-sync';

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

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        // 2. Sync each one
        // We do this sequentially to avoid overwhelming the system/rate limits, 
        // or we could do small batches. Let's do sequential for safety first.
        for (const etf of allEtfs) {
            try {
                await syncEtf(etf.ticker);
                results.push({ ticker: etf.ticker, status: 'success' });
                successCount++;
            } catch (error: any) {
                console.error(`Failed to sync ${etf.ticker}:`, error);
                results.push({ ticker: etf.ticker, status: 'error', error: error.message });
                failureCount++;
            }
        }

        return NextResponse.json({
            message: `Sync complete. Success: ${successCount}, Failed: ${failureCount}`,
            results
        });

    } catch (error) {
        console.error('Error in bulk sync:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
