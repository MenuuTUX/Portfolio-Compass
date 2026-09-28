import { describe, expect, it } from "bun:test";
import { describeYieldProvenance, getSourcedYield, isUnverifiedProviderYield } from "@/lib/yield-provenance";

describe("yield provenance", () => {
  it("marks Yahoo quote values unverified and calls out definition ambiguity", () => {
    expect(isUnverifiedProviderYield("Yahoo Finance quote")).toBe(true);
    const description = describeYieldProvenance(
      "Yahoo Finance quote", "2026-09-26T10:00:00.000Z",
      "trailingAnnualDividendYield", "fraction", "fraction × 100 to percent", null,
    );
    expect(description).toContain("trailingAnnualDividendYield");
    expect(description).toContain("input unit: fraction");
    expect(description).toContain("normalized as fraction × 100 to percent");
    expect(description).toContain("measurement date not supplied");
    expect(description).toContain("Yahoo Finance quote yield unavailable");
    expect(description).toContain("definition may differ from issuer yield measures");
  });

  it("does not label issuer sourced values as Yahoo-reported", () => {
    expect(isUnverifiedProviderYield("Issuer factsheet")).toBe(false);
    expect(describeYieldProvenance("Issuer factsheet")).toBe("Issuer factsheet");
  });

  it("withholds source-free values and accepts sourced values with a fallback", () => {
    expect(getSourcedYield({ yield: 5 }, 5)).toBeNull();
    expect(getSourcedYield({ yieldSource: " " }, 5)).toBeNull();
    expect(getSourcedYield({ yieldSource: "Issuer factsheet" }, 2.5)).toBe(2.5);
    expect(getSourcedYield({ yield: 1.2779, yieldSource: "Yahoo Finance quote" }, 1.2779)).toBeNull();
    expect(getSourcedYield({ yield: 0, yieldSource: "Issuer factsheet" }, 2.5)).toBe(0);
    expect(getSourcedYield({ yield: Number.NaN, yieldSource: "Issuer factsheet" })).toBeNull();
    expect(getSourcedYield({ yield: -1, yieldSource: "Issuer factsheet" })).toBeNull();
  });
});
