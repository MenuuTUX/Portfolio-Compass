import { ETF } from '@/types/index';
import { EtfDetails } from '@/lib/market-service';
import { Decimal } from 'decimal.js';

// Define a union type for flexibility
// We map everything to a common internal structure first.
export type ScorableAsset = ETF | EtfDetails;

export interface FactorScores {
  valuation: number; // Z-Score
  quality: number;   // Z-Score
  lowVolatility: number; // Z-Score
  composite: number; // Z-Score
}

export interface AssetScoreResult {
  ticker: string;
  scores: FactorScores;
  rawValues: {
    valuation: number;
    quality: number;
    lowVolatility: number;
  }
}

// -----------------------------------------------------------------------------
// Statistical Helpers
// -----------------------------------------------------------------------------

function getStats(values: number[]) {
  const n = values.length;
  if (n === 0) return { mean: 0, stdDev: 0, q1: 0 };

  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)];

  return { mean, stdDev, q1 };
}

function calculateZ(val: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (val - mean) / stdDev;
}

// -----------------------------------------------------------------------------
// Financial Metric Calculators
// -----------------------------------------------------------------------------

function calculateVolatility(history: { date: string; price?: number; close?: Decimal | number }[]): number | null {
  if (!history || history.length < 10) return null;

  // Sort by date ascending to ensure correct return calculation
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const p1Raw = sorted[i].price ?? sorted[i].close;
    const p0Raw = sorted[i-1].price ?? sorted[i-1].close;

    const p1 = p1Raw instanceof Decimal ? p1Raw.toNumber() : (p1Raw as number);
    const p0 = p0Raw instanceof Decimal ? p0Raw.toNumber() : (p0Raw as number);

    if (p0 > 0 && p1 > 0) {
        returns.push(Math.log(p1 / p0));
    }
  }

  if (returns.length === 0) return null;

  const { stdDev } = getStats(returns);
  // Annualized Volatility
  return stdDev * Math.sqrt(252);
}

