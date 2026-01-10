import prisma from "@/lib/db";
import { Decimal } from "@/lib/decimal";

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

  // Initialize with the first element if data is shorter than the window
  // otherwise, we can start with the first data point as an approximation.
  let initialSma = 0;
  if (data.length < window) {
    initialSma = data.reduce((a, b) => a + b, 0) / data.length;
    emaValues.push(initialSma);
    emaValues[0] = data[0];
  } else {
    emaValues[0] = data[0];
  }

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
}

/**
 * Seeds dummy sentiment data for development/testing if the DB is empty.
 */
export async function seedSentimentData() {
  const count = await prisma.marketSentiment.count();
  if (count > 0) return;

  console.log("Seeding dummy MarketSentiment data...");
  const today = new Date();
  const data = [];

  // Generate 30 days of synthetic data
  // Simulates a trend moving from Fear (low score) to Greed (high score)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setUTCHours(0, 0, 0, 0); // Normalize time

    let base = 50;
    if (i >= 20) base = 25;      // Days 29-20: Fear
    else if (i <= 9) base = 75;  // Days 9-0: Greed

    const noise = (Math.random() - 0.5) * 10;
    const score = Math.max(0, Math.min(100, base + noise));

    data.push({
      date: d,
      score,
      rating:
        score < 25
          ? "Extreme Fear"
          : score < 45
            ? "Fear"
            : score < 55
              ? "Neutral"
              : score < 75
                ? "Greed"
                : "Extreme Greed",
    });
  }

  for (const item of data) {
    await prisma.marketSentiment.create({
      data: item,
    });
  }
}

/**
 * Retrieves the market risk state based on 10-day EMA and hysteresis.
 *
 * Logic:
 * 1. Fetches historical sentiment data (last 30 days).
 * 2. Calculates the 10-day EMA.
 * 3. Determines the Risk Regime based on a 3-day hysteresis check:
 *    - RISK_ON: EMA > 75 for 3 consecutive days.
 *    - RISK_OFF: EMA < 25 for 3 consecutive days.
 *    - NEUTRAL: Otherwise.
 * 4. Calculates Lambda (Risk Aversion Parameter) via linear mapping:
 *    - EMA 0 -> Lambda 2.0 (Defensive)
 *    - EMA 100 -> Lambda 0.5 (Aggressive)
 */
export async function getMarketRiskState(): Promise<MarketRiskState> {
  const lookbackDays = 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  let history = await prisma.marketSentiment.findMany({
    where: {
      date: {
        gte: cutoffDate,
      },
    },
    orderBy: {
      date: "asc",
    },
  });

  if (history.length === 0) {
    await seedSentimentData();
    history = await prisma.marketSentiment.findMany({
      where: {
        date: {
          gte: cutoffDate,
        },
      },
      orderBy: {
        date: "asc",
      },
    });
  }

  if (history.length === 0) {
    return {
      sentimentEma: 50,
      riskRegime: "NEUTRAL",
      lambda: 1.0,
      latestScore: 50,
    };
  }

  const scores = history.map((h) => h.score);
  const emaValues = calculateEMA(scores, 10);

  const currentEma = emaValues[emaValues.length - 1];
  const latestScore = scores[scores.length - 1];

  let regime: RiskRegime = "NEUTRAL";

  const checkCondition = (
    predicate: (val: number) => boolean,
    days: number = 3,
  ) => {
    if (emaValues.length < days) return false;
    const slice = emaValues.slice(-days);
    return slice.every(predicate);
  };

  if (checkCondition((val) => val > 75, 3)) {
    regime = "RISK_ON";
  } else if (checkCondition((val) => val < 25, 3)) {
    regime = "RISK_OFF";
  } else {
    regime = "NEUTRAL";
  }

  // Map EMA (0-100) to Lambda (0.5 - 2.0)
  // Formula: Lambda = 2.0 - (EMA * 0.015)
  let lambda = 2.0 - currentEma * 0.015;
  lambda = Math.max(0.5, Math.min(2.0, lambda));

  return {
    sentimentEma: Number(currentEma.toFixed(2)),
    riskRegime: regime,
    lambda: Number(lambda.toFixed(2)),
    latestScore,
  };
}
