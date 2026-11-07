import { describe, expect, it } from "bun:test";
import { DcfError, dcfValue, impliedGrowth, impliedReturn, sensitivity, type DcfBase } from "@/lib/valuation/dcf";

const base: DcfBase = {
  rev0: 1000, gT: 0.025, margin0: 0.25, tax: 0.25, ronic: 0.15,
  wacc: 0.09, netClaims: 200, shares: 100, midYear: false, stub: 1,
};

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);

describe("closed-form identities", () => {
  it("Gordon: EV = FCF1 / (WACC - g) for constant growth", () => {
    for (const g of [0, 0.02, 0.04, 0.05]) {
      const i = { ...base, g1: g, gT: g };
      const fcf1 = i.rev0 * (1 + g) * i.margin0 * (1 - i.tax) * (1 - g / i.ronic);
      expect(rel(dcfValue(i).ev, fcf1 / (i.wacc - g))).toBeLessThan(1e-9);
    }
  });

  it("RONIC = WACC: growth is value-neutral in the terminal value", () => {
    const i = { ...base, g1: 0.05, gT: 0.05, ronic: base.wacc };
    expect(rel(dcfValue(i).ev, (i.rev0 * 1.05 * 0.25 * 0.75) / i.wacc)).toBeLessThan(1e-9);
  });

  it("mid-year moves every discount time by 0.5 when stub is 1", () => {
    const i = { ...base, g1: 0.08 };
    expect(rel(dcfValue({ ...i, midYear: true }).ev / dcfValue(i).ev, (1 + i.wacc) ** 0.5)).toBeLessThan(1e-12);
  });

  it("stub: flat FCF F is worth (1+WACC)^-s * F * (s + 1/WACC)", () => {
    for (const s of [1, 0.5, 0.2]) {
      const i = { ...base, g1: 0, gT: 0, ronic: 1e9, stub: s, midYear: false };
      const F = i.rev0 * i.margin0 * (1 - i.tax);
      expect(rel(dcfValue(i).ev, (1 + i.wacc) ** -s * F * (s + 1 / i.wacc))).toBeLessThan(1e-9);
    }
  });

  it("mid-year with flat FCF and stub 1 equals C/W times (1+WACC)^0.5", () => {
    const i = { ...base, g1: 0, gT: 0, ronic: 1e9, stub: 1, midYear: true };
    const C = i.rev0 * i.margin0 * (1 - i.tax);
    expect(rel(dcfValue(i).ev, (C / i.wacc) * (1 + i.wacc) ** 0.5)).toBeLessThan(1e-9);
  });

  it("year-1 stub factor under mid-year discounts stub/2", () => {
    const i = { ...base, g1: 0.05, gT: 0.05, stub: 0.4 };
    const yearEnd = dcfValue({ ...i, midYear: false }).years[0].pv;
    const mid = dcfValue({ ...i, midYear: true }).years[0].pv;
    expect(rel(mid / yearEnd, (1 + i.wacc) ** (0.4 / 2))).toBeLessThan(1e-9);
  });

  it("terminal value equals NOPAT(N+1) / WACC when RONIC = WACC for any terminal growth", () => {
    for (const gT of [0, 0.01, 0.025, 0.03]) {
      const i = { ...base, g1: gT, gT, ronic: base.wacc };
      const r = dcfValue(i);
      const nopatNext = i.rev0 * (1 + gT) ** 10 * (1 + gT) * i.margin0 * (1 - i.tax);
      expect(rel(r.terminalValue, nopatNext / i.wacc)).toBeLessThan(1e-9);
    }
  });
});

