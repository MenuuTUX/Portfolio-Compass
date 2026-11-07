import { mock } from "bun:test";

type AsyncFn = (...args: any[]) => Promise<any>;

/**
 * A stand-in for the yahoo-finance2 default export plus handles to its methods.
 * Install with `await mockModule("yahoo-finance2", () => ({ default: yahoo.FakeYahooFinance }))`.
 */
export function createFakeYahoo() {
  const quote = mock<AsyncFn>(async () => []);
  const search = mock<AsyncFn>(async () => ({ quotes: [] }));
  const chart = mock<AsyncFn>(async () => ({ quotes: [] }));
  const quoteSummary = mock<AsyncFn>(async () => ({}));

  class FakeYahooFinance {
    quote = quote;
    search = search;
    chart = chart;
    quoteSummary = quoteSummary;
  }

  return { FakeYahooFinance, quote, search, chart, quoteSummary };
}
