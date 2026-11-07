import { afterAll, afterEach, beforeEach, describe, expect, it, setSystemTime } from "bun:test";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { savePortfolio } from "@/lib/storage";
import { withFetch } from "@/tests/helpers/fetch";

// Saturday 7 November 2026, midday New York time: the market is closed all weekend.
const SATURDAY = new Date("2026-11-07T16:00:00Z").getTime();

type Quote = { ticker: string; price: number; name?: string };
let snapshotPrice = 0;
let snapshotCalls = 0;

function stubFetch() {
  withFetch(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
    if (url.includes("/api/market/snapshot")) {
      snapshotCalls += 1;
      const quote: Quote = { ticker: "SPY", price: snapshotPrice, name: "SPDR S&P 500" };
      return body([{
        ...quote,
        currency: "USD",
        changePercent: 0,
        history: [],
        metrics: {},
        allocation: { equities: 100, bonds: 0, cash: 0 },
        assetType: "ETF",
      }]);
    }
    if (url.includes("/api/market/etf-details")) return body(null);
    return body([]);
  });
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => usePortfolio(false), { wrapper });
  return { hook, queryClient };
}

beforeEach(() => {
  localStorage.clear();
  snapshotCalls = 0;
  snapshotPrice = 0;
  setSystemTime(new Date(SATURDAY));
  stubFetch();
});

afterEach(() => {
  cleanup();
});

afterAll(() => setSystemTime());

describe("usePortfolio while the market is closed (API-B11)", () => {
  it("retries a holding whose price is still zero, but not more than once every 30 seconds", async () => {
    savePortfolio([{ ticker: "SPY", weight: 100, shares: 2 }]);
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.data?.[0]?.price).toBe(0));
    expect(snapshotCalls).toBe(1);

    // Ten seconds later: still inside the 30 second guard, so no new request.
    setSystemTime(new Date(SATURDAY + 10_000));
    await hook.result.current.refetch();
    expect(snapshotCalls).toBe(1);

    // After 31 seconds the zero price is retried and the new quote lands.
    setSystemTime(new Date(SATURDAY + 31_000));
    snapshotPrice = 512.5;
    await hook.result.current.refetch();
    expect(snapshotCalls).toBe(2);
    await waitFor(() => expect(hook.result.current.data?.[0]?.price).toBe(512.5));
  });

  it("does not refetch a healthy closed-market portfolio", async () => {
    snapshotPrice = 500;
    savePortfolio([{ ticker: "SPY", weight: 100, shares: 2 }]);
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.data?.[0]?.price).toBe(500));
    setSystemTime(new Date(SATURDAY + 120_000));
    await hook.result.current.refetch();
    expect(snapshotCalls).toBe(1);
  });

  it("picks up share edits made in another tab when the storage event fires", async () => {
    snapshotPrice = 500;
    savePortfolio([{ ticker: "SPY", weight: 100, shares: 2 }]);
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.data?.[0]?.shares).toBe(2));

    // Another tab writes new shares for the same ticker, then this tab hears about it.
    savePortfolio([{ ticker: "SPY", weight: 100, shares: 7 }]);
    window.dispatchEvent(Object.assign(new Event("storage"), { key: "portfolio_compass_v1" }));

    await waitFor(() => expect(hook.result.current.data?.[0]?.shares).toBe(7));
  });
});
