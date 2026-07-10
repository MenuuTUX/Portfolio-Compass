import { fetchFearAndGreedIndex } from "@/lib/scrapers/fear-greed";

/**
 * Market risk / sentiment — fully live, no database.
 * Uses CNN Fear & Greed (same source as /api/market/fear-greed).
 * Portfolio risk preferences stay in the browser; this only feeds the optimizer.
 */

/**
 * Calculates the Exponential Moving Average (EMA) for a given series of numbers.
 *
 * @param data Array of values sorted by date ascending (oldest first).
 * @param window The window size N.
 */
export function calculateEMA(data: number[], window: number): number[] {
  if (data.length === 0) return [];

  const alpha = 2 / (window + 1);
  const emaValues: number[] = [];

  emaValues[0] = data[0];

  for (let i = 1; i < data.length; i++) {
    const currentVal = data[i];
    const prevEma = emaValues[i - 1];
    const newEma = currentVal * alpha + prevEma * (1 - alpha);
    emaValues.push(newEma);
  }

  return emaValues;
}

export type RiskRegime = "RISK_ON" | "NEUTRAL" | "RISK_OFF";

export interface MarketRiskState {
  sentimentEma: number;
  riskRegime: RiskRegime;
  lambda: number;
  latestScore: number;
  /** Present when using fallbacks (scrape failed) */
  degraded?: boolean;
}

/** Safe defaults when live sentiment is unavailable */
export const NEUTRAL_MARKET_RISK: MarketRiskState = {
  sentimentEma: 50,
  riskRegime: "NEUTRAL",
  lambda: 1.0,
  latestScore: 50,
};

function scoreToRegime(score: number): RiskRegime {
  if (score > 75) return "RISK_ON";
  if (score < 25) return "RISK_OFF";
  return "NEUTRAL";
}

/** Map Fear & Greed (0–100) → risk-aversion lambda (2.0 → 0.5) */
function scoreToLambda(score: number): number {
  let lambda = 2.0 - score * 0.015;
  return Math.max(0.5, Math.min(2.0, lambda));
}

/**
 * Live market risk state from CNN Fear & Greed.
 * No DB seed / history table — single live snapshot is enough for the optimizer.
 */
export async function getMarketRiskState(): Promise<MarketRiskState> {
  try {
    const fg = await fetchFearAndGreedIndex();
    const score = Math.max(0, Math.min(100, fg.score));

    return {
      sentimentEma: score,
      riskRegime: scoreToRegime(score),
      lambda: Number(scoreToLambda(score).toFixed(2)),
      latestScore: score,
    };
  } catch (error) {
    console.warn(
      "[Sentiment] Live Fear & Greed unavailable — neutral defaults:",
      error instanceof Error ? error.message : error,
    );
    return { ...NEUTRAL_MARKET_RISK, degraded: true };
  }
}

/** @deprecated No-op — kept so old imports/scripts don't break */
export async function seedSentimentData(): Promise<boolean> {
  return false;
}
