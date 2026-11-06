import { describe, expect, it } from "bun:test";
import { calculateOverlapFromHoldings } from "@/lib/analytics";

describe("calculateOverlapFromHoldings ticker identity", () => {
  it("treats BRK.B and BRK-B as the same holding", () => {
    const result = calculateOverlapFromHoldings(
      [{ ticker: "BRK.B", name: "Berkshire", weight: 4 }],
      [{ ticker: "BRK-B", name: "Berkshire B", weight: 3 }],
    );
    expect(result.commonHoldings).toHaveLength(1);
    expect(result.commonHoldings[0].ticker).toBe("BRK-B");
    expect(result.overlapScore).toBe(3);
  });
});

describe("calculateOverlapFromHoldings lower bound", () => {
  it("says the overlap is a lower bound when only disclosed top holdings are supplied", () => {
    const result = calculateOverlapFromHoldings(
      [{ ticker: "AAPL", name: "Apple", weight: 20 }],
      [{ ticker: "AAPL", name: "Apple", weight: 10 }, { ticker: "MSFT", name: "Microsoft", weight: 10 }],
    );
    expect(result.lowerBound).toBe(true);
    expect(result.label).toMatch(/at least 10%/i);
    expect(result.label).toMatch(/disclosed/i);
  });

  it("is exact when both lists cover 100 percent", () => {
    const result = calculateOverlapFromHoldings(
      [{ ticker: "AAPL", name: "Apple", weight: 60 }, { ticker: "MSFT", name: "Microsoft", weight: 40 }],
      [{ ticker: "AAPL", name: "Apple", weight: 50 }, { ticker: "NVDA", name: "Nvidia", weight: 50 }],
    );
    expect(result.lowerBound).toBe(false);
    expect(result.label).toBe("50% overlap");
  });

  it("has no label when the feed is overfull", () => {
    const result = calculateOverlapFromHoldings(
      [{ ticker: "AAPL", name: "Apple", weight: 80 }, { ticker: "MSFT", name: "Microsoft", weight: 40 }],
      [{ ticker: "AAPL", name: "Apple", weight: 10 }],
    );
    expect(result.status).toBe("overfull");
    expect(result.label).toBeNull();
  });
});
