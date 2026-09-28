import { describe, expect, it, mock } from "bun:test";
import { mockModule } from "@/tests/helpers/mock-module";
import type { FastQuote } from "@/lib/fast-market";
import type { DividendHistoryItem } from "@/lib/finance";

const mockGetFastQuotes = mock(async (): Promise<Map<string, FastQuote>> => new Map([
    ["TEST", {
      ticker: "TEST",
      name: "Test ETF",
      price: 100,
      currency: "USD",
      changePercent: 0,
      change: 0,
      assetType: "ETF",
      expenseRatio: undefined,
      dividendYield: undefined,
      quoteAsOf: "2026-09-25T20:00:00.000Z",
    }],
  ]));
const mockGetFastDividendHistory = mock(async (): Promise<DividendHistoryItem[] | null> => null);

await mockModule("@/lib/fast-market", () => ({
  getFastQuotes: mockGetFastQuotes,
  getFastHistory: mock(async () => new Map()),
  getFastDividendHistory: mockGetFastDividendHistory,
  getFastEtfDetails: mock(async () => ({
    expenseRatio: 0.25,
    expenseRatioSource: "StockAnalysis",
    expenseRatioField: "Expense Ratio",
    expenseRatioInputUnit: "percent",
    expenseRatioNormalization: "percent sign stripped; value kept as percent",
    expenseRatioMeasurementDate: null,
    expenseRatioRetrievedAt: "2026-09-26T10:00:00.000Z",
  })),
  enrichEtfDetailsGaps: mock(async (details: unknown) => details),
}));

const { POST } = await import("@/app/api/etfs/sync/route");

describe("ETF sync financial fields", () => {
  it("does not use MER as dividend yield when yield is unavailable", async () => {
    const response = await POST(new Request("http://localhost/api/etfs/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "TEST" }),
    }) as Parameters<typeof POST>[0]);
    const asset = await response.json();

    expect(response.status).toBe(200);
    expect(asset.metrics.yield).toBeNull();
    expect(asset.metrics.yieldSource).toBeNull();
    expect(asset.metrics.yieldRetrievedAt).toBeNull();
    expect(asset.metrics.yieldSourceField).toBeNull();
    expect(asset.metrics.yieldInputUnit).toBeNull();
    expect(asset.metrics.yieldNormalization).toBeNull();
    expect(asset.metrics.yieldMeasurementDate).toBeNull();
    expect(asset.metrics.mer).toBe(0.25);
    expect(asset.metrics.merSource).toBe("StockAnalysis");
    expect(asset.metrics.merSourceField).toBe("Expense Ratio");
    expect(asset.metrics.merInputUnit).toBe("percent");
    expect(asset.metrics.merNormalization).toContain("percent sign stripped");
    expect(asset.metrics.merMeasurementDate).toBeNull();
    expect(asset.metrics.merRetrievedAt).toBe("2026-09-26T10:00:00.000Z");
    expect(asset.currency).toBe("USD");
    expect(asset.quoteAsOf).toBe("2026-09-25T20:00:00.000Z");
  });

  it("keeps quote fee provenance when quote value takes priority", async () => {
    mockGetFastQuotes.mockResolvedValueOnce(new Map<string, FastQuote>([
      ["TEST", {
        ticker: "TEST",
        name: "Test ETF",
        price: 100,
        currency: "USD",
        changePercent: 0,
        change: 0,
        assetType: "ETF",
        expenseRatio: 0.0945,
        expenseRatioField: "netExpenseRatio",
        expenseRatioInputUnit: "percent",
        expenseRatioNormalization: "kept as percent per netExpenseRatio field assumption",
        expenseRatioMeasurementDate: null,
        retrievedAt: "2026-09-26T11:00:00.000Z",
      }],
    ]));
    const response = await POST(new Request("http://localhost/api/etfs/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "TEST" }),
    }) as Parameters<typeof POST>[0]);
    const asset = await response.json();

    expect(asset.metrics.mer).toBe(0.0945);
    expect(asset.metrics.merSourceField).toBe("netExpenseRatio");
    expect(asset.metrics.merInputUnit).toBe("percent");
    expect(asset.metrics.merMeasurementDate).toBeNull();
    expect(asset.metrics.merRetrievedAt).toBe("2026-09-26T11:00:00.000Z");
  });

  it("attaches yield source and retrieval date when yield is known", async () => {
    mockGetFastQuotes.mockResolvedValueOnce(new Map<string, FastQuote>([
      ["TEST", {
        ticker: "TEST",
        name: "Test ETF",
        price: 100,
        currency: "USD",
        changePercent: 0,
        change: 0,
        assetType: "ETF" as const,
        expenseRatio: undefined,
        dividendYield: 1.25,
        dividendYieldField: "trailingAnnualDividendYield",
        dividendYieldInputUnit: "fraction",
        quoteAsOf: "2026-09-25T20:00:00.000Z",
        retrievedAt: "2026-09-26T10:00:00.000Z",
      }],
    ]));
    const response = await POST(new Request("http://localhost/api/etfs/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "TEST" }),
    }) as Parameters<typeof POST>[0]);
    const asset = await response.json();

    expect(asset.metrics.yield).toBe(1.25);
    expect(asset.metrics.yieldSource).toBe("Yahoo Finance quote");
    expect(asset.metrics.yieldRetrievedAt).toBe("2026-09-26T10:00:00.000Z");
    expect(asset.metrics.yieldSourceField).toBe("trailingAnnualDividendYield");
    expect(asset.metrics.yieldInputUnit).toBe("fraction");
    expect(asset.metrics.yieldNormalization).toBe("fraction × 100 to percent");
    expect(asset.metrics.yieldMeasurementDate).toBeNull();
  });

  it("calculates a sourced trailing yield from complete cash distribution history", async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    mockGetFastDividendHistory.mockResolvedValueOnce([
      { date: sixMonthsAgo.toISOString(), amount: 2.5 },
      { date: sixMonthsAgo.toISOString(), amount: 2.5 },
    ]);

    const response = await POST(new Request("http://localhost/api/etfs/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "TEST" }),
    }) as Parameters<typeof POST>[0]);
    const asset = await response.json();

    expect(asset.metrics.yield).toBe(5);
    expect(asset.metrics.yieldSource).toBe("Yahoo Finance dividend history (TTM)");
    expect(asset.metrics.yieldNormalization).toContain("cash distributions");
    expect(asset.metrics.yieldMeasurementDate).toBe("2026-09-25T20:00:00.000Z");
    expect(asset.metrics.yieldSourceField).toBeNull();
  });

  it("reports a complete no-distribution year as a known zero yield", async () => {
    mockGetFastDividendHistory.mockResolvedValueOnce([]);

    const response = await POST(new Request("http://localhost/api/etfs/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "TEST" }),
    }) as Parameters<typeof POST>[0]);
    const asset = await response.json();

    expect(asset.metrics.yield).toBe(0);
    expect(asset.metrics.yieldSource).toBe("Yahoo Finance dividend history (TTM)");
  });
});
