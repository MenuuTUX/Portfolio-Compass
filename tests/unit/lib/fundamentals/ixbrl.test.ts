import { describe, it, expect } from "bun:test";
import { extensionDepreciation } from "@/lib/fundamentals/ixbrl";

const ctx = (id: string, s: string, e: string, dim = "") =>
  `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="x">1</xbrli:identifier>${dim}</xbrli:entity><xbrli:period><xbrli:startDate>${s}</xbrli:startDate><xbrli:endDate>${e}</xbrli:endDate></xbrli:period></xbrli:context>`;
const fact = (name: string, c: string, text: string, extra = "") => `<ix:nonFraction unitRef="usd" contextRef="${c}" decimals="-6" name="${name}" scale="6" ${extra}>${text}</ix:nonFraction>`;

const html = [
  ctx("cur", "2025-07-27", "2026-07-25"),
  ctx("prior", "2024-07-28", "2025-07-26"),
  ctx("seg", "2025-07-27", "2026-07-25", '<xbrli:segment><xbrldi:explicitMember dimension="a:b">c:d</xbrldi:explicitMember></xbrli:segment>'),
  fact("csco:DepreciationAmortizationAndOther", "cur", "2,540"),
  fact("csco:DepreciationAmortizationAndOther", "prior", "2,811"),
  fact("csco:DepreciationAmortizationAndOther", "seg", "9,999"),
  fact("us-gaap:DepreciationDepletionAndAmortization", "cur", "700"),
].join("\n");

describe("extensionDepreciation", () => {
  it("reads the extension-tagged total for the fiscal year, in dollars", () => {
    expect(extensionDepreciation(html, "2025-07-27", "2026-07-25")).toEqual({ value: 2_540_000_000, tag: "csco:DepreciationAmortizationAndOther" });
  });
  it("ignores other years, dimensioned contexts and us-gaap tags", () => {
    expect(extensionDepreciation(html, "2024-07-28", "2025-07-26")?.value).toBe(2_811_000_000);
    expect(extensionDepreciation(html.replace(/csco:/g, "us-gaap:"), "2025-07-27", "2026-07-25")).toBeNull();
  });
  it("skips negative-signed facts and unknown periods", () => {
    const neg = [ctx("cur", "2025-07-27", "2026-07-25"), fact("x:DepreciationAndAmortization", "cur", "5", 'sign="-"')].join("");
    expect(extensionDepreciation(neg, "2025-07-27", "2026-07-25")).toBeNull();
    expect(extensionDepreciation(html, "2020-01-01", "2020-12-31")).toBeNull();
  });
});

describe("coverShareCount", () => {
  const inst = (id: string, at: string, member = "") => `<xbrli:context id="${id}"><xbrli:entity>${member}</xbrli:entity><xbrli:period><xbrli:instant>${at}</xbrli:instant></xbrli:period></xbrli:context>`;
  const shares = (c: string, text: string, extra = "") => `<ix:nonFraction contextRef="${c}" name="dei:EntityCommonStockSharesOutstanding" scale="0" ${extra}>${text}</ix:nonFraction>`;
  const member = '<xbrli:segment><xbrldi:explicitMember dimension="us-gaap:StatementClassOfStockAxis">x:ClassB</xbrldi:explicitMember></xbrli:segment>';

  it("adds the per-class counts on the newest cover date, each class once", async () => {
    const { coverShareCount } = await import("@/lib/fundamentals/ixbrl");
    const html = inst("a", "2026-10-16", member) + inst("b", "2026-10-16", member) + inst("old", "2026-07-01", member) +
      shares("a", "2,200,000,000") + shares("a", "2,200,000,000") + shares("b", "340,000,000") + shares("old", "9,999");
    expect(coverShareCount(html)).toEqual({ value: 2_540_000_000, asOf: "2026-10-16", classes: 2, weighted: false });
  });

  it("returns null when there is no positive cover count", async () => {
    const { coverShareCount } = await import("@/lib/fundamentals/ixbrl");
    expect(coverShareCount(inst("a", "2026-10-16") + shares("a", "0"))).toBeNull();
    expect(coverShareCount("<html></html>")).toBeNull();
  });
});

