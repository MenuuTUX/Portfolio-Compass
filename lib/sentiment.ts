import { fetchFearAndGreedIndex } from "@/lib/scrapers/fear-greed";

/**
 * Live market sentiment with no database.
 * Uses CNN Fear & Greed (same source as /api/market/fear-greed).
 * Retained for the sentiment API. The current allocator does not consume it.
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

/** Map Fear & Greed from 0 to 100 onto a risk-aversion value from 2.0 to 0.5. */
function scoreToLambda(score: number): number {
  let lambda = 2.0 - score * 0.015;
  return Math.max(0.5, Math.min(2.0, lambda));
}

/**
 * Live market risk state from CNN Fear & Greed.
 * A single live snapshot supplies the value. No history table is used.
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
      "[Sentiment] Live Fear & Greed unavailable. Using neutral defaults:",
      error instanceof Error ? error.message : error,
    );
    return { ...NEUTRAL_MARKET_RISK, degraded: true };
  }
}

/** @deprecated No-op retained for older imports and scripts. */
export async function seedSentimentData(): Promise<boolean> {
  return false;
}
