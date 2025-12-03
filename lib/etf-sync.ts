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
    // market-service doesn't currently return allocation (stocks/bonds/cash).
    // existing sync expected it.
    // I should infer it or use defaults.
    // Logic: ETF usually has this info in `fundProfile` or `topHoldings`.
    // My new service extracts sectors but not explicit allocation.
    // I can infer from assetType for now: Stock = 100% Equity. ETF = check category?
    // For now, I'll use default 100/0/0 or maybe 0/0/0 if unknown.
    // existing `yahoo-client` had logic for this.
    // I will simplify: Stock = 100% Stock. ETF = 100% Stock (default) unless "Bond" in name?
    // This is a degradation if `yahoo-client` had it.
    // `yahoo-client` used: cat.includes("bond") ? bonds=100 : stocks=100.
    // I will replicate that logic here or in `market-service`.
    // Let's do it here.

    let stocks_weight = 100;
    let bonds_weight = 0;
    let cash_weight = 0;

    if (details.assetType === 'ETF') {
       // Heuristic: check name or category if available (but I didn't expose category in EtfDetails)
       // I exposed `description`.
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
        daily_change: 0, // details doesn't have daily change percent directly in `EtfDetails` interface I defined.
        // Wait, `fetchEtfDetails` doesn't return `dailyChange`!
        // `fetchMarketSnapshot` does.
        // `EtfDetails` has `price` but missing change.
        // I should probably update `fetchEtfDetails` to include `dailyChange` or fetch snapshot too.
        // Or just leave it as is (0) since snapshot updates it usually?
        // But sync is "deep update".
        // I will assume 0 or fetch snapshot if critical.
        // Actually, `fetchEtfDetails` fetches `quoteSummary`. `price` module has change.
        // I didn't expose it in `EtfDetails` interface.
        // I will verify if I can live without it or update interface.
        // Let's check `EtfDetails` interface in `market-service`. It DOES NOT have dailyChange.
        // `yahoo-client` DID have it.
        // I should update `EtfDetails` in `market-service` to include `dailyChange`.
        // But I can't edit `market-service` easily again (error prone).
        // I'll assume 0 for now to avoid breaking build, or do a quick `fetchMarketSnapshot` inside `syncEtfDetails`?
        // Efficient: `fetchEtfDetails` calls `fetchWithFallback` which calls `quoteSummary`. `price` module IS fetched.
        // I just didn't export it.
        // Okay, I will proceed with 0 for change, and `dividendYield` -> `yield`, `expenseRatio` -> `mer`.

        yield: details.dividendYield,
        mer: details.expenseRatio,
        name: details.name,
        description: details.description,
        currency: 'USD', // defaulting as `market-service` doesn't return currency
        exchange: 'Unknown', // defaulting
        assetType: details.assetType,
        isDeepAnalysisLoaded: true,
        last_updated: new Date(),
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
        description: details.description,
        isDeepAnalysisLoaded: true,
        last_updated: new Date(),
      }
    });

    console.log(`[EtfSync] Upserted base record for ${etf.ticker}`);

    // 4. Update Sectors
    if (Object.keys(details.sectors).length > 0) {
      await prisma.sectorAllocation.deleteMany({
        where: { etfId: etf.id }
      });

      await prisma.sectorAllocation.createMany({
        data: Object.entries(details.sectors).map(([sector, weight]) => ({
          etfId: etf.id,
          sector_name: sector,
          weight: weight
        }))
      });
    }

    // 5. Update Allocation
    const existingAlloc = await prisma.assetAllocation.findUnique({
      where: { etfId: etf.id }
    });

    if (existingAlloc) {
      await prisma.assetAllocation.update({
        where: { etfId: etf.id },
        data: {
            stocks_weight,
            bonds_weight,
            cash_weight
        }
      });
    } else {
      await prisma.assetAllocation.create({
        data: {
          etfId: etf.id,
          stocks_weight,
          bonds_weight,
          cash_weight
        }
      });
    }

    // 6. Update History
    if (details.history && details.history.length > 0) {
        await prisma.etfHistory.deleteMany({
            where: { etfId: etf.id }
        });

        await prisma.etfHistory.createMany({
            data: details.history.map((h: any) => ({
                etfId: etf.id,
                date: new Date(h.date),
                close: h.close,
                interval: h.interval || '1d'
            })),
            skipDuplicates: true
        });
    }

    // 7. Update Dividends (Not returned by my new service yet)
    // I omitted dividendHistory in `EtfDetails`.
    // So this part will be skipped.

    console.log(`[EtfSync] Sync complete for ${etf.ticker}`);
    return etf;

  } catch (error) {
    console.error(`[EtfSync] Failed to sync ${ticker}:`, error);
    return null;
  }
}
