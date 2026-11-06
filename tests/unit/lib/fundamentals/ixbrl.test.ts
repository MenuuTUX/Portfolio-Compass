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
    expect(coverShareCount(html)).toEqual({ value: 2_540_000_000, asOf: "2026-10-16", classes: 2 });
  });

  it("returns null when there is no positive cover count", async () => {
    const { coverShareCount } = await import("@/lib/fundamentals/ixbrl");
    expect(coverShareCount(inst("a", "2026-10-16") + shares("a", "0"))).toBeNull();
    expect(coverShareCount("<html></html>")).toBeNull();
  });
});
