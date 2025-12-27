import prisma from '@/lib/db';
import { fetchFearAndGreedIndex } from './scrapers/fear-greed';

/**
 * Calculates the Exponential Moving Average (EMA).
 * @param currentValue The latest value.
 * @param previousEma The previous period's EMA.
 * @param period The number of periods (N).
 * @returns The new EMA.
 */
function calculateEMA(currentValue: number, previousEma: number, period: number): number {
  const k = 2 / (period + 1);
  return (currentValue * k) + (previousEma * (1 - k));
}

export type SmoothedSentiment = {
  score: number;
  rating: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  history: { date: Date; score: number }[];
  isSignalStable: boolean;
};

/**
 * Fetches the latest Fear & Greed index, persists it, and returns a smoothed 10-day EMA signal
 * with hysteresis logic applied.
 */
export async function getSmoothedSentiment(): Promise<SmoothedSentiment> {
  // 1. Fetch live score
  const liveData = await fetchFearAndGreedIndex();

  if (!liveData) {
    throw new Error("Failed to fetch live Fear & Greed index");
  }

  // 2. Persist to DB (avoid duplicates for the same day if possible, or just append)
  // We'll check if we already have an entry for today to avoid spamming if called frequently
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingEntry = await prisma.marketSentiment.findFirst({
    where: {
      date: {
        gte: today,
      },
    },
  });

  if (!existingEntry) {
    await prisma.marketSentiment.create({
      data: {
        score: liveData.score,
        rating: liveData.rating,
        date: new Date(), // Store with time for potential intraday checks, or just use now
      },
    });
  } else {
    // Optional: Update existing entry if it's vastly different?
    // For now, let's assume one entry per day is sufficient or we update it.
    // Let's update it to keep the latest intraday value
    await prisma.marketSentiment.update({
      where: { id: existingEntry.id },
      data: {
        score: liveData.score,
        rating: liveData.rating,
      },
    });
  }

  // 3. Fetch History (Need at least 10+ days for EMA, plus 3 days for hysteresis check)
  // We'll fetch last 20 records to be safe
  const history = await prisma.marketSentiment.findMany({
    orderBy: { date: 'desc' },
    take: 20,
  });

  // Reverse to chronological order for calculation
  const chronologicalHistory = [...history].reverse();

  if (chronologicalHistory.length === 0) {
    // Should not happen as we just inserted one, but for safety
    return {
      score: liveData.score,
      rating: liveData.rating,
      trend: 'stable',
      history: [],
      isSignalStable: false
    };
  }

  // 4. Calculate 10-Day EMA
  // If we don't have enough data, we can just use SMA or the available data
  // Base case: EMA_0 = SMA_0 (sum / count)

  let ema = chronologicalHistory[0].score; // Seed with first value
  const period = 10;

  // Calculate EMA series
  const emaSeries = chronologicalHistory.map((entry, index) => {
    if (index === 0) return entry.score;
    ema = calculateEMA(entry.score, ema, period);
    return ema;
  });

  const currentEma = emaSeries[emaSeries.length - 1];

  // 5. Hysteresis Logic
  // "The signal should only change 'Regime' if the 10-Day EMA crosses a threshold and stays there for 3 consecutive days."

  // Let's derive the rating from the current EMA
  const getRating = (score: number) => {
    if (score < 25) return "Extreme Fear";
    if (score < 45) return "Fear";
    if (score < 55) return "Neutral";
    if (score < 75) return "Greed";
    return "Extreme Greed";
  };

  const currentSmoothedRating = getRating(currentEma);

  // Check stability: Do the last 3 EMAs all map to this same rating?
  let isStable = false;

  // We need at least 3 points to check stability
  const last3Emas = emaSeries.slice(-3);

  if (last3Emas.length >= 3) {
    const ratings = last3Emas.map(getRating);
    // Stable if all 3 recent ratings are the same
    isStable = ratings.every(r => r === currentSmoothedRating);
  } else {
    // Not enough history for stability check, assume stable (as we can't disprove it) or just default
    isStable = true;
  }

  // Determine trend
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (last3Emas.length >= 2) {
    const diff = last3Emas[last3Emas.length - 1] - last3Emas[last3Emas.length - 2];
    if (diff > 0.5) trend = 'increasing';
    else if (diff < -0.5) trend = 'decreasing';
  }

  return {
    score: Number(currentEma.toFixed(2)),
    rating: isStable ? currentSmoothedRating : `Unstable (${currentSmoothedRating})`,
    trend,
    history: chronologicalHistory.map(h => ({ date: h.date, score: h.score })),
    isSignalStable: isStable
  };
}
