/**
 * Holdings overlap math with no database dependency.
 * Pass holdings already loaded on the client (or from live ETF details).
 */

export interface HoldingWeight {
  ticker: string;
  name: string;
  /** Weight as a percentage or fraction. */
  weight: number;
}

export interface OverlapOptions {
  /** Defaults to percentage weights; use 'fraction' for values such as 0.005 = 0.5%. */
  weightUnit?: 'percent' | 'fraction';
}

interface OverlapResult {
  /** Shared portfolio weight in percentage points, bounded to 0–100. */
  overlapScore: number | null;
  status: 'valid' | 'overfull';
  commonHoldings: CommonHolding[];
  /** Reported percentage of each portfolio covered by valid, distinct holdings; may exceed 100 for invalid feeds. */
  coverageA: number;
  coverageB: number;
}

interface CommonHolding {
  ticker: string;
  name: string;
  weightInA: number;
  weightInB: number;
}

/**
 * Calculate portfolio overlap between two holdings lists. Weights default to
 * percentage points; pass `{ weightUnit: 'fraction' }` for fractional weights.
 */
export function calculateOverlapFromHoldings(
  holdingsA: HoldingWeight[],
  holdingsB: HoldingWeight[],
  options: OverlapOptions = {},
): OverlapResult {
  const toMap = (holdings: HoldingWeight[]) => {
    const map = new Map<string, { ticker: string; name: string; weight: number }>();
    holdings.forEach((holding) => {
      const ticker = typeof holding.ticker === 'string' ? holding.ticker.trim().toUpperCase() : '';
      // Keep the first valid row for a ticker so duplicate feed entries cannot inflate weight.
      if (!ticker || !Number.isFinite(holding.weight) || holding.weight <= 0 || map.has(ticker)) return;
      map.set(ticker, { ticker, name: holding.name, weight: holding.weight });
    });
    return map;
  };
  const mapA = toMap(holdingsA);
  const mapB = toMap(holdingsB);
  const scaleA = options.weightUnit === 'fraction' ? 100 : 1;
  const scaleB = scaleA;
  const coverageA = [...mapA.values()].reduce((sum, h) => sum + h.weight * scaleA, 0);
  const coverageB = [...mapB.values()].reduce((sum, h) => sum + h.weight * scaleB, 0);

  const commonHoldings: CommonHolding[] = [];
  let overlapScore = 0;

  mapB.forEach((hB, ticker) => {
    const dataA = mapA.get(ticker);
    if (dataA) {
      const weightB = hB.weight * scaleB;
      const weightA = dataA.weight * scaleA;
      const minWeight = Math.min(weightA, weightB);

      overlapScore += minWeight;

      commonHoldings.push({
        ticker,
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

  const status = coverageA > 100 || coverageB > 100 ? 'overfull' : 'valid';
  return {
    overlapScore: status === 'valid' ? Math.min(100, overlapScore) : null,
    status,
    commonHoldings,
    coverageA,
    coverageB,
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
    return { overlapScore: 0, status: 'valid', commonHoldings: [], coverageA: 0, coverageB: 0 };
  }
  return calculateOverlapFromHoldings(holdingsA, holdingsB);
}
