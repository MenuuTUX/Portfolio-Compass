import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ETF, PortfolioItem } from "@/types";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("next/image", () => ({ default: ({ alt }: { alt?: string }) => <img alt={alt} /> }));
await mockModule("framer-motion", () => ({
  motion: new Proxy({}, { get: () => "div" }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
await mockModule("recharts", () => ({
  ScatterChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Scatter: ({ data }: { data: { ticker: string }[] }) => (
    <div data-testid="scatter-tickers">{data.map((point) => point.ticker).join(",")}</div>
  ),
  XAxis: () => null,
  YAxis: () => null,
  ZAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReferenceLine: () => null,
  Label: () => null,
}));

const { default: PortfolioItemRow } = await import("@/components/PortfolioItemRow");
const { default: RiskReturnScatter } = await import("@/components/RiskReturnScatter");
const { default: TrendingSection } = await import("@/components/TrendingSection");
const { applyMarketFilters, DEFAULT_MARKET_FILTERS } = await import("@/components/MarketFilters");

const yahooFund: ETF = {
  ticker: "XIC.TO",
  name: "iShares Core S&P/TSX Capped Composite Index ETF",
  price: 57,
  currency: "CAD",
  quoteAsOf: "2026-09-26T10:00:00.000Z",
  quoteStatus: "ok",
  changePercent: 0.3,
  assetType: "ETF",
  history: [],
  metrics: {
    mer: 0.06,
    yield: 1.2779,
    yieldSource: "Yahoo Finance quote",
    yieldRetrievedAt: "2026-09-26T10:00:00.000Z",
    yieldSourceField: "trailingAnnualDividendYield",
    yieldInputUnit: "fraction",
    yieldNormalization: "fraction × 100 to percent",
    yieldMeasurementDate: null,
  },
  allocation: { equities: 100, bonds: 0, cash: 0 },
};

const issuerFund: ETF = {
  ...yahooFund,
  ticker: "ISSUER",
  name: "Issuer Fund",
  metrics: { mer: 0.1, yield: 2.5, yieldSource: "Issuer factsheet" },
};

const unattributedFund: ETF = {
  ...yahooFund,
  ticker: "UNKNOWN",
  metrics: { yield: 5 },
  dividendYield: 5,
};

afterEach(cleanup);

describe("Yahoo yield provenance surfaces", () => {
  it("withholds Yahoo yield from portfolio rows while retaining provenance", () => {
    render(
      <table><tbody><PortfolioItemRow
        item={{ ...yahooFund, shares: 1, weight: 100 } as unknown as PortfolioItem}
        virtualRow={{ index: 0 } as any}
        measureElement={() => {}}
        onRemove={() => {}}
        onUpdateWeight={() => {}}
        onUpdateShares={() => {}}
      /></tbody></table>,
    );

    expect(screen.getByText("Yahoo yield unavailable:")).toBeTruthy();
    expect(screen.queryByText("1.28%")).toBeNull();
    const yieldValue = screen.getAllByText("N/A").find((element) => element.getAttribute("title"));
    expect(yieldValue?.getAttribute("title")).toContain("trailingAnnualDividendYield");
    expect(yieldValue?.getAttribute("title")).toContain("measurement date not supplied");
  });

  it("withholds a source-free positive yield from the portfolio row", () => {
    render(
      <table><tbody><PortfolioItemRow
        item={{ ...unattributedFund, shares: 1, weight: 100 } as unknown as PortfolioItem}
        virtualRow={{ index: 0 } as any}
        measureElement={() => {}}
        onRemove={() => {}}
        onUpdateWeight={() => {}}
        onUpdateShares={() => {}}
      /></tbody></table>,
    );

    expect(screen.getByText("Yield:")).toBeTruthy();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.queryByText("5.00%")).toBeNull();
  });

  it("withholds Yahoo yield from trending cards and names the provenance", () => {
    render(
      <TrendingSection
        title="Trending"
        items={[yahooFund]}
        Icon={() => <span />}
        theme="amber"
        onAddToPortfolio={async () => {}}
        onSelectItem={() => {}}
      />,
    );

    expect(screen.getByText("N/A")).toBeTruthy();
    expect(screen.queryByText("1.28%")).toBeNull();
    expect(screen.getByText("Unverified yield unavailable")).toBeTruthy();
  });

  it("withholds a source-free positive yield from trending cards", () => {
    render(
      <TrendingSection
        title="Trending"
        items={[unattributedFund]}
        Icon={() => <span />}
        theme="amber"
        onAddToPortfolio={async () => {}}
        onSelectItem={() => {}}
      />,
    );

    expect(screen.getByText("N/A")).toBeTruthy();
    expect(screen.queryByText("5.00%")).toBeNull();
  });

  it("omits Yahoo quote yields from the risk/yield chart", () => {
    render(
      <RiskReturnScatter
        items={[
          { ...yahooFund, beta: 1.1, weight: 50 } as unknown as PortfolioItem,
          { ...issuerFund, beta: 0.9, weight: 50 } as unknown as PortfolioItem,
          { ...unattributedFund, beta: 1.2, weight: 25 } as unknown as PortfolioItem,
        ]}
      />,
    );

    expect(screen.getByTestId("scatter-tickers").textContent).toBe("ISSUER");
    expect(screen.getByText(/Yahoo quote yields are excluded/)).toBeTruthy();
  });

  it("excludes Yahoo quote yields from yield filters and sorts them after sourced yields", () => {
    const unattributedFund: ETF = {
      ...yahooFund,
      ticker: "UNKNOWN",
      metrics: { yield: 5 },
      dividendYield: 5,
    };
    const items = [yahooFund, unattributedFund, issuerFund];
    expect(applyMarketFilters(items, { ...DEFAULT_MARKET_FILTERS, yieldFilter: "any" }).map((item) => item.ticker))
      .toEqual(["ISSUER"]);
    expect(applyMarketFilters(items, { ...DEFAULT_MARKET_FILTERS, yieldFilter: "high" }).map((item) => item.ticker))
      .toEqual([]);
    expect(applyMarketFilters(items, { ...DEFAULT_MARKET_FILTERS, sort: "yield_desc" }).map((item) => item.ticker))
      .toEqual(["ISSUER", "XIC.TO", "UNKNOWN"]);
  });

  it("uses only sourced valid expense ratios in fee filters and sorts", () => {
    const items = [
      { ...yahooFund, ticker: "MISSING_SOURCE", metrics: { mer: 0.01 } },
      { ...yahooFund, ticker: "NEGATIVE", metrics: { mer: -0.1, merSource: "StockAnalysis" } },
      { ...yahooFund, ticker: "NONFINITE", metrics: { mer: Number.POSITIVE_INFINITY, merSource: "Yahoo Finance" } },
      { ...yahooFund, ticker: "ZERO", metrics: { mer: 0, merSource: "Yahoo Finance" } },
      { ...yahooFund, ticker: "VALID", metrics: { mer: 0.08, merSource: "StockAnalysis" } },
    ];

    expect(applyMarketFilters(items, { ...DEFAULT_MARKET_FILTERS, mer: "any" }).map((item) => item.ticker))
      .toEqual(["ZERO", "VALID"]);
    expect(applyMarketFilters(items, { ...DEFAULT_MARKET_FILTERS, sort: "mer_asc" }).map((item) => item.ticker))
      .toEqual(["ZERO", "VALID", "MISSING_SOURCE", "NEGATIVE", "NONFINITE"]);
  });
});

describe("Portfolio holding edits", () => {
  it("lets users change the target weight", () => {
    let updated: { ticker: string; weight: number } | undefined;
    render(
      <table><tbody><PortfolioItemRow
        item={{ ...yahooFund, shares: 1, weight: 100 } as unknown as PortfolioItem}
        virtualRow={{ index: 0 } as any}
        measureElement={() => {}}
        onRemove={() => {}}
        onUpdateWeight={(ticker, weight) => { updated = { ticker, weight }; }}
        onUpdateShares={() => {}}
      /></tbody></table>,
    );

    const allocationControl = screen.getByRole("slider", { name: "Weight for XIC.TO" });
    fireEvent.change(allocationControl, { target: { value: "35" } });
    expect(updated).toEqual({ ticker: "XIC.TO", weight: 35 });
  });
});
