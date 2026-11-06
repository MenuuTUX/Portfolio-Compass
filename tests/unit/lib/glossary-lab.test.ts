import { describe, expect, it } from "bun:test";
import { getGlossaryEntry } from "@/lib/glossary";

const LAB_TERMS: Array<[string, string]> = [
  ["Total return", "Total Return"],
  ["Sortino", "Sortino Ratio"],
  ["Calmar", "Calmar Ratio"],
  ["Turnover", "Turnover"],
  ["Alpha", "Alpha"],
  ["Positive months", "Positive Months"],
  ["Max drawdown", "Max Drawdown"],
  ["Risk-free rate", "Risk-Free Rate"],
  ["Slippage", "Slippage"],
  ["Warm-up", "Warm-Up"],
  ["Expected return", "Expected Return"],
  ["Efficient frontier", "Efficient Frontier"],
  ["Risk level", "Risk Level"],
  ["New money", "New Money"],
];

describe("glossary entries for the Backtest Lab and optimizer", () => {
  for (const [term, label] of LAB_TERMS) {
    it(`explains ${term} in one or two plain sentences`, () => {
      const entry = getGlossaryEntry(term);
      expect(entry?.label).toBe(label);
      for (const text of [entry?.what ?? "", entry?.means ?? ""]) {
        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
        expect(sentences.length).toBeGreaterThanOrEqual(1);
        expect(sentences.length).toBeLessThanOrEqual(2);
        expect(text).not.toMatch(/—/);
        expect(text).not.toMatch(/\bshould (buy|sell)\b|\byou should invest\b|\bfair value\b|\btarget price\b/i);
      }
    });
  }

  it("resolves a bare Sharpe label to the Sharpe Ratio, not Deflated Sharpe Ratio", () => {
    expect(getGlossaryEntry("Sharpe")?.label).toBe("Sharpe Ratio");
    expect(getGlossaryEntry("sharpe")?.label).toBe("Sharpe Ratio");
    expect(getGlossaryEntry("Deflated Sharpe")?.label).toBe("Deflated Sharpe Ratio");
  });

  it("describes the Lab cash rate instead of a fixed 0% risk-free rate", () => {
    const sharpe = getGlossaryEntry("Sharpe Ratio");
    expect(sharpe?.means).not.toMatch(/0% risk-free rate/);
    expect(sharpe?.means).toMatch(/cash interest rate/);
  });

  it("keeps unknown labels unexplained", () => {
    expect(getGlossaryEntry("Costs paid")).toBeNull();
  });
});
