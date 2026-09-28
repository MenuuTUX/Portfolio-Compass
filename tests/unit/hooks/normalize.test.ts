import { describe, expect, it } from "bun:test";
import { toPortfolioEtf } from "@/hooks/normalize";

describe("portfolio quote normalization", () => {
  it("preserves the raw Yahoo yield field and measurement-date limit", () => {
    const asset = toPortfolioEtf({
      ticker: "QQQ",
      price: 100,
      metrics: {
        mer: 0.03,
        merSource: "Yahoo Finance fund profile",
        merSourceField: "annualReportExpenseRatio",
        merInputUnit: "fraction",
        merNormalization: "interpreted as fraction; multiplied by 100",
        merMeasurementDate: null,
        yield: 1.4,
        yieldSource: "Yahoo Finance quote",
        yieldSourceField: "trailingAnnualDividendYield",
        yieldInputUnit: "fraction",
        yieldNormalization: "fraction × 100 to percent",
        yieldMeasurementDate: null,
      },
    }, "QQQ");

    expect(asset.metrics).toMatchObject({
      mer: 0.03,
      merSourceField: "annualReportExpenseRatio",
      merInputUnit: "fraction",
      merNormalization: "interpreted as fraction; multiplied by 100",
      merMeasurementDate: null,
      yield: 1.4,
      yieldSourceField: "trailingAnnualDividendYield",
      yieldInputUnit: "fraction",
      yieldNormalization: "fraction × 100 to percent",
      yieldMeasurementDate: null,
    });
  });
});
