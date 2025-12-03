import prisma from '@/lib/db';
import { fetchEtfDetails } from '@/lib/yahoo-client';

export async function syncEtf(ticker: string) {
    console.log(`Syncing details for ${ticker}...`);

    const data = await fetchEtfDetails(ticker);

    if (!data) {
        // If fetch returns null/error, consider it "not found" or "error"
        // If it was meant to be deleted if not found:
        // We can check if we should delete it.
        // The old script threw "Ticker not found" if it failed.
        // Let's assume if it returns null, it failed.
        console.error(`Failed to fetch details for ${ticker}`);
        throw new Error('Ticker not found or API error');
    }

    // The logic to "fetchSectorWeightings" from sector-utils seems redundant now
    // because fetchEtfDetails already handles sectors (using yahoo-finance2).
    // The old code did a "merge" preferring node sectors.
    // Our new `fetchEtfDetails` IS the node sectors logic.
    // So we can just use `data.sectors`.

    const finalSectors = data.sectors;

    // Update DB
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
        if (finalSectors && finalSectors.length > 0) {
            await tx.etfSector.createMany({
                data: finalSectors.map((s: any) => ({
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
        throw new Error('ETF not found after sync');
    }

    return fullEtf;
}
