import YahooFinance from "yahoo-finance2";
import { z } from "zod";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface SectorWeighting {
  sector_name: string;
  weight: number;
}

const SectorWeightingsSchema = z.array(z.record(z.string(), z.number()));
const QuoteSummarySchema = z.object({
  fundProfile: z.object({ sectorWeightings: SectorWeightingsSchema.optional() }).optional(),
  topHoldings: z.object({ sectorWeightings: SectorWeightingsSchema.optional() }).optional(),
  summaryProfile: z.object({ sector: z.string().optional() }).optional(),
});

export async function fetchSectorWeightings(
  ticker: string,
): Promise<SectorWeighting[]> {
  try {
    const rawSummary = await yahooFinance.quoteSummary(ticker, {
      modules: ["fundProfile", "topHoldings", "summaryProfile"],
    });
    const quoteSummary = QuoteSummarySchema.parse(rawSummary);

    let sectors: SectorWeighting[] = [];

    // Helper to parse sector weightings from the array of objects format
    // format: [{ realestate: 0.0187 }, { technology: 0.3529 }, ...]
    const parseSectorWeightings = (weightings: Record<string, number>[]) => {
      return weightings
        .map((w) => {
          const keys = Object.keys(w);
          if (keys.length === 0) return null;
          const sectorName = keys[0];
          return {
            sector_name: sectorName,
            weight: (w[sectorName] || 0) * 100,
          };
        })
        .filter((s): s is SectorWeighting => s !== null);
    };

    // Try fundProfile (most ETFs)
    if (quoteSummary.fundProfile && quoteSummary.fundProfile.sectorWeightings) {
      sectors = parseSectorWeightings(
        quoteSummary.fundProfile.sectorWeightings,
      );
    }
    // Try topHoldings (sometimes contains sector weightings)
    else if (
      quoteSummary.topHoldings &&
      quoteSummary.topHoldings.sectorWeightings
    ) {
      sectors = parseSectorWeightings(
        quoteSummary.topHoldings.sectorWeightings,
      );
    }
    // Try summaryProfile (Stocks)
    else if (
      quoteSummary.summaryProfile &&
      quoteSummary.summaryProfile.sector
    ) {
      sectors = [
        {
          sector_name: quoteSummary.summaryProfile.sector,
          weight: 100,
        },
      ];
    }

    // Filter out zero weights
    return sectors.filter((s) => s.weight > 0);
  } catch (error) {
    console.error(
      `Error fetching sector weightings for ${ticker} via yahoo-finance2:`,
      error,
    );
    return [];
  }
}
