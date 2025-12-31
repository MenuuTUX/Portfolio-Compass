import prisma from '@/lib/db'
import { fetchEtfDetails } from '@/lib/market-service'
import { getEtfHoldings } from '@/lib/scrapers/stock-analysis'
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { toPrismaDecimal, toPrismaDecimalRequired } from '@/lib/prisma-utils';

export type FullEtf = Prisma.EtfGetPayload<{
  include: {
    history: true;
    sectors: true;
    allocation: true;
    holdings: true;
  }
}>;

// Helper to retry transactions
async function runTransactionWithRetry<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options: { timeout?: number, maxWait?: number } = {},
    retries = 3
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await prisma.$transaction(fn, options);
        } catch (error: any) {
            lastError = error;
            // Retry on specific transaction errors
            if (error.code === 'P2028' || // Transaction API error
                error.message.includes('Unable to start a transaction') ||
                error.message.includes('Transaction already closed')) {
                console.warn(`[EtfSync] Transaction failed (attempt ${i + 1}/${retries}), retrying...`);
                await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Linear backoff
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}


export async function syncEtfDetails(
  ticker: string,
  intervals?: ('1h' | '1d' | '1wk' | '1mo')[]
): Promise<FullEtf | null> {
  try {
    console.log(`[EtfSync] Starting sync for ${ticker}...`);

    // 0. Check Existing Data to determine fromDate
    const latestHistory = await prisma.etfHistory.findFirst({
      where: {
        etfId: ticker,
        interval: '1d'
      },
      orderBy: {
        date: 'desc'
      }
    });

    let fromDate: Date | undefined;
    if (latestHistory) {
      fromDate = new Date(latestHistory.date);
      fromDate.setDate(fromDate.getDate() + 1); // Start from next day
      console.log(`[EtfSync] Found existing history for ${ticker}, fetching from ${fromDate.toISOString()}`);
    } else {
        console.log(`[EtfSync] No existing history for ${ticker}, fetching full history`);
    }

    // 1. Fetch deep details from Yahoo
    const details = await fetchEtfDetails(ticker, fromDate, intervals);

    if (!details) {
      console.error(`[EtfSync] No details found for ${ticker}`);
      return null;
    }

    // 2. Normalize Allocation
    let stocks_weight = new Decimal(100);
    let bonds_weight = new Decimal(0);
    let cash_weight = new Decimal(0);

    if (details.assetType === 'ETF') {
      if (details.name.toLowerCase().includes('bond') || details.description.toLowerCase().includes('bond')) {
        stocks_weight = new Decimal(0);
        bonds_weight = new Decimal(100);
      }
    }

    // 3. Upsert ETF Record (Lightweight)
    let etf;
    try {
         etf = await prisma.etf.upsert({
            where: { ticker: details.ticker },
            update: {
                price: toPrismaDecimalRequired(details.price),
                daily_change: toPrismaDecimalRequired(details.dailyChange),
                yield: toPrismaDecimal(details.dividendYield),
                mer: toPrismaDecimal(details.expenseRatio),
                beta5Y: toPrismaDecimal(details.beta5Y),
                peRatio: toPrismaDecimal(details.peRatio),
                forwardPe: toPrismaDecimal(details.forwardPe),
                fiftyTwoWeekHigh: toPrismaDecimal(details.fiftyTwoWeekHigh),
                fiftyTwoWeekLow: toPrismaDecimal(details.fiftyTwoWeekLow),

                // Extended Metrics
                marketCap: toPrismaDecimal(details.marketCap),
                sharesOut: toPrismaDecimal(details.sharesOutstanding),
                eps: toPrismaDecimal(details.eps),
                revenue: toPrismaDecimal(details.revenue),
                netIncome: toPrismaDecimal(details.netIncome),
                dividend: toPrismaDecimal(details.dividend),
                dividendGrowth5Y: toPrismaDecimal(details.dividendGrowth5Y),
                exDividendDate: details.exDividendDate || null,
                volume: toPrismaDecimal(details.volume),
                open: toPrismaDecimal(details.open),
                prevClose: toPrismaDecimal(details.previousClose),
                earningsDate: details.earningsDate || null,
                daysRange: details.daysRange || null,
                fiftyTwoWeekRange: details.fiftyTwoWeekRange || null,

                // New ETF Metrics
                inceptionDate: details.inceptionDate || null,
                payoutFrequency: details.payoutFrequency || null,
                payoutRatio: toPrismaDecimal(details.payoutRatio),
                holdingsCount: details.holdingsCount || null,

                // Social
                redditUrl: details.redditUrl || null,

                name: details.name,
                currency: 'USD',
                exchange: 'Unknown',
                assetType: details.assetType,
                isDeepAnalysisLoaded: true,
            },
            create: {
                ticker: details.ticker,
                name: details.name,
                currency: 'USD',
                exchange: 'Unknown',
                price: toPrismaDecimalRequired(details.price),
                daily_change: toPrismaDecimalRequired(details.dailyChange),
                yield: toPrismaDecimal(details.dividendYield),
                mer: toPrismaDecimal(details.expenseRatio),
                beta5Y: toPrismaDecimal(details.beta5Y),
                peRatio: toPrismaDecimal(details.peRatio),
                forwardPe: toPrismaDecimal(details.forwardPe),
                fiftyTwoWeekHigh: toPrismaDecimal(details.fiftyTwoWeekHigh),
                fiftyTwoWeekLow: toPrismaDecimal(details.fiftyTwoWeekLow),

                // Extended Metrics
                marketCap: toPrismaDecimal(details.marketCap),
                sharesOut: toPrismaDecimal(details.sharesOutstanding),
                eps: toPrismaDecimal(details.eps),
                revenue: toPrismaDecimal(details.revenue),
                netIncome: toPrismaDecimal(details.netIncome),
                dividend: toPrismaDecimal(details.dividend),
                exDividendDate: details.exDividendDate || null,
                volume: toPrismaDecimal(details.volume),
                open: toPrismaDecimal(details.open),
                prevClose: toPrismaDecimal(details.previousClose),
                earningsDate: details.earningsDate || null,
                daysRange: details.daysRange || null,
                fiftyTwoWeekRange: details.fiftyTwoWeekRange || null,

                // New ETF Metrics
                inceptionDate: details.inceptionDate || null,
                payoutFrequency: details.payoutFrequency || null,
                payoutRatio: toPrismaDecimal(details.payoutRatio),
                holdingsCount: details.holdingsCount || null,

                // Social
                redditUrl: details.redditUrl || null,

                assetType: details.assetType,
                isDeepAnalysisLoaded: true,
            }
        });
    } catch (upsertError: any) {
        // Fallback Logic if DB is totally dead
         if (upsertError.toString().includes('DriverAdapterError') || upsertError.toString().includes('Can\'t reach database server')) {
             console.warn(`[EtfSync] DB Unreachable for upsert. Returning live fallback object for ${ticker}.`);
             throw upsertError; // Re-throw to be caught by outer catch block which constructs fallback
         }
         throw upsertError;
    }


    console.log(`[EtfSync] Upserted base record for ${etf.ticker}`);

    // 4 & 5. Update Sectors & Allocation (Separate Transaction - Fast)
    await runTransactionWithRetry(async (tx) => {
        // Sectors
        if (Object.keys(details.sectors).length > 0) {
            await tx.etfSector.deleteMany({ where: { etfId: etf.ticker } });
            await tx.etfSector.createMany({
                data: Object.entries(details.sectors).map(([sector, weight]) => ({
                    etfId: etf.ticker,
                    sector_name: sector,
                    weight: toPrismaDecimalRequired(weight)
                }))
            });
        }

        // Allocation
        await tx.etfAllocation.upsert({
            where: { etfId: etf.ticker },
            update: {
                stocks_weight: toPrismaDecimalRequired(stocks_weight),
                bonds_weight: toPrismaDecimalRequired(bonds_weight),
                cash_weight: toPrismaDecimalRequired(cash_weight)
            },
            create: {
                etfId: etf.ticker,
                stocks_weight: toPrismaDecimalRequired(stocks_weight),
                bonds_weight: toPrismaDecimalRequired(bonds_weight),
                cash_weight: toPrismaDecimalRequired(cash_weight)
            }
        });
    }, {
        timeout: 10000 // 10s is plenty for this
    });

    // 6. Update History (Separate Transaction - Heavy)
    // We split this to release the DB connection after metadata update and before heavy history processing
    if (details.history && details.history.length > 0) {
        await runTransactionWithRetry(async (tx) => {
            // Identify which intervals we have in the new data
            const fetchedIntervals = new Set(details.history.map((h: any) => h.interval));
            const dailyHistory = details.history.filter((h: any) => h.interval === '1d');

            // Determine which non-daily intervals were fetched and need replacement
            // We only replace intervals that were actually returned by the fetch
            const intervalsToReplace = Array.from(fetchedIntervals).filter(i => i !== '1d');

            if (intervalsToReplace.length > 0) {
                // Delete only the intervals we are about to replace
                await tx.etfHistory.deleteMany({
                    where: {
                        etfId: etf.ticker,
                        interval: { in: intervalsToReplace }
                    }
                });

                const otherHistory = details.history.filter((h: any) => h.interval !== '1d');

                if (otherHistory.length > 0) {
                    await tx.etfHistory.createMany({
                        data: otherHistory.map((h: any) => ({
                            etfId: etf.ticker,
                            date: new Date(h.date),
                            close: toPrismaDecimalRequired(h.close),
                            interval: h.interval
                        }))
                    });
                }
            }

            // Append daily history (skip duplicates)
            if (dailyHistory.length > 0) {
                // Fix: Delete overlapping dates to ensure updates (e.g., price changes for today) are reflected
                const dates = dailyHistory.map((h: any) => new Date(h.date));
                // Optimization: If dates array is huge (>2000), 'in' clause might be slow.
                // But for incremental sync it's small.
                // For full sync, we might just delete all for '1d' if fromDate is undefined?
                // But let's stick to safe logic.

                if (dates.length > 0) {
                    await tx.etfHistory.deleteMany({
                        where: {
                            etfId: etf.ticker,
                            interval: '1d',
                            date: { in: dates }
                        }
                    });
                }

                await tx.etfHistory.createMany({
                    data: dailyHistory.map((h: any) => ({
                        etfId: etf.ticker,
                        date: new Date(h.date),
                        close: toPrismaDecimalRequired(h.close),
                        interval: '1d'
                    })),
                    skipDuplicates: true
                });
            }
        }, {
            timeout: 60000, // 60s for history
            maxWait: 20000
        });
    }

    // 7. Update Holdings (Separate Transaction)
    let holdingsSynced = false;

    // Try StockAnalysis.com first (Only for ETFs)
    if (etf.assetType === 'ETF') {
      try {
          const scrapedHoldings = await getEtfHoldings(etf.ticker);
          if (scrapedHoldings.length > 0) {
              console.log(`[EtfSync] Using StockAnalysis.com holdings for ${etf.ticker} (${scrapedHoldings.length} items)...`);

            // Create a sector map from Yahoo data if available to enrich scraped data
            const sectorMap = new Map<string, string>();
            if (details.topHoldings) {
                details.topHoldings.forEach(h => {
                    if (h.ticker && h.sector) {
                        sectorMap.set(h.ticker, h.sector);
                    }
                });
            }

            // Use interactive transaction for holdings update
            await runTransactionWithRetry(async (tx) => {
                  await tx.holding.deleteMany({ where: { etfId: etf.ticker } });
                  await tx.holding.createMany({
                      data: scrapedHoldings.map(h => ({
                          etfId: etf.ticker,
                          ticker: h.symbol,
                          name: h.name,
                          sector: sectorMap.get(h.symbol) || 'Unknown',
                          // Normalize StockAnalysis decimal weights (0.05) to percentage (5.0) to match Yahoo
                          weight: toPrismaDecimalRequired(new Decimal(h.weight).mul(100)),
                          shares: toPrismaDecimal(h.shares ? new Decimal(h.shares) : null)
                      }))
                  });
              }, {
                timeout: 30000
              });
              console.log(`[EtfSync] Synced ${scrapedHoldings.length} holdings for ${etf.ticker} (StockAnalysis)`);
              holdingsSynced = true;
          }
      } catch (saError) {
          console.error(`[EtfSync] Failed to sync StockAnalysis holdings for ${etf.ticker}`, saError);
      }
    }

    // Fallback to Yahoo Finance if StockAnalysis failed or returned no data
    // Only fetch holdings for ETFs
    if (etf.assetType === 'ETF' && !holdingsSynced && details.topHoldings && details.topHoldings.length > 0) {
      try {
        console.log(`[EtfSync] Using Yahoo Finance top holdings for ${etf.ticker}...`);
        // Use interactive transaction for holdings update
        await runTransactionWithRetry(async (tx) => {
            await tx.holding.deleteMany({ where: { etfId: etf.ticker } });
            await tx.holding.createMany({
                data: details.topHoldings!.map(h => ({
                    etfId: etf.ticker,
                    ticker: h.ticker,
                    name: h.name,
                    sector: h.sector || 'Unknown',
                    weight: toPrismaDecimalRequired(h.weight),
                    shares: null // Yahoo doesn't provide share counts
                }))
            });
        });
        console.log(`[EtfSync] Synced ${details.topHoldings.length} holdings for ${etf.ticker} (Yahoo)`);
      } catch (yhError) {
         console.error(`[EtfSync] Failed to sync Yahoo holdings for ${etf.ticker}`, yhError);
      }
    }

    const fullEtf = await prisma.etf.findUnique({
      where: { ticker: etf.ticker },
      include: {
        history: { orderBy: { date: 'asc' } },
        sectors: true,
        allocation: true,
        holdings: true,
      }
    });

    // Explicitly cast the result to ensure it matches the FullEtf type
    // This handles the case where findUnique returns null, or the type inference is slightly off
    if (!fullEtf) return null;
    return fullEtf as FullEtf;

  } catch (error) {
    console.error(`[EtfSync] Failed to sync ${ticker}:`, error);
    return null;
  }
}
