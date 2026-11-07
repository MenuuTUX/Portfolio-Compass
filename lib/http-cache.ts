// Cache headers for the market data routes. Vercel's CDN caches a function
// response only when it sees s-maxage or Vercel-CDN-Cache-Control; a plain
// max-age reaches the browser alone, so every first visit would run the
// function and call Yahoo. See app/api/market/bars/route.ts for the same idea.

interface CacheSpec {
  /** Seconds the browser may reuse the response. */
  browser: number;
  /** Seconds Vercel's CDN may serve it without running the function. */
  cdn: number;
  /** Seconds either may serve it stale while refreshing in the background. */
  swr: number;
}

export function cacheHeaders({ browser, cdn, swr }: CacheSpec): Record<string, string> {
  return {
    "Cache-Control": `public, max-age=${browser}, stale-while-revalidate=${swr}`,
    "Vercel-CDN-Cache-Control": `max-age=${cdn}, stale-while-revalidate=${swr}`,
  };
}

/** For answers that may be empty or partial because an upstream hiccuped: never keep them. */
export const NO_STORE: Record<string, string> = {
  "Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

/** Cache a result only when it has content, so a transient empty answer is not served for minutes. */
export const cacheUnlessEmpty = (spec: CacheSpec, count: number): Record<string, string> =>
  count > 0 ? cacheHeaders(spec) : NO_STORE;

export const CACHE = {
  quotes: { browser: 5, cdn: 15, swr: 60 },
  search: { browser: 5, cdn: 30, swr: 120 },
  chart: { browser: 30, cdn: 60, swr: 300 },
  heatmap: { browser: 30, cdn: 60, swr: 300 },
  etfDetails: { browser: 60, cdn: 300, swr: 3600 },
  fxHistory: { browser: 300, cdn: 600, swr: 3600 },
  movers: { browser: 60, cdn: 120, swr: 600 },
  fearGreed: { browser: 300, cdn: 600, swr: 3600 },
  profile: { browser: 3600, cdn: 21_600, swr: 86_400 },
  valuation: { browser: 60, cdn: 300, swr: 3600 },
} satisfies Record<string, CacheSpec>;
