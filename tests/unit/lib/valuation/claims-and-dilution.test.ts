import { describe, expect, it } from "bun:test";
import { checkReadiness, type ReadinessContext } from "@/lib/valuation/readiness";
import { fixtureCompany } from "../fundamentals/helpers";
import type { AnnualPeriod, CompanyFilings, FactValue, LineItem } from "@/lib/fundamentals/types";

const ctx: ReadinessContext = { today: "2026-11-06", price: 250, riskFree: 0.045, rawBeta: 1.1 };
const TAX = 0.25;

const clone = (c: CompanyFilings): CompanyFilings => structuredClone(c);
const lastAnnual = (c: CompanyFilings) => c.annual[c.annual.length - 1];
const fact = (value: number, tag = "Test"): FactValue => ({ value, tag, unit: "USD", accn: "a", form: "10-K", filed: "2026-02-01" });

/** Sets a balance item on the period the readiness check reads (trailing when present, otherwise the last annual). */
function setBalance(c: CompanyFilings, key: LineItem, value: number, tag?: string) {
  const bal = c.trailing ?? lastAnnual(c);
  bal.items[key] = fact(value, tag);
}

/** Net claims with and without one change, so the difference is the change alone. */
function netClaimsDelta(change: (c: CompanyFilings) => void): number {
  const base = fixtureCompany("aapl");
  const before = checkReadiness(base, ctx);
  const changed = clone(base);
  change(changed);
  const after = checkReadiness(changed, ctx);
  if (!before.ok || !after.ok) throw new Error("expected both to be ready");
  return after.inputs.netClaims - before.inputs.netClaims;
}

describe("equity bridge into net claims", () => {
  it("adds noncurrent finance lease liabilities", () => {
    expect(netClaimsDelta((c) => setBalance(c, "financeLeaseLiabilityNoncurrent", 2e9))).toBeCloseTo(2e9, 0);
  });

  it("adds current finance lease liabilities on top of the noncurrent part", () => {
    expect(netClaimsDelta((c) => {
      setBalance(c, "financeLeaseLiabilityNoncurrent", 2e9);
      setBalance(c, "financeLeaseLiabilityCurrent", 1e9);
    })).toBeCloseTo(3e9, 0);
  });

  it("does not add finance leases again when the debt tag already includes capital leases", () => {
    const delta = netClaimsDelta((c) => {
      const bal = c.trailing ?? lastAnnual(c);
      bal.items.debtNoncurrent = fact(bal.items.debtNoncurrent!.value, "LongTermDebtAndCapitalLeaseObligations");
      setBalance(c, "financeLeaseLiabilityNoncurrent", 2e9);
    });
    expect(delta).toBeCloseTo(0, 0);
  });

  it("adds the noncontrolling interest", () => {
    expect(netClaimsDelta((c) => setBalance(c, "minorityInterest", 3e9))).toBeCloseTo(3e9, 0);
  });

  it("adds preferred stock", () => {
    expect(netClaimsDelta((c) => setBalance(c, "preferredStock", 4e9))).toBeCloseTo(4e9, 0);
  });

  it("adds an underfunded pension, tax-effected at the marginal rate", () => {
    expect(netClaimsDelta((c) => setBalance(c, "pensionFundedStatus", -10e9))).toBeCloseTo(10e9 * (1 - TAX), 0);
  });

  it("adds nothing for an overfunded pension plan", () => {
    expect(netClaimsDelta((c) => setBalance(c, "pensionFundedStatus", 5e9))).toBeCloseTo(0, 0);
  });

  it("falls back to the noncurrent pension liability when no funded status is reported", () => {
    expect(netClaimsDelta((c) => setBalance(c, "pensionLiabilityNoncurrent", 8e9))).toBeCloseTo(8e9 * (1 - TAX), 0);
  });

  it("names the claims that are not reported, and still values the company", () => {
    const r = checkReadiness(fixtureCompany("aapl"), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings.join(" ")).toMatch(/counted as zero: .*noncontrolling interest/);
    }
  });

  it("labels each claim in the net claims source", () => {
    const r = checkReadiness(fixtureCompany("aapl"), ctx);
    if (!r.ok) throw new Error("expected ready");
    for (const word of ["finance lease", "noncontrolling", "preferred", "pension", "operating lease"]) {
      expect(r.sources.netClaims.toLowerCase()).toContain(word);
    }
  });
});

