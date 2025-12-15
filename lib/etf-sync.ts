import prisma from '@/lib/db'
import { fetchEtfDetails } from '@/lib/market-service'
import { Decimal } from 'decimal.js';
import { fetchISharesHoldings, isSupportedIShares } from '@/lib/scrapers/ishares';
import { scrapeETFDBHoldings } from '@/lib/scrapers/etfdb';

export async function syncEtfDetails(ticker: string) {
  try {
    console.log(`[EtfSync] Starting sync for ${ticker}...`);

    // 1. Fetch deep details from Yahoo
    const details = await fetchEtfDetails(ticker);

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
        assetType: details.assetType,
        isDeepAnalysisLoaded: true,
      }
    });

    console.log(`[EtfSync] Upserted base record for ${etf.ticker}`);

    // 4. Update Sectors
    if (Object.keys(details.sectors).length > 0) {
      await prisma.etfSector.deleteMany({
        where: { etfId: etf.ticker }
      });

      await prisma.etfSector.createMany({
        data: Object.entries(details.sectors).map(([sector, weight]) => ({
          etfId: etf.ticker,
          sector_name: sector,
          weight: weight // Decimal
        }))
      });
    }

    // 5. Update Allocation
    const existingAlloc = await prisma.etfAllocation.findUnique({
      where: { etfId: etf.ticker }
    });

    if (existingAlloc) {
      await prisma.etfAllocation.update({
        where: { etfId: etf.ticker },
        data: {
          stocks_weight,
          bonds_weight,
          cash_weight
        }
      });
    } else {
      await prisma.etfAllocation.create({
        data: {
          etfId: etf.ticker,
          stocks_weight,
          bonds_weight,
          cash_weight
        }
      });
    }

    // 6. Update History
    if (details.history && details.history.length > 0) {
      await prisma.etfHistory.deleteMany({
        where: { etfId: etf.ticker }
      });

      await prisma.etfHistory.createMany({
        data: details.history.map((h: any) => ({
          etfId: etf.ticker,
          date: new Date(h.date),
          close: h.close, // Decimal
          interval: h.interval || '1d'
        })),
        skipDuplicates: true
      });
    }

    // 7. Update Holdings
    try {
      let holdings: any[] = [];

      // Strategy 1: iShares Direct Scraper (High Fidelity)
      if (isSupportedIShares(etf.ticker)) {
        console.log(`[EtfSync] Fetching holdings for iShares ETF ${etf.ticker}...`);
        try {
           holdings = await fetchISharesHoldings(etf.ticker);
        } catch (err) {
           console.warn(`[EtfSync] iShares scrape failed for ${etf.ticker}, falling back...`);
        }
      }

      // Strategy 2: ETFDB Scraper (General Coverage)
      if (holdings.length === 0) {
         console.log(`[EtfSync] Fetching holdings from ETFDB for ${etf.ticker}...`);
         const scraped = await scrapeETFDBHoldings(etf.ticker);
         if (scraped.length > 0) {
            holdings = scraped.map(s => ({
              ticker: s.symbol,
              name: s.name,
              weight: s.weight,
              sector: 'Unknown',
              shares: null
            }));
         }
      }

      // Persist if we found anything
      if (holdings.length > 0) {
          await prisma.$transaction([
            prisma.holding.deleteMany({
              where: { etfId: etf.ticker }
            }),
            prisma.holding.createMany({
              data: holdings.map(h => ({
                  etfId: etf.ticker,
                  ticker: h.ticker,
                  name: h.name,
                  sector: h.sector || null,
                  weight: h.weight,
                  shares: h.shares || null
              }))
            })
          ]);
          console.log(`[EtfSync] Synced ${holdings.length} holdings for ${etf.ticker}`);
      } else {
          console.log(`[EtfSync] No holdings found for ${etf.ticker}`);
      }

    } catch (holdingsError) {
      console.error(`[EtfSync] Failed to sync holdings for ${etf.ticker}`, holdingsError);
      // Non-blocking
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

    console.log(`[EtfSync] Sync complete for ${etf.ticker}`);
    return fullEtf;

  } catch (error) {
    console.error(`[EtfSync] Failed to sync ${ticker}:`, error);
    return null;
  }
}