function calculateDGR5Y(dividendHistory: { date: string; amount: number }[] | undefined): number | null {
  if (!dividendHistory || dividendHistory.length === 0) return null;

  // Sort descending dates (newest first)
  const sorted = [...dividendHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const now = new Date();
  const oneYearAgo = new Date(now); oneYearAgo.setFullYear(now.getFullYear() - 1);
  const fiveYearsAgo = new Date(now); fiveYearsAgo.setFullYear(now.getFullYear() - 5);
  const sixYearsAgo = new Date(now); sixYearsAgo.setFullYear(now.getFullYear() - 6);

  // TTM Dividend (Last 365 days)
  const ttmDivs = sorted.filter(d => {
      const date = new Date(d.date);
      return date >= oneYearAgo && date <= now;
  });

  // Historical TTM Dividend (5 Years Ago)
  const historicDivs = sorted.filter(d => {
      const date = new Date(d.date);
      return date >= sixYearsAgo && date <= fiveYearsAgo;
  });

  const sumTTM = ttmDivs.reduce((sum, d) => sum + d.amount, 0);
  const sumHistoric = historicDivs.reduce((sum, d) => sum + d.amount, 0);

  if (sumTTM > 0 && sumHistoric > 0) {
      // CAGR formula: (End/Start)^(1/n) - 1
      return Math.pow(sumTTM / sumHistoric, 1 / 5) - 1;
  }

  return null;
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

export function calculateAssetScores(assets: ScorableAsset[]): AssetScoreResult[] {
    // 1. Calculate Raw Values for every asset
    const rawData = assets.map(asset => {
        // --- Accessor Helpers ---
        // Handle Etf (number) vs EtfDetails (Decimal)
        const getNum = (val: number | Decimal | undefined): number | undefined => {
            if (val === undefined || val === null) return undefined;
            if (val instanceof Decimal) return val.toNumber();
            return val;
        };

        const peRatio = getNum(asset.peRatio);
        const beta = getNum(asset.beta); // Etf has beta number, EtfDetails has beta Decimal
        // Note: EtfDetails aliases beta to beta5Y, ensure we check both if needed, but the interface says beta?: Decimal

        const netIncome = getNum(asset.netIncome);
        const revenue = getNum(asset.revenue);

        // Yield:
        // Etf has metrics.yield (number, usually percent)
        // EtfDetails has dividendYield (Decimal, percent if scaled)
        let yieldPercent: number = 0;
        if ('metrics' in asset && asset.metrics) {
            yieldPercent = asset.metrics.yield;
        } else if ('dividendYield' in asset && asset.dividendYield) {
            yieldPercent = getNum(asset.dividendYield) || 0;
        }

        // --- Valuation ($V$): Earnings Yield ($1/PE$) ---
        // Constraint: NO Dividend Yield.
        let rawValuation: number | null = null;
        if (peRatio !== undefined) {
             if (peRatio > 0) {
                 rawValuation = 1 / peRatio;
             } else if (peRatio < 0) {
                 // Negative PE -> Negative Earnings Yield (1 / -5 = -0.2)
                 rawValuation = 1 / peRatio;
             }
             // If peRatio is 0 (undefined behavior), treat as null/missing
        }

        // --- Quality ($Q$): Yield + DGR5y (or NetMargin) ---
        // Convert Yield to Decimal for calculation (e.g. 5% -> 0.05)
        const yieldDecimal = yieldPercent / 100;

        let growthVal: number | null = null;

        // Try DGR
        // dividendHistory is on Etf. EtfDetails usually doesn't have it in the type definition in lib/market-service (it has history prices).
        // Wait, EtfDetails type in lib/market-service DOES NOT have dividendHistory array (it has dividend/exDividendDate scalars).
        // So DGR is only possible if 'dividendHistory' exists (which is on Etf).
        let divHistory: { date: string; amount: number }[] | undefined = undefined;
        if ('dividendHistory' in asset) {
             divHistory = asset.dividendHistory;
        }

        const dgr = calculateDGR5Y(divHistory);
        if (dgr !== null) {
            growthVal = dgr;
        } else {
            // Fallback: Net Margin (Net Income / Revenue)
            if (netIncome !== undefined && revenue !== undefined && revenue !== 0) {
                growthVal = netIncome / revenue;
            }
        }

        // If still no growth metric, assume 0 growth.
        const qualityRaw = yieldDecimal + (growthVal || 0);


        // --- Low Volatility ($L$): Invert Beta or use Volatility ---
        let rawLowVol: number | null = null;

        // Primary: Volatility from History (Consistent across asset types)
        const vol = calculateVolatility(asset.history);

        if (vol !== null && vol > 0) {
            // Factor Value = 1 / Volatility
            rawLowVol = 1 / vol;
        } else if (beta !== undefined && beta !== 0) {
            // Fallback: 1 / Beta
            rawLowVol = 1 / beta;
        }

        return { ticker: asset.ticker, rawValuation, rawQuality: qualityRaw, rawLowVol };
    });

    // 2. Compute Distribution Stats (ignoring nulls)

    // Valuation Stats
    const validValuations = rawData.map(d => d.rawValuation).filter(v => v !== null) as number[];
    const valStats = getStats(validValuations);

    // Quality Stats
    const validQuality = rawData.map(d => d.rawQuality).filter(v => v !== null) as number[];
    const qualStats = getStats(validQuality);

    // LowVol Stats
    const validLowVol = rawData.map(d => d.rawLowVol).filter(v => v !== null) as number[];
    const volStats = getStats(validLowVol);

    // 3. Impute Missing Values and Normalize
    return rawData.map(item => {
        // Valuation Imputation
        // "If PE is negative or missing ... assign lowest quartile score"
        // Missing (null) gets Q1 of valid distribution.
        // Negative was kept as raw negative value, so it falls into distribution naturally.
        let valValue = item.rawValuation;
        if (valValue === null) {
             // If we have no valid valuations at all, default to 0 (neutral) or -1?
             // If validValuations is empty, stats are 0.
             valValue = valStats.q1 !== 0 ? valStats.q1 : 0;
        }

        // Quality Imputation
        // If missing (shouldn't be, as we default growth to 0), use mean.
        let qualValue = item.rawQuality;
        if (qualValue === null) {
            qualValue = qualStats.mean;
        }

        // LowVol Imputation
        let volValue = item.rawLowVol;
        if (volValue === null) {
            volValue = volStats.mean;
        }

        // Calculate Z-Scores
        // Protect against divide-by-zero (stdDev=0)
        const zVal = calculateZ(valValue, valStats.mean, valStats.stdDev);
        const zQual = calculateZ(qualValue, qualStats.mean, qualStats.stdDev);
        const zVol = calculateZ(volValue, volStats.mean, volStats.stdDev);

        const composite = (zVal + zQual + zVol) / 3;

        return {
            ticker: item.ticker,
            scores: {
                valuation: zVal,
                quality: zQual,
                lowVolatility: zVol,
                composite
            },
            rawValues: {
                valuation: valValue,
                quality: qualValue,
                lowVolatility: volValue
            }
        };
    });
}
