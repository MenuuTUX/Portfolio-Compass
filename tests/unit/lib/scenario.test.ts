import { describe, expect, it } from "bun:test";
import { projectContributionScenario } from "@/lib/math/scenario";

describe("projectContributionScenario", () => {
  it("separates contributions from gain when return is zero", () => {
    const points = projectContributionScenario(1000, 100, 1, 0);
    expect(points).toHaveLength(2);
    expect(points[1].invested).toBe(2200);
    expect(points[1].balance).toBe(2200);
    expect(points[1].gain).toBe(0);
  });

  it("applies each contribution at the beginning of the month", () => {
    const points = projectContributionScenario(0, 100, 1, 0.12);
    const rate = Math.pow(1.12, 1 / 12) - 1;
    const expected = Array.from({ length: 12 }).reduce<number>(
      (balance) => (balance + 100) * (1 + rate), 0,
    );
    expect(points[1].balance).toBeCloseTo(expected, 8);
    expect(points[1].gain).toBeCloseTo(expected - 1200, 8);
  });

  it("rejects invalid inputs rather than producing misleading numbers", () => {
    expect(projectContributionScenario(1000, -1, 1, 0.07)).toEqual([]);
    expect(projectContributionScenario(1000, 100, 1, -1)).toEqual([]);
  });
});
