import yahooFinance from 'yahoo-finance2';

export interface SectorWeighting {
  sector_name: string;
  weight: number;
}

export async function fetchSectorWeightings(ticker: string): Promise<SectorWeighting[]> {
  try {
    const queryOptions = { modules: ['fundProfile', 'topHoldings'] };
    // @ts-ignore - yahoo-finance2 types might be tricky with modules
    const yf = new yahooFinance();
    const quoteSummary: any = await yf.quoteSummary(ticker, queryOptions);

    let sectors: SectorWeighting[] = [];

    // Try fundProfile (most ETFs)
    if (quoteSummary.fundProfile && quoteSummary.fundProfile.sectorWeightings) {
      sectors = quoteSummary.fundProfile.sectorWeightings.map((s: any) => ({
        sector_name: s.sector,
        weight: (s.weight || 0) * 100 // Convert decimal to percent
      }));
    }
    // Try topHoldings (sometimes contains sector weightings)
    else if (quoteSummary.topHoldings && quoteSummary.topHoldings.sectorWeightings) {
      sectors = quoteSummary.topHoldings.sectorWeightings.map((s: any) => ({
        sector_name: s.sector,
        weight: (s.weight || 0) * 100
      }));
    }

    // Filter out zero weights
    return sectors.filter(s => s.weight > 0);
  } catch (error) {
    console.error(`Error fetching sector weightings for ${ticker} via yahoo-finance2:`, error);
    return [];
  }
}
