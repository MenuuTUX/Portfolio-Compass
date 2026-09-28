import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { mockModule } from "@/tests/helpers/mock-module";

const fxDate = new Date().toISOString().slice(0, 10);
let fxData: { usdCad: number; date: string } | null = { usdCad: 1.4, date: fxDate };
await mockModule("@/hooks/useBankOfCanadaFx", () => ({
  useBankOfCanadaFx: () => ({ data: fxData }),
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
await mockModule("@/components/WealthProjector", () => ({ default: (props: any) => <div>Projection model {props.startingValue} {props.baseCurrency} {props.fxProvenance?.date}</div> }));
await mockModule("@/components/OptimizationPanel", () => ({ default: () => <div>Optimizer model</div> }));
await mockModule("@/components/ContributePopup", () => ({ default: () => null }));
await mockModule("@/components/AlgorithmExplainer", () => ({ default: () => null }));
await mockModule("@/components/RiskReturnScatter", () => ({ default: () => null }));
await mockModule("@/components/PortfolioBarChart", () => ({ default: () => null }));
await mockModule("@/components/SectorPieChart", () => ({ default: () => null }));
const { default: PortfolioBuilder } = await import("@/components/PortfolioBuilder");

const freshQuote = new Date().toISOString();
const holding = (ticker: string, currency: "USD" | "CAD", price: number) => ({
  ticker,
  name: ticker,
  currency,
  price,
  shares: 1,
  weight: 50,
  quoteAsOf: freshQuote,
  quoteStatus: "ok",
  changePercent: 0,
  history: [],
  metrics: { yield: 1, yieldSource: "test" },
  allocation: { equities: 100, bonds: 0, cash: 0 },
});
const callbacks = {
  onRemove: () => {},
  onUpdateWeight: () => {},
  onUpdateShares: () => {},
  onClear: () => {},
};

describe("PortfolioBuilder currency behavior", () => {
  afterEach(cleanup);

  it("converts fresh mixed USD/CAD holdings, enables the simple projection, and gates optimization", () => {
    render(
      <PortfolioBuilder
        portfolio={[holding("US", "USD", 100), holding("CA", "CAD", 100)] as any}
        {...callbacks}
      />,
    );

    expect(screen.getByText((text) => text.includes("CAD") && text.includes("240.00"))).toBeTruthy();
    expect(screen.getByText(`Values converted to CAD using Bank of Canada FXUSDCAD daily average dated ${fxDate}.`)).toBeTruthy();
    expect(screen.getByText(/simple projection starts from today's CAD-converted value/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "See Growth Projection" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("Optimizer model")).toBeNull();
    const projection = screen.getByRole("button", { name: "See Growth Projection" });
    expect(projection.hasAttribute("disabled")).toBe(false);
    fireEvent.click(projection);
    expect(screen.getByText(`Projection model 240 CAD ${fxDate}`)).toBeTruthy();
  });

  it("fails closed for projection when the dated FX rate is stale", () => {
    fxData = { usdCad: 1.4, date: "2020-01-01" };
    render(
      <PortfolioBuilder
        portfolio={[holding("US", "USD", 100), holding("CA", "CAD", 100)] as any}
        {...callbacks}
      />,
    );
    expect(screen.getByRole("button", { name: "See Growth Projection" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/daily FX rate is unavailable/)).toBeTruthy();
    fxData = { usdCad: 1.4, date: fxDate };
  });

  it("keeps projection and optimization available for same-currency holdings", () => {
    render(
      <PortfolioBuilder
        portfolio={[holding("US", "USD", 100)] as any}
        {...callbacks}
      />,
    );

    expect(screen.getByText((text) => text.includes("USD") && text.includes("100.00"))).toBeTruthy();
    expect(screen.getByText("Optimizer model")).toBeTruthy();
    const allocationMode = screen.getByRole("button", { name: "Allocation Mode" });
    fireEvent.click(allocationMode);
    expect(screen.queryByText("Optimizer model")).toBeNull();
    fireEvent.click(allocationMode);
    expect(screen.getByText("Optimizer model")).toBeTruthy();
    const projection = screen.getByRole("button", { name: "See Growth Projection" });
    expect(projection.hasAttribute("disabled")).toBe(false);
    fireEvent.click(projection);
    expect(screen.getByText((text) => text.includes("Projection model") && text.includes("100") && text.includes("USD"))).toBeTruthy();
  });

  it("hides optimization when an unheld candidate uses another currency", () => {
    render(
      <PortfolioBuilder
        portfolio={[
          { ...holding("US", "USD", 100), shares: 1, weight: 100 },
          { ...holding("CA", "CAD", 100), shares: 0, weight: 0 },
        ] as any}
        {...callbacks}
      />,
    );

    expect(screen.getByText((text) => text.includes("USD") && text.includes("100.00"))).toBeTruthy();
    expect(screen.queryByText("Optimizer model")).toBeNull();
    expect(screen.getByRole("button", { name: "See Growth Projection" }).hasAttribute("disabled")).toBe(false);
  });
});