describe("dcfValue guards", () => {
  it("throws wacc-spread when WACC is within 1 point of terminal growth", () => {
    try {
      dcfValue({ ...base, g1: 0.05, wacc: 0.034 });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(DcfError);
      expect((e as DcfError).code).toBe("wacc-spread");
    }
  });

  it("accepts a spread of exactly 1 point", () => {
    expect(() => dcfValue({ ...base, g1: 0.05, gT: 0.025, wacc: 0.035 })).not.toThrow();
  });

  it("throws wacc-range outside 3% to 20%", () => {
    expect(() => dcfValue({ ...base, g1: 0.05, wacc: 0.02, gT: 0.0 })).toThrow(DcfError);
    expect(() => dcfValue({ ...base, g1: 0.05, wacc: 0.21 })).toThrow(DcfError);
  });

  it("throws non-finite on NaN inputs", () => {
    expect(() => dcfValue({ ...base, g1: Number.NaN })).toThrow(DcfError);
  });

  it("throws shares when share count is zero or negative", () => {
    try {
      dcfValue({ ...base, g1: 0.05, shares: 0 });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as DcfError).code).toBe("shares");
    }
  });
});

describe("implied growth solver", () => {
  it("round trip: price -> implied g -> forward DCF -> price", () => {
    for (const g of [-0.1, 0, 0.05, 0.15, 0.4]) {
      for (const midYear of [false, true]) {
        const b = { ...base, ronic: 0.2, midYear, stub: 0.4 };
        const price = dcfValue({ ...b, g1: g }).perShare;
        const r = impliedGrowth(b, price);
        expect(r.status).toBe("solved");
        if (r.status !== "solved") return;
        expect(Math.abs(r.g - g)).toBeLessThan(1e-9);
        expect(rel(dcfValue({ ...b, g1: r.g }).perShare, price)).toBeLessThan(1e-9);
      }
    }
  });

  it("reports a range status instead of clamping", () => {
    const b = { ...base, ronic: 0.2 };
    expect(impliedGrowth(b, dcfValue({ ...b, g1: 0.6 }).perShare * 1.5).status).toBe("price-above-range");
    expect(impliedGrowth(b, dcfValue({ ...b, g1: -0.2 }).perShare * 0.5).status).toBe("price-below-range");
  });

  it("a price below every value in the range is price-below-range", () => {
    expect(impliedGrowth({ ...base, ronic: 0.2 }, 0.0001).status).toBe("price-below-range");
  });

  it("RONIC < WACC: finds the single root when value falls with growth", () => {
    const b = { ...base, ronic: 0.05 };
    expect(dcfValue({ ...b, g1: 0.2 }).perShare).toBeLessThan(dcfValue({ ...b, g1: 0 }).perShare);
    const r = impliedGrowth(b, dcfValue({ ...b, g1: 0.1 }).perShare);
    expect(r.status === "solved" && Math.abs(r.g - 0.1) < 1e-9).toBe(true);
  });

  it("RONIC = WACC returns an honest status and never throws", () => {
    const b = { ...base, ronic: base.wacc };
    const price = dcfValue({ ...b, g1: 0.05 }).perShare;
    const r = impliedGrowth(b, price);
    expect(["solved", "multiple", "price-above-range", "price-below-range", "invalid"]).toContain(r.status);
  });

  it("an invalid base returns invalid, not a throw", () => {
    expect(impliedGrowth({ ...base, wacc: 0.5 }, 100).status).toBe("invalid");
  });
});

describe("implied return solver and sensitivity", () => {
  it("round trip on WACC", () => {
    const b = { ...base, g1: 0.08, ronic: 0.2 };
    const price = dcfValue(b).perShare;
    const r = impliedReturn({ ...b }, price);
    expect(r.status).toBe("solved");
    if (r.status === "solved") expect(Math.abs(r.wacc - base.wacc)).toBeLessThan(1e-9);
  });

  it("sensitivity: lower WACC needs less growth than higher WACC", () => {
    const b = { ...base, ronic: 0.2 };
    const price = dcfValue({ ...b, g1: 0.08 }).perShare;
    const s = sensitivity(b, price);
    expect(s.waccMinus1.status).toBe("solved");
    expect(s.waccPlus1.status).toBe("solved");
    if (s.waccMinus1.status === "solved" && s.waccPlus1.status === "solved" && s.base.status === "solved") {
      expect(s.waccMinus1.g).toBeLessThan(s.base.g);
      expect(s.base.g).toBeLessThan(s.waccPlus1.g);
    }
  });
});
