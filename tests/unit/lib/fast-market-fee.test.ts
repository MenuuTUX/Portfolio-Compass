import { describe, expect, it } from "bun:test";
import { mapQuote, quoteToAsset } from "@/lib/fast-market";
import { normalizeExpenseRatioWithProvenance } from "@/lib/asset-class";
import { parseExpenseRatioText } from "@/lib/scrapers/stock-analysis";
import rawFees from "@/tests/fixtures/expense-ratio-fields.json";

describe("expense-ratio source contracts", () => {
  it("retains Yahoo quote field identity, assumed unit, and unknown report date", () => {
    const quote = mapQuote(rawFees.yahooQuote);
    expect(quote.expenseRatio).toBe(0.0945);
    expect(quote.expenseRatioField).toBe("netExpenseRatio");
    expect(quote.expenseRatioInputUnit).toBe("percent");
    expect(quote.expenseRatioNormalization).toContain("field assumption");
    expect(quote.expenseRatioMeasurementDate).toBeNull();
    expect(quoteToAsset(quote).metrics).toMatchObject({
      mer: 0.0945,
      merSourceField: "netExpenseRatio",
      merInputUnit: "percent",
      merMeasurementDate: null,
    });
  });

  it("withholds an implausible quote fee instead of displaying it as a reported expense ratio", () => {
    const quote = mapQuote({ ...rawFees.yahooQuote, netExpenseRatio: 99 });
    expect(quote.expenseRatio).toBeUndefined();
    expect(quoteToAsset(quote).metrics).toMatchObject({ mer: null, merSource: null });
  });

  it("records the Yahoo fund-profile fraction conversion", () => {
    const fee = normalizeExpenseRatioWithProvenance(
      rawFees.yahooFundProfile.annualReportExpenseRatio,
      "profile",
    );
    expect(fee).toEqual({
      value: 0.03,
      sourceField: "annualReportExpenseRatio",
      inputUnit: "fraction",
      normalization: "interpreted as fraction; multiplied by 100",
      measurementDate: null,
    });
  });

  it("retains StockAnalysis percent marker and reports missing marker as unknown", () => {
    const parsed = parseExpenseRatioText(rawFees.stockAnalysis.expenseRatioText);
    expect(parsed).toEqual({ value: 0.03, inputUnit: "percent" });
    expect(normalizeExpenseRatioWithProvenance(parsed.value, "scraper", parsed.inputUnit)).toMatchObject({
      value: 0.03,
      sourceField: "Expense Ratio",
      inputUnit: "percent",
      measurementDate: null,
    });

    const noUnit = parseExpenseRatioText("0.03");
    expect(noUnit.inputUnit).toBe("unknown");
    expect(normalizeExpenseRatioWithProvenance(noUnit.value, "scraper", noUnit.inputUnit)?.normalization)
      .toContain("assumed percent");
  });
});
