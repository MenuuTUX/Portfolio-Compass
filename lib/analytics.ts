import prisma from '@/lib/db';
import { Decimal } from 'decimal.js';

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

export async function calculateOverlap(etfA: string, etfB: string): Promise<OverlapResult> {
  const [holdingsA, holdingsB] = await Promise.all([
    prisma.holding.findMany({
      where: { etfId: etfA },
      select: { ticker: true, name: true, weight: true }
    }),
    prisma.holding.findMany({
      where: { etfId: etfB },
      select: { ticker: true, name: true, weight: true }
    })
  ]);

  const mapA = new Map<string, { name: string; weight: number }>();
  holdingsA.forEach(h => {
    mapA.set(h.ticker, {
      name: h.name,
      weight: h.weight.toNumber()
    });
  });

  const commonHoldings: CommonHolding[] = [];
  let overlapScore = 0;

  holdingsB.forEach(hB => {
    const dataA = mapA.get(hB.ticker);
    if (dataA) {
      const weightB = hB.weight.toNumber();
      const weightA = dataA.weight;
      const minWeight = Math.min(weightA, weightB);

      overlapScore += minWeight;

      commonHoldings.push({
        ticker: hB.ticker,
        name: hB.name, // Using name from B, usually same as A
        weightInA: weightA,
        weightInB: weightB
      });
    }
  });

  // Sort by the minimum overlap weight contributing to the score, or generally by size
  // "Sort the commonHoldings by weight descending" -> ambiguous which weight, but usually overlap weight or just max weight.
  // Let's sort by the overlap amount (min weight) as that's most relevant for overlap analysis,
  // or simple sum. Let's stick to the prompt "weight descending".
  // I will sort by the average weight or max weight to show the most significant holdings.
  // Actually, usually overlap tools sort by the weight in the portfolio. Let's sort by weightInA + weightInB for now to show biggest common chunks.
  commonHoldings.sort((a, b) => (b.weightInA + b.weightInB) - (a.weightInA + a.weightInB));

  return {
    overlapScore,
    commonHoldings
  };
}
