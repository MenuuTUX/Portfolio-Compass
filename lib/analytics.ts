/**
 * Holdings overlap math with no database dependency.
 * Pass holdings already loaded on the client (or from live ETF details).
 */

export interface HoldingWeight {
  ticker: string;
  name: string;
  /** Weight as a percentage or fraction. Both inputs must use the same unit. */
  weight: number;
}

interface OverlapResult {
  overlapScore: number;
  commonHoldings: CommonHolding[];
}

interface CommonHolding {
  ticker: string;
  name: string;
  weightInA: number;
  weightInB: number;
}

/**
 * Calculate portfolio overlap between two holdings lists.
 */
export function calculateOverlapFromHoldings(
  holdingsA: HoldingWeight[],
  holdingsB: HoldingWeight[],
): OverlapResult {
  const mapA = new Map<string, { name: string; weight: number }>();
  holdingsA.forEach((h) => {
    mapA.set(h.ticker, {
      name: h.name,
      weight: h.weight,
    });
  });

  const commonHoldings: CommonHolding[] = [];
  let overlapScore = 0;

  holdingsB.forEach((hB) => {
    const dataA = mapA.get(hB.ticker);
    if (dataA) {
      const weightB = hB.weight;
      const weightA = dataA.weight;
      const minWeight = Math.min(weightA, weightB);

      overlapScore += minWeight;

      commonHoldings.push({
        ticker: hB.ticker,
        name: hB.name,
        weightInA: weightA,
        weightInB: weightB,
      });
    }
  });

  // Sort by the minimum overlap weight (intersection)
  commonHoldings.sort(
    (a, b) =>
      Math.min(b.weightInA, b.weightInB) - Math.min(a.weightInA, a.weightInB),
  );

  return {
    overlapScore,
    commonHoldings,
  };
}

/**
 * @deprecated Prefer calculateOverlapFromHoldings with client/live data.
 * Kept as an alias that accepts two holdings arrays (not tickers + DB).
 */
export async function calculateOverlap(
  holdingsA: HoldingWeight[] | string,
  holdingsB?: HoldingWeight[] | string,
): Promise<OverlapResult> {
  // Legacy ticker-string calls have no holdings data and return an empty result.
  // New signature: two holdings arrays.
  if (!Array.isArray(holdingsA) || !Array.isArray(holdingsB)) {
    return { overlapScore: 0, commonHoldings: [] };
  }
  return calculateOverlapFromHoldings(holdingsA, holdingsB);
}
