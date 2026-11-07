import { describe, expect, it } from "bun:test";
import { describeResult, terminalShareTier, type ReverseReport } from "@/lib/valuation/summarize";
import { dcfValue, impliedGrowth, sensitivity, type DcfBase, type DcfErrorCode, type DcfInputs } from "@/lib/valuation/dcf";
import { computeWacc } from "@/lib/valuation/wacc";
import { checkReadiness } from "@/lib/valuation/readiness";
import { fixtureCompany } from "../fundamentals/helpers";

const base: DcfInputs = {
  rev0: 1000, g1: 0.05, gT: 0.025, margin0: 0.25, tax: 0.25, ronic: 0.2,
  wacc: 0.09, netClaims: 200, shares: 100, midYear: true, stub: 1,
};

const BANNED = /\b(fair value|undervalued|overvalued|buy|sell|target price)\b/i;
const EM_DASH = "—";
const DIGIT = /\d/;

/** Every string the summary and its inputs can show, for the wording scan. */
function allStrings(): string[] {
  const out: string[] = [];
  const price = dcfValue({ ...base, g1: 0.08 }).perShare;
  const cases: ReverseReport[] = [
    { implied: impliedGrowth(base, price), band: sensitivity(base, price) },
    { implied: impliedGrowth(base, price * 1000) },
    { implied: impliedGrowth(base, 0.000001) },
    { implied: { status: "multiple", roots: [0.01, 0.05] } },
    { implied: { status: "solved", g: 0.5 } },
    { implied: { status: "solved", g: -0.3 } },
    { implied: { status: "solved", g: 0.1 } },
    { implied: { status: "invalid", code: "wacc-spread", reason: "x" } },
    { implied: { status: "invalid", code: "non-finite", reason: "x" } },
    { implied: { status: "invalid", code: "price", reason: "x" } },
  ];
  const codes: DcfErrorCode[] = ["shares", "wacc-range", "invalid"];
  for (const code of codes) cases.push({ implied: { status: "invalid", code, reason: "x" } });
  for (const c of cases) {
    const d = describeResult(c, base);
    out.push(d.headline, d.assumptions);
    if (d.terminalShare) out.push(d.terminalShare);
    if (d.band) out.push(d.band);
  }
  // Failure tier: a negative margin makes enterprise value negative.
  const failing = describeResult({ implied: { status: "solved", g: 0.1 } }, { ...base, margin0: -0.5 });
  out.push(failing.headline, failing.assumptions);
  for (const share of [0.3, 0.6, 0.7, 0.8, 0.95]) {
    out.push(...[`${terminalShareTier(share)}`]);
  }
  // Wacc clamp warnings and readiness refusals and labels also reach users.
  out.push(...computeWacc({ riskFree: 0.02, beta: 0.2, equityRiskPremium: 0.01, preTaxCostOfDebt: 0.03, marginalTaxRate: 0.25, marketCap: 1, totalDebt: 0 }).warnings);
  out.push(...computeWacc({ riskFree: 0.05, beta: 3, equityRiskPremium: 0.06, preTaxCostOfDebt: 0.03, marginalTaxRate: 0.25, marketCap: 1, totalDebt: 0 }).warnings);
  const ctx = { today: "2026-11-06", price: 100, riskFree: 0.045, rawBeta: 1.1 };
  for (const t of ["jpm", "tsm", "aapl"]) {
    const r = checkReadiness(fixtureCompany(t), ctx);
    if (r.ok) out.push(...r.warnings, ...Object.values(r.sources));
    else out.push(...r.reasons);
  }
  return out;
}

