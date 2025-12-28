import { Decimal } from 'decimal.js';

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
 * Calculates Z-Scores for a list of assets based on Valuation, Quality, and Low Volatility factors.
 *
 * Logic:
 * 1. Valuation (V): 1 / PE_Ratio. (No Dividend Yield). Fallback for PE <= 0 or null is a low score.
 * 2. Quality (Q): DividendYield + DividendGrowth_5Y.
 * 3. Low Vol (L): 1 / Beta.
 * 4. Normalization: Z-Scores against peer assets.
 */

import { ETF } from '@/types';

// Helper to calculate mean and std dev
function calculateStats(values: number[]) {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 1 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  return { mean, std: Math.sqrt(variance) };
}

// Helper to calculate Z-Score
function calculateZScore(value: number, stats: { mean: number, std: number }) {
  if (stats.std === 0) return 0;
  return (value - stats.mean) / stats.std;
}

// Helper to calculate CAGR for dividends
function calculateDividendGrowth(dividendHistory: { date: string; amount: number }[] | undefined): number {
  if (!dividendHistory || dividendHistory.length < 2) return 0;

  // Sort by date
  const sorted = [...dividendHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Get annual dividends (grouped by year)
  const annualDividends: Record<number, number> = {};
  sorted.forEach(d => {
    const year = new Date(d.date).getFullYear();
    annualDividends[year] = (annualDividends[year] || 0) + d.amount;
  });

  const years = Object.keys(annualDividends).map(Number).sort((a, b) => a - b);
  if (years.length < 5) {
     // If less than 5 years, calculate growth between first and last available
     if (years.length < 2) return 0;
  }

  // We want 5-year growth. So compare Year N with Year N-5.
  // Better to use TTM vs TTM-5y, but simple annual is robust enough for now if we don't have TTM history logic handy.

  const startYear = years[0];
  const endYear = years[years.length - 1];
  const n = endYear - startYear;

  if (n < 1) return 0;

  const startDiv = annualDividends[startYear];
  const endDiv = annualDividends[endYear];

  if (startDiv <= 0 || endDiv <= 0) return 0;

  return Math.pow(endDiv / startDiv, 1 / n) - 1;
}

export function calculateCompositeScores(assets: ETF[]): Map<string, number> {
  const scoresMap = new Map<string, number>();

  // 1. Calculate Raw Scores
  const rawScores = assets.map(asset => {
    // Valuation: 1 / PE
    let valuation = 0;
    const pe = asset.peRatio;
    if (pe && pe > 0) {
      valuation = 1 / pe;
    } else {
       // Fallback: bottom decile? We'll handle this by assigning a very low raw score,
       // but strictly "1/PE" with PE -> Infinity is 0.
       // If PE is negative (loss), it's bad.
       // If PE is missing, it's ambiguous.
       // Let's assume 0 for now which is "infinite PE".
       valuation = 0;
    }

    // Quality: Yield + Growth
    const divYield = asset.dividendYield ?? asset.metrics.yield ?? 0;
    const divGrowth = calculateDividendGrowth(asset.dividendHistory);
    const quality = divYield + divGrowth;

    // Low Vol: 1 / Beta
    let lowVol = 0;
    const beta = asset.beta;
    if (beta && beta !== 0) {
        lowVol = 1 / Math.abs(beta); // Absolute value to handle negative beta assets?
                                     // 1/Beta implies lower Beta is better.
    } else {
        lowVol = 1; // Assume market beta
    }

    return {
      ticker: asset.ticker,
      valuation,
      quality,
      lowVol
    };
  });

  // 2. Normalize to Z-Scores
  const vStats = calculateStats(rawScores.map(s => s.valuation));
  const qStats = calculateStats(rawScores.map(s => s.quality));
  const lStats = calculateStats(rawScores.map(s => s.lowVol));

  rawScores.forEach(s => {
    const zV = calculateZScore(s.valuation, vStats);
    const zQ = calculateZScore(s.quality, qStats);
    const zL = calculateZScore(s.lowVol, lStats);

    const composite = (zV + zQ + zL) / 3;
    scoresMap.set(s.ticker, composite);
  });

  return scoresMap;
}

export function calculateCompositeScore(asset: ETF, peers: ETF[]): number {
    const all = [asset, ...peers.filter(p => p.ticker !== asset.ticker)];
    const map = calculateCompositeScores(all);
    return map.get(asset.ticker) || 0;
}
