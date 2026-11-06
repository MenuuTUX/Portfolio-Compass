import { afterEach, describe, expect, it } from "bun:test";
import { fetchWithTimeout, UPSTREAM_TIMEOUT_MS } from "@/lib/upstream";
import { getMarketMovers, getStockProfile } from "@/lib/scrapers/stock-analysis";
import { getEtfDescription } from "@/lib/scrapers/etf-dot-com";
import { fetchFearAndGreedIndex } from "@/lib/scrapers/fear-greed";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Replace fetch with a stub that records the signal each call carried. */
function stubFetch(status = 404) {
  const signals: (AbortSignal | null | undefined)[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    signals.push(init?.signal);
    return new Response("", { status });
  }) as typeof fetch;
  return signals;
}

describe("upstream timeouts", () => {
  it("fetchWithTimeout adds a signal unless the caller brought one", async () => {
    const signals = stubFetch(200);
    await fetchWithTimeout("https://example.test/a");
    const own = new AbortController();
    await fetchWithTimeout("https://example.test/b", { signal: own.signal });
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[1]).toBe(own.signal);
    expect(UPSTREAM_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });

  it("every scraper request carries an abort signal", async () => {
    const signals = stubFetch();
    await getStockProfile("AAPL");
    await getMarketMovers("gainers");
    await getEtfDescription("VOO");
    await fetchFearAndGreedIndex().catch(() => undefined);

    expect(signals.length).toBeGreaterThanOrEqual(4);
    for (const s of signals) expect(s).toBeInstanceOf(AbortSignal);
  });
});
