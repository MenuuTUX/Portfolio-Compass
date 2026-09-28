import { describe, expect, it } from "bun:test";
import { getPortfolioFlowData } from "@/lib/portfolio-sankey";
import { PortfolioItem } from "@/types";

function makeItem(
  partial: Partial<PortfolioItem> & { ticker: string },
): PortfolioItem {
  return {
    name: partial.name ?? partial.ticker,
    price: 100,
    changePercent: 0,
    history: [],
    metrics: { mer: 0, yield: 0 },
    allocation: { equities: 100, bonds: 0, cash: 0 },
    weight: 0,
    shares: 0,
    ...partial,
  };
}

describe("getPortfolioFlowData", () => {
  it("connects holdings to sectors and fills the unallocated cash buffer", () => {
    const data = getPortfolioFlowData([
      makeItem({
        ticker: "VTI",
        weight: 60,
        sectors: { technology: 0.5, healthcare: 0.5 },
      }),
      makeItem({ ticker: "JPM", weight: 30, sector: "Financials" }),
    ]);

    expect(data.nodes.at(-1)).toEqual({ name: "Portfolio total", value: 100 });
    const nodeIndex = new Map(data.nodes.map((node, index) => [node.name, index]));
    const indexOf = (name: string) => nodeIndex.get(name) as number;
    expect(data.links).toContainEqual({
      source: indexOf("VTI"),
      target: indexOf("Technology"),
      value: 30,
    });
    expect(data.links).toContainEqual({
      source: indexOf("VTI"),
      target: indexOf("Healthcare"),
      value: 30,
    });
    expect(data.links).toContainEqual({
      source: indexOf("JPM"),
      target: indexOf("Financials"),
      value: 30,
    });
    expect(data.nodes).toContainEqual({ name: "Cash", value: 10 });
  });

  it("groups lower-weight sources into one readable node", () => {
    const data = getPortfolioFlowData(
      Array.from({ length: 10 }, (_, index) =>
        makeItem({
          ticker: `ETF${index}`,
          weight: 5,
          sector: "Equities",
        }),
      ),
    );

    expect(data.nodes.filter((node) => node.name === "Other holdings")).toHaveLength(1);
    expect(data.nodes.filter((node) => node.name.startsWith("ETF"))).toHaveLength(7);
  });
});
