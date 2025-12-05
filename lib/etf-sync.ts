import prisma from '@/lib/db'
import { fetchEtfDetails } from '@/lib/market-service'

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
    let stocks_weight = 100;
    let bonds_weight = 0;
    let cash_weight = 0;

    if (details.assetType === 'ETF') {
      if (details.name.toLowerCase().includes('bond') || details.description.toLowerCase().includes('bond')) {
        stocks_weight = 0;
        bonds_weight = 100;
      }
    }

    // 3. Upsert ETF Record
    const etf = await prisma.etf.upsert({
      where: { ticker: details.ticker },
      update: {
        price: details.price,
        daily_change: 0,
        yield: details.dividendYield,
        mer: details.expenseRatio,
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
        price: details.price,
        daily_change: 0,
        yield: details.dividendYield,
        mer: details.expenseRatio,
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
          weight: weight
        }))
      });
    }

    // 4.5 Update Holdings
    if (details.holdings && details.holdings.length > 0) {
      await prisma.etfHolding.deleteMany({
        where: { etfId: etf.ticker }
      });

      await prisma.etfHolding.createMany({
        data: details.holdings.map((h) => ({
          etfId: etf.ticker,
          symbol: h.symbol,
          name: h.name,
          weight: h.weight
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
          close: h.close,
          interval: h.interval || '1d'
        })),
        skipDuplicates: true
      });
    }

    const fullEtf = await prisma.etf.findUnique({
      where: { ticker: etf.ticker },
      include: {
        history: { orderBy: { date: 'asc' } },
        sectors: true,
        holdings: true,
        allocation: true,
      }
    });

    console.log(`[EtfSync] Sync complete for ${etf.ticker}`);
    return fullEtf;

  } catch (error) {
    console.error(`[EtfSync] Failed to sync ${ticker}:`, error);
    return null;
  }
}
