import { describe, expect, it } from "bun:test";
import { getGlossaryEntry } from "@/lib/glossary";

const NEW_TERMS: Array<[string, string]> = [
  ["CAGR", "CAGR"],
  ["Drawdown", "Drawdown"],
  ["Rebalance", "Rebalance"],
  ["Backtest", "Backtest"],
  ["TFSA", "TFSA"],
  ["Percentile", "Percentile"],
  ["Deflated Sharpe Ratio", "Deflated Sharpe Ratio"],
];

describe("glossary terms for the landing and tools", () => {
  for (const [term, label] of NEW_TERMS) {
    it(`explains ${term} in plain words`, () => {
      const entry = getGlossaryEntry(term);
      expect(entry?.label).toBe(label);
      // One to two sentences each, no advice wording.
      for (const text of [entry?.what ?? "", entry?.means ?? ""]) {
        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
        expect(sentences.length).toBeGreaterThanOrEqual(1);
        expect(sentences.length).toBeLessThanOrEqual(2);
        expect(text).not.toMatch(/\bshould (buy|sell)\b|\byou should invest\b/i);
        expect(text).not.toMatch(/—/);
      }
    });
  }

  it("keeps Sharpe Ratio and Deflated Sharpe Ratio separate", () => {
    expect(getGlossaryEntry("Sharpe Ratio")?.label).toBe("Sharpe Ratio");
    expect(getGlossaryEntry("Deflated Sharpe Ratio")?.label).toBe("Deflated Sharpe Ratio");
  });
});
