import { describe, expect, it } from "bun:test";
import { MAX_SCENARIO_AMOUNT, projectContributionScenario } from "@/lib/math/scenario";

describe("projectContributionScenario amount limits", () => {
  it("exports a limit of one trillion", () => {
    expect(MAX_SCENARIO_AMOUNT).toBe(1e12);
  });

  it("accepts an amount exactly at the limit", () => {
    const points = projectContributionScenario(MAX_SCENARIO_AMOUNT, 0, 1, 0);
    expect(points).toHaveLength(2);
    expect(points[1].balance).toBe(MAX_SCENARIO_AMOUNT);
  });

  it("throws for a starting balance above the limit", () => {
    expect(() => projectContributionScenario(MAX_SCENARIO_AMOUNT * 10, 0, 1, 0)).toThrow(RangeError);
    expect(() => projectContributionScenario(MAX_SCENARIO_AMOUNT * 10, 0, 1, 0)).toThrow("Amount is too large");
  });

  it("throws for a monthly contribution above the limit", () => {
    expect(() => projectContributionScenario(0, MAX_SCENARIO_AMOUNT + 1, 1, 0)).toThrow("Amount is too large");
  });

  it("throws for non-finite amounts", () => {
    expect(() => projectContributionScenario(Infinity, 0, 1, 0)).toThrow(RangeError);
    expect(() => projectContributionScenario(0, Number.NaN, 1, 0)).toThrow(RangeError);
  });
});

describe("impliedAnnualReturn", () => {
  it("is the compound annual growth rate without contributions", async () => {
    const { impliedAnnualReturn } = await import("@/lib/math/scenario");
    expect(impliedAnnualReturn(1000, 0, 10, 1000 * 1.07 ** 10)).toBeCloseTo(0.07, 8);
  });

  it("inverts the contribution projection", async () => {
    const { impliedAnnualReturn, projectContributionScenario } = await import("@/lib/math/scenario");
    const end = projectContributionScenario(5000, 400, 15, 0.06).at(-1)!.balance;
    expect(impliedAnnualReturn(5000, 400, 15, end)).toBeCloseTo(0.06, 8);
  });

  it("returns null when nothing fits or inputs are unusable", async () => {
    const { impliedAnnualReturn } = await import("@/lib/math/scenario");
    expect(impliedAnnualReturn(1000, 0, 10, 1e30)).toBeNull();
    expect(impliedAnnualReturn(0, 0, 10, 100)).toBeNull();
    expect(impliedAnnualReturn(1000, 0, 10, Number.NaN)).toBeNull();
  });
});
