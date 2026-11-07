import { describe, it, expect } from "bun:test";
import { buildCompanyFilings, parseFilings } from "@/lib/fundamentals/periods";
import { tagsUsed } from "@/lib/fundamentals/concepts";
import type { SecCompanyFacts, SecSubmissions } from "@/lib/fundamentals/types";
import { fixtureCompany, loadFixture } from "./helpers";

const M = 1e6;
const year = (c: ReturnType<typeof fixtureCompany>, fy: number) => c.annual.find((p) => p.fiscalYear === fy)!;

describe("buildCompanyFilings on real filings", () => {
  const aapl = fixtureCompany("AAPL");
  const msft = fixtureCompany("MSFT");
  const nvda = fixtureCompany("NVDA");

  it("matches published annual figures", () => {
    expect(year(aapl, 2023).items.revenue!.value).toBe(383_285 * M);
    expect(year(aapl, 2023).items.netIncome!.value).toBe(96_995 * M);
    expect(year(msft, 2024).items.revenue!.value).toBe(245_122 * M);
    expect(year(nvda, 2024).items.revenue!.value).toBe(60_922 * M);
  });

  it("labels fiscal years by the calendar year they end in", () => {
    expect(year(msft, 2024).end).toBe("2024-06-30");
    expect(year(aapl, 2023).end).toBe("2023-09-30");
    expect(year(nvda, 2024).end).toBe("2024-01-28");
  });

  it("picks the tag per period, so a tag switch mid-history is followed", () => {
    expect(year(nvda, 2022).items.revenue!.tag).toBe("RevenueFromContractWithCustomerExcludingAssessedTax");
    expect(year(nvda, 2023).items.revenue!.tag).toBe("Revenues");
    expect(year(nvda, 2023).items.revenue!.value).toBe(26_974 * M);
  });

  it("keeps the filing each value came from", () => {
    const rev = year(aapl, 2023).items.revenue!;
    expect(rev.accn).toMatch(/^0000320193-\d{2}-\d{6}$/);
    expect(rev.form).toBe("10-K");
  });

  it("uses the last fiscal year as trailing when no quarter has been filed since", () => {
    const last = aapl.annual[aapl.annual.length - 1];
    expect(aapl.trailing!.basis).toBe("annual");
    expect(aapl.trailing!.end).toBe(last.end);
  });

  it("computes trailing twelve months as fiscal year + year to date - prior year to date", () => {
    const { facts } = loadFixture("MSFT");
    const t = msft.trailing!;
    expect(t.basis).toBe("ytd");
    const fy = msft.annual[msft.annual.length - 1];
    const list = facts.facts["us-gaap"].NetCashProvidedByUsedInOperatingActivities.units.USD;
    const cur = list.find((f) => f.form === "10-Q" && f.end === t.end && f.start! > fy.end)!;
    const prior = list.find((f) => f.form === "10-Q" && f.start! < fy.end && f.end < fy.end &&
      Math.abs(Date.parse(f.end) - Date.parse(t.end) + 365 * 86_400_000) < 8 * 86_400_000)!;
    expect(t.items.operatingCashFlow!.value).toBe(fy.items.operatingCashFlow!.value + cur.val - prior.val);
  });

  it("reads cover-page shares outstanding", () => {
    expect(aapl.sharesOutstanding!.value).toBeGreaterThan(14e9);
    expect(aapl.sharesOutstanding!.asOf >= "2026-01-01").toBe(true);
  });

  it("handles a bank and an IFRS filer in another currency", () => {
    const jpm = fixtureCompany("JPM");
    expect(jpm.sic).toBe(6021);
    const tsm = fixtureCompany("TSM");
    expect(tsm.taxonomy).toBe("ifrs-full");
    expect(tsm.currency).toBe("TWD");
    expect(tsm.annual.length).toBeGreaterThan(3);
    expect(tsm.annual[tsm.annual.length - 1].items.revenue!.unit).toBe("TWD");
  });
});

describe("buildCompanyFilings on hand-built facts", () => {
  const sub: SecSubmissions = {
    cik: "1", name: "Test Co", sic: "3571",
    filings: { recent: { accessionNumber: ["0000000001-26-000001"], filingDate: ["2026-02-01"], form: ["10-K"], items: [""], primaryDocument: ["doc.htm"] } },
  };
  const annual = (start: string, end: string, val: number, filed: string, accn: string) =>
    ({ start, end, val, accn, form: "10-K", filed });
  const facts: SecCompanyFacts = {
    cik: 1, entityName: "Test Co",
    facts: {
      "us-gaap": {
        Revenues: { units: { USD: [
          annual("2024-01-01", "2024-12-31", 100, "2025-02-01", "a-1"),
          annual("2024-01-01", "2024-12-31", 120, "2026-02-01", "a-2"),
          annual("2025-01-01", "2025-12-31", 130, "2026-02-01", "a-2"),
        ] } },
      },
      dei: {
        EntityCommonStockSharesOutstanding: { units: { shares: [
          { end: "2026-01-20", val: 700, accn: "a-2", form: "10-K", filed: "2026-02-01" },
          { end: "2026-01-20", val: 300, accn: "a-2", form: "10-K", filed: "2026-02-01" },
          { end: "2025-01-20", val: 999, accn: "a-1", form: "10-K", filed: "2025-02-01" },
        ] } },
      },
    },
  };
  const c = buildCompanyFilings(facts, sub, { ticker: "test", source: "snapshot" });

  it("keeps the latest filing's value and records the original as a restatement", () => {
    const fy24 = c.annual.find((p) => p.fiscalYear === 2024)!.items.revenue!;
    expect(fy24.value).toBe(120);
    expect(fy24.restated).toEqual({ original: 100, originalAccn: "a-1" });
    expect(c.annual.find((p) => p.fiscalYear === 2025)!.items.revenue!.restated).toBeUndefined();
  });

  it("sums share classes reported on the latest cover page", () => {
    // Two class rows on the latest filing: summed, and counted as two classes (was no class count before P13).
    expect(c.sharesOutstanding).toEqual({ value: 1000, asOf: "2026-01-20", accn: "a-2", classes: 2 });
  });

  it("uppercases the ticker and keeps the source label", () => {
    expect(c.ticker).toBe("TEST");
    expect(c.source).toBe("snapshot");
  });
});

describe("parseFilings", () => {
  it("splits 8-K item numbers and builds filing links", () => {
    const [f] = parseFilings({
      cik: "19617", name: "X", sic: "6021",
      filings: { recent: { accessionNumber: ["0000019617-26-000123"], filingDate: ["2026-04-01"], form: ["8-K"], items: ["2.02,4.02, 9.01"], primaryDocument: ["a.htm"] } },
    }, 19617);
    expect(f.items).toEqual(["2.02", "4.02", "9.01"]);
    expect(f.url).toBe("https://www.sec.gov/Archives/edgar/data/19617/000001961726000123/a.htm");
  });
});

describe("tagsUsed", () => {
  it("lists every tag the fixtures and snapshot must keep", () => {
    const t = tagsUsed();
    expect(t["us-gaap"]).toContain("RevenueFromContractWithCustomerExcludingAssessedTax");
    expect(t["ifrs-full"]).toContain("Revenue");
    expect(t.dei).toEqual(["EntityCommonStockSharesOutstanding"]);
  });
});
