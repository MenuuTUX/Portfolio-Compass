import { describe, expect, it } from "bun:test";
import { describeExpenseRatioProvenance, getSourcedExpenseRatio } from "@/lib/fee-provenance";

describe("sourced expense ratios", () => {
  it("requires a source and a finite nonnegative percent", () => {
    expect(getSourcedExpenseRatio({ mer: 0.25, merSource: "Yahoo Finance quote" })).toBe(0.25);
    expect(getSourcedExpenseRatio({ mer: 0, merSource: "Issuer factsheet" })).toBe(0);
    expect(getSourcedExpenseRatio({ mer: 0.25 })).toBeNull();
    expect(getSourcedExpenseRatio({ mer: 0.25, merSource: " " })).toBeNull();
    expect(getSourcedExpenseRatio({ mer: Number.NaN, merSource: "Issuer factsheet" })).toBeNull();
    expect(getSourcedExpenseRatio({ mer: Number.POSITIVE_INFINITY, merSource: "Issuer factsheet" })).toBeNull();
    expect(getSourcedExpenseRatio({ mer: -0.01, merSource: "Issuer factsheet" })).toBeNull();
  });

  it("states the provider field and missing measurement date", () => {
    const detail = describeExpenseRatioProvenance({
      merSource: "Yahoo Finance quote",
      merSourceField: "netExpenseRatio",
      merInputUnit: "percent",
      merNormalization: "kept as percent per field assumption",
      merMeasurementDate: null,
      merRetrievedAt: "2026-09-26T12:00:00.000Z",
    });
    expect(detail).toContain("field netExpenseRatio");
    expect(detail).toContain("input unit: percent");
    expect(detail).toContain("measurement date not supplied");
    expect(detail).toContain("MER equivalence unverified");
  });
});