/** Puts the same award figures on the latest annual period, leaving older periods without them. */
function setAward(c: CompanyFilings, items: Partial<Record<LineItem, number>>, atIndex = c.annual.length - 1) {
  for (const p of c.annual) for (const k of ["optionsOutstanding", "optionsExercisePrice", "rsusUnvested"] as const) delete p.items[k];
  const p: AnnualPeriod = c.annual[atIndex];
  for (const [k, v] of Object.entries(items)) p.items[k as LineItem] = fact(v as number);
}

describe("dilution from options and RSUs (treasury stock method)", () => {
  const base = fixtureCompany("aapl");
  const cover = base.sharesOutstanding!.value;

  it("adds unvested RSUs and in-the-money options, counting options net of their exercise price", () => {
    const c = clone(base);
    setAward(c, { rsusUnvested: 5e6, optionsOutstanding: 10e6, optionsExercisePrice: 100 });
    const r = checkReadiness(c, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Options: 10m * (1 - 100 / 250) = 6m. RSUs: 5m.
      expect(r.inputs.shares).toBeCloseTo(cover + 5e6 + 6e6, 0);
      expect(r.sources.shares).toMatch(/treasury stock method/);
    }
  });

  it("adds no option shares when the exercise price is above the current price", () => {
    const c = clone(base);
    setAward(c, { rsusUnvested: 5e6, optionsOutstanding: 10e6, optionsExercisePrice: 300 });
    const r = checkReadiness(c, ctx);
    if (!r.ok) throw new Error("expected ready");
    expect(r.inputs.shares).toBeCloseTo(cover + 5e6, 0);
  });

  it("never lets option dilution go negative", () => {
    const c = clone(base);
    setAward(c, { optionsOutstanding: 10e6, optionsExercisePrice: 1_000 });
    const r = checkReadiness(c, ctx);
    if (!r.ok) throw new Error("expected ready");
    expect(r.inputs.shares).toBeCloseTo(cover, 0);
  });

  it("skips the components with no tag and says dilution was not included", () => {
    const c = clone(base);
    setAward(c, { rsusUnvested: 5e6 });
    const r = checkReadiness(c, ctx);
    if (!r.ok) throw new Error("expected ready");
    expect(r.inputs.shares).toBeCloseTo(cover + 5e6, 0);
    expect(r.warnings.join(" ")).toMatch(/Dilution from options and RSUs was not included in full/);
  });

  it("warns when neither tag is reported, and keeps the cover count", () => {
    const r = checkReadiness(base, ctx);
    if (!r.ok) throw new Error("expected ready");
    expect(r.inputs.shares).toBe(cover);
    expect(r.warnings.join(" ")).toMatch(/Dilution from options and RSUs was not included, because/);
  });

  it("skips a figure more than two fiscal years older than the latest annual report", () => {
    const c = clone(base);
    const older = c.annual.length - 4;
    setAward(c, { rsusUnvested: 5e6, optionsOutstanding: 10e6, optionsExercisePrice: 100 }, older);
    const r = checkReadiness(c, ctx);
    if (!r.ok) throw new Error("expected ready");
    expect(r.inputs.shares).toBe(cover);
    expect(r.warnings.join(" ")).toMatch(/Dilution from options and RSUs was not included/);
  });

  it("uses a figure two fiscal years old", () => {
    const c = clone(base);
    setAward(c, { rsusUnvested: 5e6 }, c.annual.length - 3);
    const r = checkReadiness(c, ctx);
    if (!r.ok) throw new Error("expected ready");
    expect(r.inputs.shares).toBeCloseTo(cover + 5e6, 0);
  });

  it("adds nothing when the share count is the diluted weighted average, which already includes dilution", () => {
    const c = clone(base);
    c.sharesOutstanding = null;
    setAward(c, { rsusUnvested: 5e6, optionsOutstanding: 10e6, optionsExercisePrice: 100 });
    const r = checkReadiness(c, ctx);
    if (!r.ok) throw new Error("expected ready");
    expect(r.inputs.shares).toBe(lastAnnual(c).items.dilutedShares!.value);
  });
});
