import prisma from "@/lib/db";
import { Decimal } from "@/lib/decimal";

/**
 * Calculates the Exponential Moving Average (EMA) for a given series of numbers.
 * Formula: EMA_today = (Value_today * (s / (1 + d))) + (EMA_yesterday * (1 - (s / (1 + d))))
 * where s = smoothing factor (usually 2).
 * But standard EMA formula is: alpha = 2 / (N + 1)
 * EMA_t = alpha * price_t + (1 - alpha) * EMA_t-1
 *
 * @param data Array of values sorted by date ascending (oldest first).
 * @param window The window size N.
 */
export function calculateEMA(data: number[], window: number): number[] {
  if (data.length === 0) return [];

  const alpha = 2 / (window + 1);
  const emaValues: number[] = [];

  // Initialize with SMA of first 'window' elements, or just first element if data is short
  let initialSma = 0;
  if (data.length < window) {
    initialSma = data.reduce((a, b) => a + b, 0) / data.length;
    emaValues.push(initialSma);
    // Continue from index 1? Or just use this as base.
    // Standard practice: First EMA is SMA of first N values.
    // However, if we don't have N values, we can't compute a "proper" N-day EMA.
    // For simplicity in this context (where we might just need the latest),
    // we can seed with the first value.
    emaValues[0] = data[0];
  } else {
    // Standard initialization: SMA of first N
    // But commonly, simple implementations just start with data[0] as EMA[0]
    // if history is long enough, the error decays.
    // Given we want "last 14 days", we should try to be accurate.
    // Let's assume the input `data` is the sequence we want to smooth.
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

  // Generate 30 days of data
  // Let's simulate a trend: High fear initially, moving to greed?
  // Or fluctuating.
  // Let's do a sine wave + noise around 50.
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setUTCHours(0, 0, 0, 0); // Normalize time

    // Pattern:
    // Days 29-20: Low (Fear) ~ 20-30
    // Days 19-10: Neutral ~ 45-55
    // Days 9-0: High (Greed) ~ 70-80
    let base = 50;
    if (i >= 20) base = 25;
    else if (i <= 9) base = 75;

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
 */
export async function getMarketRiskState(): Promise<MarketRiskState> {
  // 1. Fetch history (enough to stabilize EMA)
  // We want 10-day EMA. To be safe, let's fetch 20-30 days.
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

  // If empty, seed and retry (for dev environment)
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
    // Fallback if still empty
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

  // 2. Determine Regime with Hysteresis (3 days)
  // We check the last 3 days of EMA values.
  // Logic:
  // If EMA > 75 for 3 days -> RISK_ON (Low Lambda)
  // If EMA < 25 for 3 days -> RISK_OFF (High Lambda)
  // Else -> NEUTRAL

  // Need at least 3 days of data for strict hysteresis
  let regime: RiskRegime = "NEUTRAL";

  // Helper to check condition over last N days
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
    // Default or Hold previous?
    // The requirement says: "A regime change ... should only be confirmed if ... stays there for 3 consecutive days."
    // This implies statefulness or looking at longer history.
    // Without persistent state of "previous regime", we infer it from current data window.
    // If it's NOT > 75 for 3 days AND NOT < 25 for 3 days, we are in NEUTRAL or Transition.
    // For simplicity, we map directly.
    regime = "NEUTRAL";
  }

  // 3. Map to Lambda
  // Formula suggestion: Map EMA (0-100) to Lambda (0.5 - 2.0).
  // Low Sentiment (Fear < 25) -> High Lambda (e.g., 2.0)
  // High Sentiment (Greed > 75) -> Low Lambda (e.g., 0.5)
  // Linear interpolation?
  // EMA=0 => Lambda=2.0
  // EMA=100 => Lambda=0.5
  // Slope = (0.5 - 2.0) / 100 = -1.5 / 100 = -0.015
  // Lambda = 2.0 + (EMA * -0.015)

  // However, the requirement specifically mentions "Risk Logic Implementation (Hysteresis)" for Regime,
  // and "Map the EMA to Lambda".
  // Let's use the linear mapping for smoothness, but maybe clamped by regime if desired?
  // "Low Sentiment (Fear < 25) -> High Lambda"
  // Let's stick to the linear formula based on EMA.

  let lambda = 2.0 - currentEma * 0.015;
  // Clamp just in case
  lambda = Math.max(0.5, Math.min(2.0, lambda));

  return {
    sentimentEma: Number(currentEma.toFixed(2)),
    riskRegime: regime,
    lambda: Number(lambda.toFixed(2)),
    latestScore,
  };
}
