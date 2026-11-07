import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mockModule } from "@/tests/helpers/mock-module";

const invalidateMarketCache = mock((_tickers?: string[]) => {});
const getFastQuotes = mock(async (): Promise<Map<string, unknown>> => new Map());

await mockModule("@/lib/fast-market", () => ({
  getFastQuotes,
  getFastHistory: mock(async () => new Map()),
  getFastDividendHistories: mock(async () => new Map()),
  invalidateMarketCache,
  quoteToAsset: mock((q: Record<string, unknown>) => q),
}));

const { POST } = await import("@/app/api/market/refresh/route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/market/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as Parameters<typeof POST>[0]);

beforeEach(() => {
  invalidateMarketCache.mockClear();
  getFastQuotes.mockClear();
});

describe("POST /api/market/refresh", () => {
  it("never clears the whole cache when no tickers are given", async () => {
    for (const body of ["", "{}", { tickers: [] }, "not json"]) {
      const res = await post(body);
      expect(res.status).toBe(200);
      expect((await res.json()).count).toBe(0);
    }
    expect(invalidateMarketCache).not.toHaveBeenCalled();
    expect(getFastQuotes).not.toHaveBeenCalled();
  });

  it("clears only the tickers it was given", async () => {
    await post({ tickers: ["aapl", "XIC.TO"] });
    expect(invalidateMarketCache).toHaveBeenCalledTimes(1);
    expect(invalidateMarketCache.mock.calls[0][0]).toEqual(["AAPL", "XIC.TO"]);
  });

  it("serves a ticker from cache if it was refreshed seconds ago", async () => {
    await post({ tickers: ["MSFT"] });
    invalidateMarketCache.mockClear();

    const again = await post({ tickers: ["MSFT", "NVDA"] });

    expect(invalidateMarketCache.mock.calls[0][0]).toEqual(["NVDA"]);
    expect((await again.json()).message).toContain("1 refreshed moments ago");
  });
});
