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
  // Helper to safely get number from Decimal or number or undefined
  const getNum = (val: Decimal | number | undefined): number | undefined => {
    if (val === undefined || val === null) return undefined;
    if (val instanceof Decimal) return val.toNumber();
    return val;
  };

  // 1. Valuation: 1 / PE
  // Constraint: DO NOT add Dividend Yield here.
  let valuationScore = 0;
  const pe = getNum(asset.peRatio);
  if (pe && pe > 0) {
    valuationScore = 1 / pe;
  } else {
    // Fallback: If PE is negative (loss) or missing, assign a low score.
    // For normalization purposes, we use 0, effectively penalizing it.
    valuationScore = 0;
  }

  // 2. Quality: DividendYield + DividendGrowth_5Y
  let qualityScore = 0;
  const yieldVal = getNum(asset.dividendYield) || 0; // Default to 0
  const growthVal = getNum(asset.dividendGrowth5Y) || 0; // Default to 0

  // Note: Yield and Growth are typically percentages (e.g. 2.5 for 2.5%).
  // If they are decimals (0.025), we should ensure consistency.
  // In `lib/market-service.ts`:
  // - dividendYield is from stockProfile (likely %) or Yahoo (converted to %).
  // - dividendGrowth5Y is from stockAnalysis (parsed as %).
  // So we assume they are in percentage points (e.g. 5.0 for 5%).
  qualityScore = yieldVal + growthVal;

  // 3. Low Volatility: 1 / Beta
  let lowVolScore = 0;
  const beta = getNum(asset.beta5Y) || getNum(asset.beta);
  if (beta && beta > 0) {
    lowVolScore = 1 / beta;
  } else {
    // If beta is missing or negative (weird), assume high volatility (low score).
    // Using a default beta of 2.0 implies score 0.5.
    lowVolScore = 0.5;
  }

  // Raw Composite = Average of the three factors
  // We can weight them if needed, but "average Z-Score" implies equal weights on the Z-scores.
  // Wait, the prompt says "return the average Z-Score".
  // So we need to calculate raw factors first, then Z-score them individually?
  // Or Z-score the composite?
  // "Normalization: Convert raw metrics to Z-Scores ... and return the average Z-Score."
  // This implies we compute Z-Scores for V, Q, L separately, then average them.

  // Since this function operates on a single asset, it cannot compute Z-Score (needs peers).
  // So this function should return the Raw Factors.
  // But the prompt says: "Export a function calculateCompositeScore(asset: EtfDetails): number."
  // And "Normalization: Convert raw metrics to Z-Scores (standardize against a provided array of peer assets)".
  // This implies the function signature should probably take peers or the Z-scoring logic is outside.
  // BUT the prompt explicitly says: `calculateCompositeScore(asset: EtfDetails): number`.
  // If it only takes `asset`, it CANNOT calculate Z-Score against peers inside itself unless it has access to global state (which is bad).

  // Maybe the prompt implies `calculateCompositeScore` is the high-level function that calls this?
  // OR, maybe the prompt meant `calculateCompositeScores(assets: EtfDetails[]): AssetWithScore[]`?

  // "Export a function calculateCompositeScore(asset: EtfDetails): number."
  // This signature is impossible for Z-scoring against peers without the peers.
  // I will assume the prompt meant either:
  // A) The function takes `(asset, peers)`
  // B) The function takes `(asset)` and uses hardcoded stats (unlikely)
  // C) The function is `calculateCompositeScores(assets)` returning a map or array.

  // I will implement `calculateCompositeScores(assets: EtfDetails[]): { ticker: string, score: number }[]`
  // And also a helper `calculateRawFactors` if needed.

  // Let's re-read: "Normalization: Convert raw metrics to Z-Scores (standardize against a provided array of peer assets) and return the average Z-Score."
  // If the function *must* be `calculateCompositeScore(asset)`, maybe it assumes the asset object ALREADY has the Z-scores? No.

  // I will implement `calculateCompositeScores` that processes a list.
  return (valuationScore + qualityScore + lowVolScore) / 3; // Placeholder return if used individually without context, but strictly incorrect per Z-score requirement.
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
    // If beta is missing or <= 0 (unlikely for stocks), use a penalty.
    // Standard beta is 1. High risk > 1.
    // If missing, we assume it's risky? Or average? Let's assume 1.0 if missing?
    // Previous logic used 0.5 (Beta=2).
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
