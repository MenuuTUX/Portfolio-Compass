import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useBatchAddPortfolio } from "@/hooks/useBatchAddPortfolio";
import { loadPortfolio, savePortfolio } from "@/lib/storage";

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
const originalFetch = globalThis.fetch;

function Harness() {
  const mutation = useBatchAddPortfolio();
  return <button onClick={() => mutation.mutateAsync({
    items: [{ ticker: "A", weight: 60, shares: 0 }, { ticker: "B", weight: 40, shares: 0 }],
    replace: true,
  }).then(() => document.body.dataset.result = "success").catch((error) => {
    document.body.dataset.result = error.message;
  })}>Replace</button>;
}

function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  localStorage.clear();
  delete document.body.dataset.result;
});

describe("useBatchAddPortfolio replacement", () => {
  it("keeps existing holdings when any requested ticker lacks a valid quote", async () => {
    savePortfolio([{ ticker: "EXISTING", weight: 100, shares: 3 }]);
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/etfs/search")) return Response.json([quote("A")]);
      return Response.json([]);
    }) as typeof fetch;

    mount();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));

    await waitFor(() => expect(document.body.dataset.result).toContain("B"));
    expect(loadPortfolio()).toEqual([{ ticker: "EXISTING", weight: 100, shares: 3 }]);
  });

  it("replaces holdings after every requested ticker has a valid quote", async () => {
    savePortfolio([{ ticker: "EXISTING", weight: 100, shares: 3 }]);
    globalThis.fetch = (async () => Response.json([quote("A"), quote("B")])) as unknown as typeof fetch;

    mount();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));

    await waitFor(() => expect(document.body.dataset.result).toBe("success"));
    expect(loadPortfolio()).toEqual([
      { ticker: "A", weight: 60, shares: 0 },
      { ticker: "B", weight: 40, shares: 0 },
    ]);
  });
});
