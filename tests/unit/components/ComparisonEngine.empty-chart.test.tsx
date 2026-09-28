import { afterEach, describe, expect, it, mock } from "bun:test";
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("next/image", () => ({ default: ({ alt }: { alt?: string }) => <img alt={alt} /> }));
await mockModule("framer-motion", () => ({
  motion: new Proxy({}, { get: () => "div" }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
await mockModule("@/components/Sparkline", () => ({ default: () => <div data-testid="sparkline" /> }));

const { default: ComparisonEngine } = await import("@/components/ComparisonEngine");

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

describe("ComparisonEngine empty history", () => {
  it("shows chart unavailable when comparison history is missing", async () => {
    global.fetch = mock(async () => new Response(JSON.stringify([{
      ticker: "NOHIST",
      name: "No History Fund",
      price: 24,
      currency: "USD",
      changePercent: 0,
      assetType: "ETF",
      history: [],
      metrics: {},
      allocation: { equities: 100, bonds: 0, cash: 0 },
    }]), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;

    render(<ComparisonEngine onAddToPortfolio={async () => {}} onRemoveFromPortfolio={() => {}} portfolio={[]} />);

    expect(await screen.findByText("No History Fund", {}, { timeout: 3000 })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Chart unavailable")).toBeTruthy());
    expect(screen.queryByTestId("sparkline")).toBeNull();
  });
});
