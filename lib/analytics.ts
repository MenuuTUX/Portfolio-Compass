/**
 * Holdings overlap math — pure, no database.
 * Pass holdings already loaded on the client (or from live ETF details).
 */

export interface HoldingWeight {
  ticker: string;
  name: string;
  /** Weight as a percentage (e.g. 10 = 10%) or fraction — must match between A and B */
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

function toNumber(weight: number | { toNumber: () => number }): number {
  if (typeof weight === "number") return weight;
  if (weight && typeof weight.toNumber === "function") return weight.toNumber();
  return Number(weight) || 0;
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
      weight: toNumber(h.weight),
    });
  });

  const commonHoldings: CommonHolding[] = [];
  let overlapScore = 0;

  holdingsB.forEach((hB) => {
    const dataA = mapA.get(hB.ticker);
    if (dataA) {
      const weightB = toNumber(hB.weight);
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
  // Legacy tests passed ticker strings + mocked DB — those no longer work.
  // New signature: two holdings arrays.
  if (typeof holdingsA === "string" || typeof holdingsB === "string") {
    return { overlapScore: 0, commonHoldings: [] };
  }
  return calculateOverlapFromHoldings(
    holdingsA as HoldingWeight[],
    (holdingsB || []) as HoldingWeight[],
  );
}
