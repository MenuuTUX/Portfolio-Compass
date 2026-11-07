import { z } from "zod";
import { timeoutSignal } from "@/lib/upstream";
import { BROWSER_USER_AGENT } from "@/lib/scrapers/user-agent";

export interface FearAndGreedData {
  score: number;
  rating: string;
  updatedAt: string;
}

const FearAndGreedResponseSchema = z.object({
  fear_and_greed: z.object({
    score: z.coerce.number(),
    rating: z.string().min(1),
    timestamp: z.string().optional(),
  }),
});

/** Throws on any failure; the API route turns that into a 500 with a neutral payload. */
export async function fetchFearAndGreedIndex(): Promise<FearAndGreedData> {
  const response = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
    signal: timeoutSignal(),
    headers: { "User-Agent": BROWSER_USER_AGENT },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Fear & Greed Index: ${response.status} ${response.statusText}`);
  }

  const { fear_and_greed: fg } = FearAndGreedResponseSchema.parse(await response.json());
  return {
    score: Math.round(fg.score),
    rating: fg.rating,
    updatedAt: fg.timestamp || new Date().toISOString(),
  };
}