describe("wording rules", () => {
  it("no banned words or em dashes in any string the summary can produce", () => {
    const strings = allStrings();
    expect(strings.length).toBeGreaterThan(20);
    for (const s of strings) {
      expect(BANNED.test(s)).toBe(false);
      expect(s.includes(EM_DASH)).toBe(false);
    }
  });

  it("non-solved, out-of-range and failure headlines contain no digit", () => {
    const price = dcfValue({ ...base, g1: 0.08 }).perShare;
    const cases: ReverseReport[] = [
      { implied: { status: "multiple", roots: [0.01, 0.05] } },
      { implied: { status: "price-above-range" } },
      { implied: { status: "price-below-range" } },
      { implied: { status: "invalid", code: "wacc-spread", reason: "x" } },
      { implied: { status: "solved", g: 0.5 } },
      { implied: { status: "solved", g: -0.3 } },
    ];
    for (const c of cases) expect(DIGIT.test(describeResult(c, base).headline)).toBe(false);
    expect(DIGIT.test(describeResult({ implied: { status: "solved", g: 0.1 } }, { ...base, margin0: -0.5 }).headline)).toBe(false);
    expect(describeResult({ implied: impliedGrowth(base, price) }, base).headline).toMatch(/\d/);
  });
});

describe("describeResult", () => {
  it("states the solved growth and the held-fixed assumptions", () => {
    const price = dcfValue({ ...base, g1: 0.08 }).perShare;
    const d = describeResult({ implied: impliedGrowth(base, price), band: sensitivity(base, price) }, base);
    expect(d.headline.startsWith("At this price, the model needs revenue growth of")).toBe(true);
    expect(d.headline).toContain("8.0%");
    expect(d.assumptions).toContain("margin held at 25.0%");
    expect(d.assumptions).toContain("WACC 9.0%");
    expect(d.assumptions).toContain("terminal growth 2.5%");
    expect(d.band).toMatch(/one point lower/i);
    expect(d.band).toMatch(/one point higher/i);
  });

  it("a non-solved status returns its reason in words", () => {
    const d = describeResult({ implied: { status: "price-above-range" } }, base);
    expect(d.headline).toMatch(/no answer/);
    expect(d.terminalShare).toBeNull();
  });

  it("a growth outside -10% to 40% is out of range, with no number", () => {
    const d = describeResult({ implied: { status: "solved", g: 0.45 } }, { ...base, ronic: 0.6 });
    expect(d.headline).toMatch(/outside the range/);
    expect(DIGIT.test(d.headline)).toBe(false);
  });
});

describe("terminal value share tiers", () => {
  it("below 60%, 60 to 80%, above 80%, and above 100% as a failure", () => {
    expect(terminalShareTier(0.59)).toBe("low");
    expect(terminalShareTier(0.6)).toBe("mid");
    expect(terminalShareTier(0.8)).toBe("mid");
    expect(terminalShareTier(0.81)).toBe("high");
    expect(terminalShareTier(1)).toBe("high");
    expect(terminalShareTier(1.01)).toBe("failure");
    expect(terminalShareTier(Number.POSITIVE_INFINITY)).toBe("failure");
  });

  it("a failure shows no number at all", () => {
    const d = describeResult({ implied: { status: "solved", g: 0.1 } }, { ...base, margin0: -0.5 });
    expect(d.terminalShare).toBeNull();
    expect(d.headline).toMatch(/not reliable|does not hold/);
    expect(DIGIT.test(d.headline)).toBe(false);
  });

  it("a solved result in range shows the share with a number", () => {
    const price = dcfValue({ ...base, g1: 0.08 }).perShare;
    const d = describeResult({ implied: impliedGrowth(base, price) }, base);
    expect(d.terminalShare).toMatch(/\d+%/);
  });
});

describe("solver statuses that describe cleanly", () => {
  it("multiple roots, when RONIC is below WACC, are described without a number", () => {
    const b = { ...base, ronic: 0.05 };
    const peak = dcfValue({ ...b, g1: 0 }).perShare;
    const r = impliedGrowth(b, peak - 0.01);
    expect(r.status).toBe("multiple");
    expect(describeResult({ implied: r }, b).headline).toMatch(/More than one growth rate/);
  });
});

describe("DcfBase is accepted by describeResult", () => {
  it("runs with a base that has no growth field", () => {
    const { g1: _g1, ...rest } = base;
    const b: DcfBase = rest;
    const d = describeResult({ implied: { status: "price-below-range" } }, b);
    expect(d.assumptions).toContain("WACC");
  });
});
