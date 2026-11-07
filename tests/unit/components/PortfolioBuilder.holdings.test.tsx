import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("@/hooks/useBankOfCanadaFx", () => ({
  useBankOfCanadaFx: () => ({ data: null }),
}));
await mockModule("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
    measureElement: () => {},
  }),
}));
await mockModule("@/components/PortfolioItemRow", () => ({
  default: () => null,
}));
await mockModule("@/components/WealthProjector", () => ({ default: () => null }));
await mockModule("@/components/OptimizationPanel", () => ({ default: () => <div>Optimizer model</div> }));
await mockModule("@/components/AlgorithmExplainer", () => ({ default: () => null }));
await mockModule("@/components/RiskReturnScatter", () => ({ default: () => null }));
await mockModule("@/components/PortfolioBarChart", () => ({ default: () => null }));
await mockModule("@/components/SectorPieChart", () => ({ default: () => null }));
const { default: PortfolioBuilder } = await import("@/components/PortfolioBuilder");

const freshQuote = new Date().toISOString();
const holding = (ticker: string, shares: number, price: number, sector: string) => ({
  ticker,
  name: ticker,
  currency: "USD",
  price,
  shares,
  weight: 0,
  quoteAsOf: freshQuote,
  quoteStatus: "ok",
  changePercent: 0,
  history: [],
  metrics: { yield: 1, yieldSource: "test" },
  allocation: { equities: 100, bonds: 0, cash: 0 },
  sectors: { [sector]: 1 },
});
const callbacks = {
  onRemove: () => {},
  onUpdateWeight: () => {},
  onUpdateShares: () => {},
  onClear: () => {},
};

afterEach(cleanup);

describe("PortfolioBuilder Sector X-Ray without target weights", () => {
  it("derives sector shares from market value when every target weight is zero", () => {
    // 10 x $100 = $1,000 technology; 10 x $300 = $3,000 financials.
    render(
      <PortfolioBuilder
        portfolio={[holding("AAA", 10, 100, "technology"), holding("BBB", 10, 300, "financials")] as any}
        {...callbacks}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Allocation" }));

    expect(screen.queryByText("Add holdings to see exposure")).toBeNull();
    expect(screen.getByText("Technology")).toBeTruthy();
    expect(screen.getByText("25.0%")).toBeTruthy();
    expect(screen.getByText("Financials")).toBeTruthy();
    expect(screen.getByText("75.0%")).toBeTruthy();
  });
});

describe("PortfolioBuilder loading state", () => {
  it("shows a skeleton instead of the empty state while holdings load", () => {
    render(<PortfolioBuilder portfolio={[] as any} isLoading {...callbacks} />);

    expect(screen.queryByText("Add assets from Markets, ETFs or Stocks")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading holdings" })).toBeTruthy();
  });

  it("keeps the empty state once loading is finished", () => {
    render(<PortfolioBuilder portfolio={[] as any} isLoading={false} {...callbacks} />);

    expect(screen.getByText("Add assets from Markets, ETFs or Stocks")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading holdings" })).toBeNull();
  });
});
