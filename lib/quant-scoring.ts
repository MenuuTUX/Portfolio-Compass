import { Decimal } from "@/lib/decimal";
import { EtfDetails } from "./market-service";

/**
 * Calculates a composite score for an asset based on Valuation, Quality, and Low Volatility factors.
 * This implementation avoids double-counting Yield in the Valuation factor.
 *
 * Factors:
 * 1. Valuation (V): 1 / PE_Ratio. (If PE is missing or negative, defaults to 0).
 * 2. Quality (Q): DividendYield + DividendGrowth_5Y.
 * 3. Low Volatility (L): 1 / Beta. (If Beta is missing or <= 0, defaults to 0.5 - high risk penalty).
 *
 * @param asset The asset details (EtfDetails).
 * @returns A raw composite score (average of factors). To be useful, this should be Z-scored against peers.
 */
export function calculateRawScore(asset: EtfDetails): number {
  const getNum = (val: Decimal | number | undefined): number | undefined => {
    if (val === undefined || val === null) return undefined;
    if (val instanceof Decimal) return val.toNumber();
    return val;
  };

  // 1. Valuation: 1 / PE
  // Constraint: Do not add Dividend Yield here.
  let valuationScore = 0;
  const pe = getNum(asset.peRatio);
  if (pe && pe > 0) {
    valuationScore = 1 / pe;
  } else {
    // Fallback: If PE is negative (loss) or missing, assign a low score (0).
    valuationScore = 0;
  }

  // 2. Quality: DividendYield + DividendGrowth_5Y
  const yieldVal = getNum(asset.dividendYield) || 0;
  const growthVal = getNum(asset.dividendGrowth5Y) || 0;
  const qualityScore = yieldVal + growthVal;

  // 3. Low Volatility: 1 / Beta
  let lowVolScore = 0;
  const beta = getNum(asset.beta5Y) || getNum(asset.beta);
  if (beta && beta > 0) {
    lowVolScore = 1 / beta;
  } else {
    // If beta is missing or negative, assume high volatility (low score).
    // Using a default beta of 2.0 implies score 0.5.
    lowVolScore = 0.5;
  }

  return (valuationScore + qualityScore + lowVolScore) / 3;
}

export interface ScoredAsset {
  ticker: string;
  scores: {
    valuation: number;
    quality: number;
    lowVol: number;
    composite: number;
  };
}

/**
 * Calculates Composite Z-Scores for a list of assets.
 *
 * Logic:
 * 1. Calculate Raw Factors (V, Q, L) for all assets.
 * 2. Calculate Mean and StdDev for each factor across the peer group.
 * 3. Compute Z-Score for each factor: Z = (Raw - Mean) / StdDev.
 * 4. Composite Z = (Z_V + Z_Q + Z_L) / 3.
 *
 * @param assets List of EtfDetails.
 * @returns Array of objects with ticker and composite score.
 */
export function calculateCompositeScores(assets: EtfDetails[]): ScoredAsset[] {
  const rawData = assets.map((asset) => {
    const getNum = (val: Decimal | number | undefined) =>
      (val instanceof Decimal ? val.toNumber() : val) || 0;

    // Valuation: 1 / PE
    const pe = getNum(asset.peRatio);
    const valRaw = pe > 0 ? 1 / pe : 0; // Penalty for neg/missing PE

    // Quality: Yield + Growth
    const yieldVal = getNum(asset.dividendYield);
    const growthVal = getNum(asset.dividendGrowth5Y);
    const qualRaw = yieldVal + growthVal;

    // Low Vol: 1 / Beta
    const beta = getNum(asset.beta5Y) || getNum(asset.beta);
    const safeBeta = beta && beta > 0 ? beta : 2.0;
    const lowVolRaw = 1 / safeBeta;

    return {
      ticker: asset.ticker,
      raw: { val: valRaw, qual: qualRaw, vol: lowVolRaw },
    };
  });

  // Calculate Mean and StdDev for each factor
  const calculateStats = (values: number[]) => {
    if (values.length === 0) return { mean: 0, std: 1 };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance) || 1; // Avoid div by zero
    return { mean, std };
  };

  const valStats = calculateStats(rawData.map((d) => d.raw.val));
  const qualStats = calculateStats(rawData.map((d) => d.raw.qual));
  const volStats = calculateStats(rawData.map((d) => d.raw.vol));

  return rawData.map((item) => {
    const zVal = (item.raw.val - valStats.mean) / valStats.std;
    const zQual = (item.raw.qual - qualStats.mean) / qualStats.std;
    const zVol = (item.raw.vol - volStats.mean) / volStats.std;

    const composite = (zVal + zQual + zVol) / 3;

    return {
      ticker: item.ticker,
      scores: {
        valuation: zVal,
        quality: zQual,
        lowVol: zVol,
        composite,
      },
    };
  });
}