describe("coverShareCount with class weights", () => {
  const ctx = (id: string, member: string) => `<xbrli:context id="${id}"><xbrli:entity><xbrli:segment><xbrldi:explicitMember dimension="us-gaap:StatementClassOfStockAxis">${member}</xbrldi:explicitMember></xbrli:segment></xbrli:entity><xbrli:period><xbrli:instant>2026-07-29</xbrli:instant></xbrli:period></xbrli:context>`;
  const fact = (c: string, v: string) => `<ix:nonFraction contextRef="${c}" name="dei:EntityCommonStockSharesOutstanding" scale="0">${v}</ix:nonFraction>`;
  const html = ctx("a", "us-gaap:CommonClassAMember") + ctx("b", "us-gaap:CommonClassBMember") + fact("a", "488,450") + fact("b", "1,408,035,161");

  it("counts a class at its weight when every class has one (Berkshire: 1 A = 1,500 B)", async () => {
    const { coverShareCount } = await import("@/lib/fundamentals/ixbrl");
    expect(coverShareCount(html, { CommonClassAMember: 1500, CommonClassBMember: 1 })).toEqual({ value: 2_140_710_161, asOf: "2026-07-29", classes: 2, weighted: true });
  });

  it("falls back to a raw sum, unweighted, when a class has no weight", async () => {
    const { coverShareCount } = await import("@/lib/fundamentals/ixbrl");
    expect(coverShareCount(html, { CommonClassAMember: 1500 })).toEqual({ value: 1_408_523_611, asOf: "2026-07-29", classes: 2, weighted: false });
  });
});

describe("classConversionRates and a rate-weighted cover count (Visa)", () => {
  const ctx = (id: string, member: string, at: string) => `<xbrli:context id="${id}"><xbrli:entity><xbrli:segment><xbrldi:explicitMember dimension="us-gaap:StatementClassOfStockAxis">${member}</xbrldi:explicitMember></xbrli:segment></xbrli:entity><xbrli:period><xbrli:instant>${at}</xbrli:instant></xbrli:period></xbrli:context>`;
  const rate = (c: string, v: string) => `<ix:nonFraction contextRef="${c}" name="v:CommonStockConversionRate" scale="0">${v}</ix:nonFraction>`;
  const shares = (c: string, v: string) => `<ix:nonFraction contextRef="${c}" name="dei:EntityCommonStockSharesOutstanding" scale="0">${v}</ix:nonFraction>`;
  const html = [
    ctx("a", "us-gaap:CommonClassAMember", "2026-09-30"), ctx("b3", "v:CommonClassB3Member", "2026-09-30"), ctx("b3old", "v:CommonClassB3Member", "2025-09-30"), ctx("c", "us-gaap:CommonClassCMember", "2026-09-30"),
    rate("a", "&#8212;"), rate("b3", "1.4773"), rate("b3old", "1.5000"), rate("c", "4.0000"),
    ctx("ca", "us-gaap:CommonClassAMember", "2026-10-29"), ctx("cb3", "v:CommonClassB3Member", "2026-10-29"), ctx("cc", "us-gaap:CommonClassCMember", "2026-10-29"),
    shares("ca", "1,724,473,215"), shares("cb3", "60,589,871"), shares("cc", "9,080,220"),
  ].join("");

  it("reads the newest numeric rate per class and skips the dash of the main class", async () => {
    const { classConversionRates } = await import("@/lib/fundamentals/ixbrl");
    expect(classConversionRates(html, "v:CommonStockConversionRate")).toEqual({ CommonClassB3Member: 1.4773, CommonClassCMember: 4 });
  });

  it("weights the cover counts by those rates, with the main class as one", async () => {
    const { classConversionRates, coverShareCount } = await import("@/lib/fundamentals/ixbrl");
    const weights = { CommonClassAMember: 1, ...classConversionRates(html, "v:CommonStockConversionRate") };
    const count = coverShareCount(html, weights)!;
    expect(count.weighted).toBe(true);
    expect(count.value).toBeCloseTo(1_724_473_215 + 60_589_871 * 1.4773 + 9_080_220 * 4, 0);
  });
});
