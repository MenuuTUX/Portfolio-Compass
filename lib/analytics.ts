import prisma from "@/lib/db";
import { Decimal } from "@/lib/decimal";

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

export async function calculateOverlap(
  etfA: string,
  etfB: string,
): Promise<OverlapResult> {
  const [holdingsA, holdingsB] = await Promise.all([
    prisma.holding.findMany({
      where: { etfId: etfA },
      select: { ticker: true, name: true, weight: true },
    }),
    prisma.holding.findMany({
      where: { etfId: etfB },
      select: { ticker: true, name: true, weight: true },
    }),
  ]);

  const mapA = new Map<string, { name: string; weight: number }>();
  holdingsA.forEach((h) => {
    mapA.set(h.ticker, {
      name: h.name,
      weight: h.weight.toNumber(),
    });
  });

  const commonHoldings: CommonHolding[] = [];
  let overlapScore = 0;

  holdingsB.forEach((hB) => {
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
        weightInB: weightB,
      });
    }
  });

  // Sort by the minimum overlap weight (intersection), as this represents the actual shared
  // exposure contributing to the overlap score. This highlights the holdings that matter most for overlap.
  commonHoldings.sort(
    (a, b) =>
      Math.min(b.weightInA, b.weightInB) - Math.min(a.weightInA, a.weightInB),
  );

  return {
    overlapScore,
    commonHoldings,
  };
}
