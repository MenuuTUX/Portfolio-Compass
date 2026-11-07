import { z } from "zod";
import { ETFSchema } from "@/schemas/assetSchema";
import type { ETF } from "@/types";

export interface FearGreedData {
  score: number;
  rating: string;
  updatedAt: string;
}

/** The Fear & Greed reading; throws when the request fails or the answer has no numeric score. */
export async function fetchFearGreed(): Promise<FearGreedData> {
  const res = await fetch("/api/market/fear-greed");
  if (!res.ok) throw new Error(`Fear & Greed request failed: ${res.status}`);
  const json = await res.json();
  if (!json || typeof json.score !== "number") throw new Error("Fear & Greed answer has no score");
  return {
    score: json.score,
    rating: String(json.rating ?? ""),
    updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : new Date().toISOString(),
  };
}

/** Batched quotes. Throws when the request fails; an answer that fails validation is dropped as empty. */
export async function fetchSnapshot(tickers: string[], includeHistory = false): Promise<ETF[]> {
  if (tickers.length === 0) return [];
  const res = await fetch(`/api/market/snapshot?tickers=${tickers.join(",")}&history=${includeHistory}`);
  if (!res.ok) throw new Error(`Snapshot failed: ${res.statusText}`);
  const raw = await res.json();
  try {
    return z.array(ETFSchema).parse(raw);
  } catch (e) {
    console.warn("Snapshot validation failed:", e);
    return [];
  }
}
