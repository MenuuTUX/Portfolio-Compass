import { describe, expect, it } from "bun:test";
import { CACHE, cacheHeaders, cacheUnlessEmpty, NO_STORE } from "@/lib/http-cache";

describe("cacheHeaders", () => {
  it("lets the browser and Vercel's CDN keep a response for different times", () => {
    expect(cacheHeaders({ browser: 5, cdn: 15, swr: 60 })).toEqual({
      "Cache-Control": "public, max-age=5, stale-while-revalidate=60",
      "Vercel-CDN-Cache-Control": "max-age=15, stale-while-revalidate=60",
    });
  });

  it("never keeps an empty answer", () => {
    expect(cacheUnlessEmpty(CACHE.search, 0)).toEqual(NO_STORE);
    expect(cacheUnlessEmpty(CACHE.search, 3)["Vercel-CDN-Cache-Control"]).toContain("max-age=30");
  });

  it("keeps the CDN no shorter than the browser for every route", () => {
    for (const spec of Object.values(CACHE)) expect(spec.cdn).toBeGreaterThanOrEqual(spec.browser);
  });
});
