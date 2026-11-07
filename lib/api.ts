import { NextResponse } from "next/server";
import { getRedditCommunities } from "@/config/tickers";
import { normalizeTicker, parseTickers } from "@/lib/tickers";

/** Valid tickers from user input, upper-cased, at most `max` of them. */
export function parseUpperTickers(raw: readonly string[], max: number): string[] {
  return parseTickers(raw, max).map(normalizeTicker);
}

/** Logs the failure under `logLabel` and answers `{ error }` with the route's own status. */
export function jsonError(status: number, message: string, logLabel: string, error: unknown) {
  console.error(logLabel, error);
  return NextResponse.json({ error: message }, { status });
}

export function redditCommunities(ticker: string, assetType: Parameters<typeof getRedditCommunities>[1]) {
  return getRedditCommunities(ticker, assetType).map((c) => ({ subreddit: c.name, url: c.url }));
}
