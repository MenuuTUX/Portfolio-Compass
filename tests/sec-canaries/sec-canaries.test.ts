/**
 * Regression check against real SEC data, using the bulk files that `bun scripts/sec-bulk.ts download` keeps in
 * ~/.cache/portfolio-compass-sec-bulk. Skipped when they are not there, so a plain `bun test` stays hermetic.
 *
 * Every D&A figure below was read off the company's own cash-flow statement in the filing text, and is pinned by
 * fiscal year end, so a later filing cannot change it. They guard the tag choice (filed total over a sum of parts),
 * not the latest numbers.
 */
import { describe, it, expect } from "bun:test";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildCompanyFilings } from "@/lib/fundamentals/periods";
import { SUCCESSOR_REGISTRANTS } from "@/lib/fundamentals/source";
import type { SecCompanyFacts, SecSubmissions } from "@/lib/fundamentals/types";

const DIR = join(homedir(), ".cache", "portfolio-compass-sec-bulk");
const have = existsSync(join(DIR, "companyfacts.zip")) && existsSync(join(DIR, "submissions.zip"));
const pad = (cik: number) => String(cik).padStart(10, "0");

function read<T>(zip: string, cik: number): T {
  const out = Bun.spawnSync(["unzip", "-p", join(DIR, zip), `CIK${pad(cik)}.json`], { stdout: "pipe", stderr: "ignore", maxBuffer: 512 * 1024 * 1024 });
  return JSON.parse(out.stdout.toString()) as T;
}
const load = (ticker: string, cik: number) =>
  buildCompanyFilings(read<SecCompanyFacts>("companyfacts.zip", cik), read<SecSubmissions>("submissions.zip", cik), { ticker, source: "snapshot" });
const year = (c: ReturnType<typeof load>, end: string) => c.annual.find((p) => p.end === end);

/** ticker, CIK, fiscal year end, D&A in millions as printed in the filing's cash-flow statement. */
const DA: [string, number, string, number][] = [
  ["AAPL", 320193, "2026-09-26", 13_423],
  ["NVDA", 1045810, "2026-01-25", 2_843],
  ["JNJ", 200406, "2025-12-28", 7_503],
  ["KO", 21344, "2025-12-31", 1_050],
  ["WMT", 104169, "2026-01-31", 14_203],
  ["HD", 354950, "2026-02-01", 3_514],
  ["PG", 80424, "2026-06-30", 3_160],
  ["NKE", 320187, "2026-05-31", 747],
  ["COST", 909832, "2026-08-30", 2_674],
  ["AMZN", 1018724, "2025-12-31", 65_756],
  ["GOOGL", 1652044, "2025-12-31", 21_136],
  ["PFE", 78003, "2025-12-31", 6_592],
  // Filers that report depreciation and amortization on separate lines: the two add up to the printed total.
  ["INTC", 50863, "2025-12-27", 11_706],
];

describe.skipIf(!have)("SEC canaries (real data)", () => {
  for (const [ticker, cik, end, millions] of DA) {
    it(`${ticker} D&A for the year ending ${end} is ${millions.toLocaleString("en-US")}M`, () => {
      const d = year(load(ticker, cik), end)?.items.depreciationAmortization;
      expect(d ? Math.round(d.value / 1e6) : undefined).toBe(millions);
    });
  }

  it("a filed combined D&A total wins over a sum of its parts (Apple's parts add to 13,600)", () => {
    expect(year(load("AAPL", 320193), "2026-09-26")?.items.depreciationAmortization?.tag).toBe("DepreciationDepletionAndAmortization");
  });

  it("Cisco's D&A without the filing's extension tag is the labeled two-tag sum, which the live source then replaces", () => {
    const d = year(load("CSCO", 858877), "2026-07-25")?.items.depreciationAmortization;
    expect(d?.tag).toContain(" + ");
    expect(Math.round((d?.value ?? 0) / 1e6)).toBe(1_616);
  });

  it("Alphabet's cover count comes from the balance sheet and covers all three classes (5,888 + 827 + 5,579 million)", () => {
    const so = load("GOOGL", 1652044).sharesOutstanding;
    expect(so?.value).toBe(12_294_000_000);
  });

  it("Berkshire has no usable cover count, and no stale 2011 figure is shown", () => {
    expect(load("BRK-B", 1067983).sharesOutstanding).toBeNull();
  });

  it("a cover row of zero never becomes the share count (Chime)", () => {
    expect(load("CHYM", 1795586).sharesOutstanding?.value ?? 1).toBeGreaterThan(0);
  });

  it("ExxonMobil Holdings has quarterlies only, and is mapped to the old Exxon registrant that has the annual history", () => {
    const holdco = load("XOM", 2115436);
    expect(holdco.annual.length).toBe(0);
    const old = SUCCESSOR_REGISTRANTS[2115436];
    expect(old).toBe(34088);
    expect(load("XOM", old).annual.length).toBeGreaterThanOrEqual(10);
  });

  it("every mapped predecessor has annual history", () => {
    for (const old of Object.values(SUCCESSOR_REGISTRANTS)) {
      expect(load("X", old).annual.length).toBeGreaterThan(3);
    }
  });
});
