import { describe, it, expect } from "bun:test";
import { isFinancialSic, kindForSic } from "@/lib/fundamentals/sector";

describe("kindForSic", () => {
  it("treats banks, insurers and brokers as financial, at the edges of 6000-6499", () => {
    for (const sic of [6000, 6021, 6035, 6211, 6311, 6331, 6499]) expect(kindForSic(sic)).toBe("financial");
  });

  it("keeps operating real estate (6500-6599) and other codes below 6700 as ordinary companies", () => {
    for (const sic of [5999, 6500, 6531, 6552, 6599, 6600, 6699]) expect(kindForSic(sic)).toBe("operating");
  });

  it("keeps asset managers (6282) and blank-check companies (6770) as ordinary companies", () => {
    expect(kindForSic(6282)).toBe("operating");
    expect(kindForSic(6770)).toBe("operating");
  });

  it("treats 6700-6799 as financial except blank checks (6770) and REITs (6798)", () => {
    expect(kindForSic(6700)).toBe("financial");
    expect(kindForSic(6769)).toBe("financial");
    expect(kindForSic(6771)).toBe("financial");
    expect(kindForSic(6799)).toBe("financial");
    expect(kindForSic(6798)).toBe("reit");
  });

  it("treats codes outside 6000-6799, and a missing code, as ordinary companies", () => {
    expect(kindForSic(6800)).toBe("operating");
    expect(kindForSic(3571)).toBe("operating");
    expect(kindForSic(null)).toBe("operating");
  });
});

describe("isFinancialSic", () => {
  it("is true only for the financial kind", () => {
    expect(isFinancialSic(6021)).toBe(true);
    expect(isFinancialSic(6798)).toBe(false);
    expect(isFinancialSic(6770)).toBe(false);
    expect(isFinancialSic(6531)).toBe(false);
    expect(isFinancialSic(null)).toBe(false);
  });
});
