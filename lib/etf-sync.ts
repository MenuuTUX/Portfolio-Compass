import { execFile } from 'child_process';
import path from 'path';
import { fetchSectorWeightings } from '@/lib/sector-utils';
import prisma from '@/lib/db';

export async function syncEtf(ticker: string) {
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
    const data = JSON.parse(result);

    if (data.error) {
        if (data.error.includes("Ticker not found")) {
            console.log(`Ticker ${ticker} not found, deleting from database...`);
            await prisma.etf.delete({ where: { ticker } });
            throw new Error('Ticker not found');
        }
        throw new Error(data.error);
    }

    // Fetch sectors via Node.js helper (yahoo-finance2)
    // This provides a fallback/better source if Python script fails to get sectors
    let nodeSectors: any[] = [];
    try {
        nodeSectors = await fetchSectorWeightings(ticker);
        console.log(`Fetched ${nodeSectors.length} sectors via yahoo-finance2`);
    } catch (e) {
        console.warn("Failed to fetch sectors via node:", e);
    }

    // Merge sectors: Prefer Node sectors if available, otherwise fallback to Python sectors
    const finalSectors = nodeSectors.length > 0 ? nodeSectors : data.sectors;

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
        throw new Error('ETF not found after sync');
    }

    return fullEtf;
}
