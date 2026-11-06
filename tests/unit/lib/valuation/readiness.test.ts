import { describe, expect, it } from "bun:test";
import { checkReadiness, type ReadinessContext } from "@/lib/valuation/readiness";
import { dcfValue } from "@/lib/valuation/dcf";
import { fixtureCompany } from "../fundamentals/helpers";
import type { CompanyFilings } from "@/lib/fundamentals/types";

const ctx: ReadinessContext = { today: "2026-11-06", price: 250, riskFree: 0.045, rawBeta: 1.1 };

const clone = (c: CompanyFilings): CompanyFilings => structuredClone(c);
const lastAnnual = (c: CompanyFilings) => c.annual[c.annual.length - 1];

describe("checkReadiness golden cases", () => {
  it("AAPL is ready, with finite inputs that run through the model", () => {
    const r = checkReadiness(fixtureCompany("aapl"), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { inputs } = r;
    for (const v of [inputs.rev0, inputs.g1, inputs.gT, inputs.margin0, inputs.tax, inputs.ronic, inputs.wacc, inputs.netClaims, inputs.shares, inputs.stub]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(inputs.rev0).toBe(478834000000);
    expect(inputs.margin0).toBeCloseTo(158063 / 478834, 6);
    expect(inputs.midYear).toBe(true);
    expect(inputs.ronic).toBe(inputs.wacc);
    expect(() => dcfValue(inputs)).not.toThrow();
    expect(Number.isFinite(dcfValue(inputs).perShare)).toBe(true);
  });

  it("MSFT is ready", () => {
    const r = checkReadiness(fixtureCompany("msft"), { ...ctx, price: 450 });
    expect(r.ok).toBe(true);
  });

  it("NVDA is ready, with a stub of about 0.22 years to the next fiscal year end", () => {
    const r = checkReadiness(fixtureCompany("nvda"), { ...ctx, price: 180 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.inputs.stub).toBeGreaterThan(0.2);
      expect(r.inputs.stub).toBeLessThan(0.25);
    }
  });

  it("JPM is refused as a bank", () => {
    const r = checkReadiness(fixtureCompany("jpm"), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.some((x) => /banks/.test(x))).toBe(true);
  });

  it("TSM is refused for its currency and IFRS reporting", () => {
    const r = checkReadiness(fixtureCompany("tsm"), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons.some((x) => /TWD/.test(x))).toBe(true);
      expect(r.reasons.some((x) => /IFRS/.test(x))).toBe(true);
    }
  });
});

describe("checkReadiness refusals", () => {
  it("refuses when the latest annual period is more than 15 months old", () => {
    const r = checkReadiness(fixtureCompany("aapl"), { ...ctx, today: "2028-06-01" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.some((x) => /more than 15 months/.test(x))).toBe(true);
  });

  it("refuses when free cash flow is not positive", () => {
    const c = clone(fixtureCompany("aapl"));
    lastAnnual(c).items.capex = { ...lastAnnual(c).items.capex!, value: 200_000_000_000 };
    const r = checkReadiness(c, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.some((x) => /positive free cash flow/.test(x))).toBe(true);
  });

  it("refuses when total debt is not reported", () => {
    const c = clone(fixtureCompany("aapl"));
    for (const p of [lastAnnual(c), c.trailing]) {
      if (!p) continue;
      for (const k of ["debtNoncurrent", "debtCurrent", "commercialPaper", "debtTotal"] as const) delete p.items[k];
    }
    const r = checkReadiness(c, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.some((x) => /debt/i.test(x))).toBe(true);
  });

  it("refuses when no share count is reported anywhere", () => {
    const c = clone(fixtureCompany("aapl"));
    c.sharesOutstanding = null;
    delete lastAnnual(c).items.dilutedShares;
    const r = checkReadiness(c, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.some((x) => /Share count/.test(x))).toBe(true);
  });

  it("uses the average diluted count when a multi-class company has no cover total", () => {
    const c = clone(fixtureCompany("aapl"));
    c.sharesOutstanding = null;
    const diluted = lastAnnual(c).items.dilutedShares!.value;
    const r = checkReadiness(c, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.inputs.shares).toBe(diluted);
      expect(r.warnings.join(" ")).toMatch(/average diluted share count/);
    }
  });

  it("counts securities held beyond a year as cash-like in net debt", () => {
    const c = clone(fixtureCompany("aapl"));
    const before = checkReadiness(c, ctx);
    const bal = c.trailing ?? lastAnnual(c);
    bal.items.marketableSecuritiesNoncurrent = { value: 50e9, tag: "MarketableSecuritiesNoncurrent", unit: "USD", accn: "x", form: "10-K", filed: "2026-01-01" };
    const after = checkReadiness(c, ctx);
    if (!before.ok || !after.ok) throw new Error("expected both to be ready");
    expect(before.inputs.netClaims - after.inputs.netClaims).toBeCloseTo(50e9, 0);
  });

  it("refuses without a positive price", () => {
    expect(checkReadiness(fixtureCompany("aapl"), { ...ctx, price: 0 }).ok).toBe(false);
  });
});

describe("checkReadiness defaults", () => {
  it("stub is one when today is exactly one year past the last fiscal year end", () => {
    const r = checkReadiness(fixtureCompany("aapl"), { ...ctx, today: "2027-09-26" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.inputs.stub).toBe(1);
  });

  it("RONIC from history is floored at WACC and capped at 60%", () => {
    const r = checkReadiness(fixtureCompany("aapl"), { ...ctx, ronicBasis: "history" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.inputs.ronic).toBeLessThanOrEqual(0.6);
      expect(r.inputs.ronic).toBeGreaterThanOrEqual(r.inputs.wacc);
    }
  });

  it("holds the margin and fades tax to 25%", () => {
    const r = checkReadiness(fixtureCompany("aapl"), ctx);
    if (r.ok) {
      expect(r.inputs.marginT).toBe(r.inputs.margin0);
      expect(r.inputs.taxMarginal).toBe(0.25);
    }
  });

  it("every input has a source label", () => {
    const r = checkReadiness(fixtureCompany("aapl"), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const key of ["rev0", "g1", "gT", "margin0", "tax", "ronic", "wacc", "netClaims", "shares", "stub"]) {
        expect(typeof r.sources[key]).toBe("string");
        expect(r.sources[key].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("share count cross-check", () => {
  const aapl = fixtureCompany("aapl");
  const cover = aapl.sharesOutstanding!.value;

  it("withholds the valuation when a split has made the filing's share count stale", () => {
    const r = checkReadiness(aapl, { ...ctx, currentShares: cover * 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.some((x) => /stock split/.test(x))).toBe(true);
  });

  it("accepts a current count within 25% of the filing's", () => {
    expect(checkReadiness(aapl, { ...ctx, currentShares: cover * 0.97 }).ok).toBe(true);
  });
});


describe("a registrant with quarterly reports but no annual report", () => {
  it("is withheld with a holding-company explanation, not a bare 'not found'", () => {
    const c = clone(fixtureCompany("aapl"));
    c.annual = [];
    c.trailing = null;
    c.filings = [{ form: "10-Q", filed: "2026-11-02", accn: "x-1", items: [], url: "u" }];
    const r = checkReadiness(c, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join(" ")).toContain("predecessor registrant");
  });

  it("keeps the plain message when there are no periodic filings at all", () => {
    const c = clone(fixtureCompany("aapl"));
    c.annual = [];
    c.trailing = null;
    c.filings = [];
    const r = checkReadiness(c, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons).toContain("No annual report was found.");
  });

  it("tells a registrant that files with its parent to look up the parent, not that it is new", () => {
    const c = clone(fixtureCompany("aapl"));
    c.annual = [];
    c.trailing = null;
    c.filings = [{ form: "10-K", filed: "2026-02-19", accn: "x-0", items: [], url: "u" }, { form: "10-Q", filed: "2026-11-02", accn: "x-1", items: [], url: "u" }];
    const r = checkReadiness(c, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons.join(" ")).toContain("together with its parent");
      expect(r.reasons.join(" ")).not.toContain("newly formed");
    }
  });
});
