import { describe, expect, it } from "bun:test";
import {
  availableRoom,
  cumulativeRoom,
  overContributionTax,
  projectContributions,
  TFSA_LATEST_YEAR,
  TFSA_LIMITS,
} from "@/lib/tfsa";

describe("cumulativeRoom", () => {
  it("matches the CRA total for someone eligible since 2009", () => {
    // 4 x 5,000 + 2 x 5,500 + 10,000 + 3 x 5,500 + 4 x 6,000 + 6,500 + 3 x 7,000
    expect(cumulativeRoom(1990, 2026)).toBe(109000);
  });

  it("starts in the year the person turned 18", () => {
    expect(cumulativeRoom(2023, 2026)).toBe(6500 + 7000 + 7000 + 7000);
    expect(cumulativeRoom(2026, 2026)).toBe(7000);
  });

  it("is zero before the person turns 18 and does not invent future limits", () => {
    expect(cumulativeRoom(2030, 2026)).toBe(0);
    expect(cumulativeRoom(2024, 2040)).toBe(cumulativeRoom(2024, TFSA_LATEST_YEAR));
  });

  it("has a limit for every year from 2009", () => {
    for (let y = 2009; y <= TFSA_LATEST_YEAR; y++) expect(TFSA_LIMITS[y]).toBeGreaterThan(0);
  });
});

describe("availableRoom", () => {
  it("adds earlier withdrawals back and subtracts contributions", () => {
    const room = availableRoom({ yearTurned18: 2023, year: 2026, contributedBefore: 10000, withdrawnBefore: 2000, contributedThisYear: 1000 });
    expect(room).toBe(27500 - 10000 + 2000 - 1000);
  });

  it("goes negative when someone has put in more than their room", () => {
    expect(availableRoom({ yearTurned18: 2026, year: 2026, contributedBefore: 0, withdrawnBefore: 0, contributedThisYear: 8000 })).toBe(-1000);
  });

  it("rejects negative amounts", () => {
    expect(() => availableRoom({ yearTurned18: 2020, year: 2026, contributedBefore: -1, withdrawnBefore: 0 })).toThrow(RangeError);
  });
});

describe("overContributionTax", () => {
  it("charges 1% a month on the excess", () => {
    expect(overContributionTax(1000, 3)).toBeCloseTo(30);
    expect(overContributionTax(0, 12)).toBe(0);
  });
});

describe("projectContributions", () => {
  it("with a 0% return the balance is the money put in", () => {
    const p = projectContributions({ monthly: 100, years: 5, annualReturn: 0 });
    expect(p).toHaveLength(5);
    expect(p[4].balance).toBeCloseTo(6000);
    expect(p[4].contributed).toBe(6000);
  });

  it("grows a single starting balance at the annual rate", () => {
    const p = projectContributions({ monthly: 0, years: 10, annualReturn: 0.06, startBalance: 1000 });
    expect(p[9].balance).toBeCloseTo(1000 * 1.06 ** 10, 6);
  });

  it("beats the money put in when the return is positive, and trails it when negative", () => {
    expect(projectContributions({ monthly: 200, years: 10, annualReturn: 0.05 })[9].balance).toBeGreaterThan(24000);
    expect(projectContributions({ monthly: 200, years: 10, annualReturn: -0.05 })[9].balance).toBeLessThan(24000);
  });

  it("rejects an unusable horizon or return", () => {
    expect(() => projectContributions({ monthly: 100, years: 0, annualReturn: 0.05 })).toThrow(RangeError);
    expect(() => projectContributions({ monthly: 100, years: 5, annualReturn: -1 })).toThrow(RangeError);
  });
});
