import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useBatchAddPortfolio } from "@/hooks/useBatchAddPortfolio";
import { loadPortfolio, savePortfolio } from "@/lib/storage";
import { withFetch } from "@/tests/helpers/fetch";

const quote = (ticker: string) => ({
  ticker,
  name: `${ticker} fund`,
  price: 100,
  currency: "USD",
  quoteAsOf: new Date().toISOString(),
  changePercent: 0,
  history: [],
  metrics: {},
  allocation: { equities: 100, bonds: 0, cash: 0 },
});

function Harness() {
  const mutation = useBatchAddPortfolio();
  return <button onClick={() => mutation.mutateAsync({
    items: [{ ticker: "A", weight: 60, shares: 0 }, { ticker: "B", weight: 40, shares: 0 }],
    replace: true,
  }).then(() => document.body.dataset.result = "success").catch((error) => {
    document.body.dataset.result = error.message;
  })}>Replace</button>;
}

function MergeHarness() {
  const mutation = useBatchAddPortfolio();
  return <button onClick={() => mutation.mutateAsync({
    items: [{ ticker: "A", weight: 60, shares: 0 }, { ticker: "B", weight: 40, shares: 0 }],
  }).then((result) => document.body.dataset.result = JSON.stringify({ failed: result.failed }))
    .catch((error) => {
      document.body.dataset.result = error.message;
    })}>Merge</button>;
}

function mount(ui: React.ReactElement = <Harness />) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.body.dataset.result;
});

describe("useBatchAddPortfolio replacement", () => {
  it("keeps existing holdings when any requested ticker lacks a valid quote", async () => {
    savePortfolio([{ ticker: "EXISTING", weight: 100, shares: 3 }]);
    withFetch(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/etfs/search")) return Response.json([quote("A")]);
      return Response.json([]);
    });

    mount();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));

    await waitFor(() => expect(document.body.dataset.result).toContain("B"));
    expect(loadPortfolio()).toEqual([{ ticker: "EXISTING", weight: 100, shares: 3 }]);
  });

  it("replaces holdings after every requested ticker has a valid quote", async () => {
    savePortfolio([{ ticker: "EXISTING", weight: 100, shares: 3 }]);
    withFetch(async () => Response.json([quote("A"), quote("B")]));

    mount();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));

    await waitFor(() => expect(document.body.dataset.result).toBe("success"));
    expect(loadPortfolio()).toEqual([
      { ticker: "A", weight: 60, shares: 0 },
      { ticker: "B", weight: 40, shares: 0 },
    ]);
  });
});

describe("useBatchAddPortfolio merge", () => {
  it("reports tickers that could not be resolved and keeps target weights at 100", async () => {
    savePortfolio([{ ticker: "EXISTING", weight: 100, shares: 3 }]);
    withFetch(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/etfs/search")) return Response.json([quote("A")]);
      return Response.json([]);
    });

    mount(<MergeHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));

    await waitFor(() => expect(document.body.dataset.result).toContain("failed"));
    expect(JSON.parse(document.body.dataset.result!)).toEqual({ failed: ["B"] });

    const merged = loadPortfolio();
    const total = merged.reduce((sum, item) => sum + (item.weight || 0), 0);
    expect(total).toBeCloseTo(100, 6);
    expect(merged.find((item) => item.ticker === "A")?.weight).toBeCloseTo(37.5, 6);
    expect(merged.find((item) => item.ticker === "EXISTING")?.weight).toBeCloseTo(62.5, 6);
  });
});
