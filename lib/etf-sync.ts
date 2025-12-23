import prisma from '@/lib/db'
import { fetchEtfDetails } from '@/lib/market-service'
import { getEtfHoldings } from '@/lib/scrapers/stock-analysis'
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { YahooFinance } from 'yahoo-finance2';

const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
});

export type FullEtf = Prisma.EtfGetPayload<{
  include: {
    history: true;
    sectors: true;
    allocation: true;
    holdings: true;
  }
}>;

export async function syncEtfDetails(ticker: string): Promise<FullEtf | null> {
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
    const details = await fetchEtfDetails(ticker, fromDate);

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

    // 3. Upsert ETF Record
    const etf = await prisma.etf.upsert({
      where: { ticker: details.ticker },
      update: {
        price: details.price, // Decimal
        daily_change: details.dailyChange, // Decimal
        yield: details.dividendYield || null, // Decimal | null
        mer: details.expenseRatio || null, // Decimal | null
        beta5Y: details.beta5Y || null,
        peRatio: details.peRatio || null,
        forwardPe: details.forwardPe || null,
        fiftyTwoWeekHigh: details.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: details.fiftyTwoWeekLow || null,
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
        price: details.price, // Decimal
        daily_change: details.dailyChange, // Decimal
        yield: details.dividendYield || null,
        mer: details.expenseRatio || null,
        beta5Y: details.beta5Y || null,
        peRatio: details.peRatio || null,
        forwardPe: details.forwardPe || null,
        fiftyTwoWeekHigh: details.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: details.fiftyTwoWeekLow || null,
        assetType: details.assetType,
        isDeepAnalysisLoaded: true,
      }
    });

    console.log(`[EtfSync] Upserted base record for ${etf.ticker}`);

    // Parallelize child relation updates
    await Promise.all([
      // 4. Update Sectors
      (async () => {
        if (Object.keys(details.sectors).length > 0) {
          await prisma.etfSector.deleteMany({ where: { etfId: etf.ticker } });
          await prisma.etfSector.createMany({
            data: Object.entries(details.sectors).map(([sector, weight]) => ({
              etfId: etf.ticker,
              sector_name: sector,
              weight: weight // Decimal
            }))
          });
        }
      })(),

      // 5. Update Allocation
      (async () => {
        const existingAlloc = await prisma.etfAllocation.findUnique({ where: { etfId: etf.ticker } });
        if (existingAlloc) {
          await prisma.etfAllocation.update({
            where: { etfId: etf.ticker },
            data: { stocks_weight, bonds_weight, cash_weight }
          });
        } else {
          await prisma.etfAllocation.create({
            data: { etfId: etf.ticker, stocks_weight, bonds_weight, cash_weight }
          });
        }
      })(),

      // 6. Update History
      (async () => {
        if (details.history && details.history.length > 0) {
          // Separate daily from others
          const dailyHistory = details.history.filter((h: any) => h.interval === '1d');
          const otherHistory = details.history.filter((h: any) => h.interval !== '1d');

          // Delete non-daily history (replace strategy)
          await prisma.etfHistory.deleteMany({
            where: {
                etfId: etf.ticker,
                interval: { not: '1d' }
            }
          });

          // Insert non-daily history
          if (otherHistory.length > 0) {
              await prisma.etfHistory.createMany({
                data: otherHistory.map((h: any) => ({
                    etfId: etf.ticker,
                    date: new Date(h.date),
                    close: h.close,
                    interval: h.interval
                }))
              });
          }

          // Append daily history (skip duplicates)
          if (dailyHistory.length > 0) {
              await prisma.etfHistory.createMany({
                data: dailyHistory.map((h: any) => ({
                    etfId: etf.ticker,
                    date: new Date(h.date),
                    close: h.close,
                    interval: '1d'
                })),
                skipDuplicates: true
              });
          }
        }
      })(),

      // 7. Update Holdings
      (async () => {
        let holdingsSynced = false;

        // Try StockAnalysis.com first
        try {
            const scrapedHoldings = await getEtfHoldings(etf.ticker);
            if (scrapedHoldings.length > 0) {
                console.log(`[EtfSync] Using StockAnalysis.com holdings for ${etf.ticker} (${scrapedHoldings.length} items)...`);

                // Create a sector map from Yahoo data if available to enrich scraped data
                const sectorMap = new Map<string, string>();

                // 1. Try to get sectors from Yahoo top holdings (usually empty but good to check)
                if (details.topHoldings) {
                    details.topHoldings.forEach(h => {
                        if (h.ticker && h.sector) {
                            sectorMap.set(h.ticker, h.sector);
                        }
                    });
                }

                // 2. Fetch sectors for top 50 holdings to ensure we have data for the most important assets
                // We limit to 50 to avoid timeouts/rate-limits
                const topTickers = scrapedHoldings
                    .sort((a, b) => b.weight - a.weight)
                    .slice(0, 50)
                    .map(h => h.symbol)
                    .filter(s => !sectorMap.has(s) && s !== 'N/A' && !s.includes(' ')); // Filter out invalid tickers

                if (topTickers.length > 0) {
                    console.log(`[EtfSync] Fetching sectors for ${topTickers.length} top holdings...`);
                    // Process in chunks of 10
                    const chunkSize = 10;
                    for (let i = 0; i < topTickers.length; i += chunkSize) {
                        const chunk = topTickers.slice(i, i + chunkSize);
                        await Promise.all(chunk.map(async (t) => {
                            try {
                                const summary = await yf.quoteSummary(t, { modules: ['summaryProfile'] });
                                if (summary.summaryProfile?.sector) {
                                    sectorMap.set(t, summary.summaryProfile.sector);
                                }
                            } catch (e) {
                                // Ignore failures for individual tickers
                            }
                        }));
                    }
                }

                await prisma.$transaction([
                    prisma.holding.deleteMany({ where: { etfId: etf.ticker } }),
                    prisma.holding.createMany({
                        data: scrapedHoldings.map(h => ({
                            etfId: etf.ticker,
                            ticker: h.symbol,
                            name: h.name,
                            sector: sectorMap.get(h.symbol) || 'Unknown',
                            weight: h.weight,
                            shares: h.shares ? new Decimal(h.shares) : null
                        }))
                    })
                ]);
                console.log(`[EtfSync] Synced ${scrapedHoldings.length} holdings for ${etf.ticker} (StockAnalysis)`);
                holdingsSynced = true;
            }
        } catch (saError) {
            console.error(`[EtfSync] Failed to sync StockAnalysis holdings for ${etf.ticker}`, saError);
        }

        // Fallback to Yahoo Finance if StockAnalysis failed or returned no data
        if (!holdingsSynced && details.topHoldings && details.topHoldings.length > 0) {
          try {
            console.log(`[EtfSync] Using Yahoo Finance top holdings for ${etf.ticker}...`);
            await prisma.$transaction([
                prisma.holding.deleteMany({ where: { etfId: etf.ticker } }),
                prisma.holding.createMany({
                    data: details.topHoldings.map(h => ({
                        etfId: etf.ticker,
                        ticker: h.ticker,
                        name: h.name,
                        sector: h.sector || 'Unknown',
                        weight: h.weight,
                        shares: null // Yahoo doesn't provide share counts
                    }))
                })
            ]);
            console.log(`[EtfSync] Synced ${details.topHoldings.length} holdings for ${etf.ticker} (Yahoo)`);
          } catch (yhError) {
             console.error(`[EtfSync] Failed to sync Yahoo holdings for ${etf.ticker}`, yhError);
          }
        }
      })()
    ]);

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
