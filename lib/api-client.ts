import { z } from "zod";
import { ETFSchema } from "@/schemas/assetSchema";
import type { Candle, ChartRange } from "@/lib/fast-market";
import type { FearAndGreedData } from "@/lib/scrapers/fear-greed";
import type { ETF } from "@/types";

export type FearGreedData = FearAndGreedData;

/** GET and parse JSON; a non-OK answer gives `fallback`. Network and parse errors still throw. */
export async function getJson<T>(url: string, fallback: T, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  return res.ok ? res.json() : fallback;
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

export interface ChartResponse {
  series?: Record<string, { date: string; price: number }[]>;
  candles?: Candle[];
}

/** Price series per ticker, or OHLC bars with `ohlc`. Throws on a non-OK answer. */
export async function fetchChart(opts: {
  tickers: string;
  range: ChartRange;
  ohlc?: boolean;
  adjusted?: boolean;
  signal?: AbortSignal;
}): Promise<ChartResponse> {
  let url = `/api/market/chart?tickers=${encodeURIComponent(opts.tickers)}&range=${opts.range}`;
  if (opts.ohlc) url += "&ohlc=1";
  if (opts.adjusted) url += "&adjusted=1";
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error("Failed to fetch historical data");
  return res.json();
}

/** Raw search response; callers check `ok` and parse. */
export function searchMarket(opts: {
  query: string;
  skip?: number;
  limit?: number;
  type?: string;
  /** false drops price history and fund profiles for a faster answer. */
  details?: boolean;
  signal?: AbortSignal;
}): Promise<Response> {
  let url = `/api/market/search?query=${encodeURIComponent(opts.query)}`;
  if (opts.skip !== undefined) url += `&skip=${opts.skip}`;
  if (opts.limit !== undefined) url += `&limit=${opts.limit}`;
  if (opts.type) url += `&type=${encodeURIComponent(opts.type)}`;
  if (opts.details === false) url += "&history=false&profiles=false";
  return fetch(url, { signal: opts.signal });
}

/** Raw sync response; callers check `ok` and parse. */
export function syncEtf(ticker: string): Promise<Response> {
  return fetch("/api/etfs/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
  });
}
