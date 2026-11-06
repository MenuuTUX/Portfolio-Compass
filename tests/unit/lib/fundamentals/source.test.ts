import { describe, it, expect } from "bun:test";
import { createSecClient } from "@/lib/fundamentals/sec-client";
import { edgarLiveSource, snapshotSource, withFallback, type FilingsSource } from "@/lib/fundamentals/source";
import { buildCompanyFilings } from "@/lib/fundamentals/periods";
import { fixtureCompany, loadFixture } from "./helpers";

const UA = "Portfolio Compass test@example.com";
const tickerFile = { fields: ["cik", "name", "ticker", "exchange"], data: [[320193, "Apple Inc.", "AAPL", "Nasdaq"], [1067983, "BERKSHIRE", "BRK-B", "NYSE"]] };

/** A fetch stub that serves the AAPL fixtures for any company and records every request. */
function stubFetch(opts: { tickers?: unknown; facts404?: boolean } = {}) {
  const calls: string[] = [];
  const { facts, sub } = loadFixture("AAPL");
  const fetchFn = (async (url: string) => {
    calls.push(url);
    if (url.includes("company_tickers")) return new Response(JSON.stringify(opts.tickers ?? tickerFile));
    if (url.includes("companyfacts")) return opts.facts404 ? new Response("", { status: 404 }) : new Response(JSON.stringify(facts));
    if (url.includes("submissions")) return new Response(JSON.stringify(sub));
    return new Response("missing", { status: 404 });
  }) as unknown as typeof fetch;
  return { fetchFn, calls, count: (part: string) => calls.filter((u) => u.includes(part)).length };
}

describe("edgarLiveSource", () => {
  it("builds a company and says null for non-filers", async () => {
    const { fetchFn } = stubFetch();
    const live = edgarLiveSource(createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} }));
    const c = (await live.getCompany("AAPL"))!;
    expect(c.source).toBe("edgar-live");
    expect(c.annual.length).toBeGreaterThan(3);
    expect(await live.getCompany("XEQT.TO")).toBeNull();
  });

  it("returns null when the SEC has no company facts for a known ticker", async () => {
    const { fetchFn } = stubFetch({ facts404: true });
    const live = edgarLiveSource(createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} }));
    expect(await live.getCompany("AAPL")).toBeNull();
  });

  it("keeps the built summary for six hours and evicts the oldest of 51 companies", async () => {
    const tickers = { fields: tickerFile.fields, data: Array.from({ length: 51 }, (_, i) => [i + 1, `Co ${i + 1}`, `T${i + 1}`, "NYSE"]) };
    const { fetchFn, count, calls } = stubFetch({ tickers });
    let t = 0;
    const live = edgarLiveSource(createSecClient({ userAgent: UA, fetch: fetchFn, now: () => t, sleep: async () => {} }), { now: () => t });
    const factsFor = (cik: number) => calls.filter((u) => u.includes(`CIK${String(cik).padStart(10, "0")}`) && u.includes("companyfacts")).length;

    await live.getCompany("T1");
    await live.getCompany("T1");
    expect(factsFor(1)).toBe(1);

    for (let i = 2; i <= 51; i++) await live.getCompany(`T${i}`);
    expect(factsFor(1)).toBe(1);
    await live.getCompany("T51");
    expect(factsFor(51)).toBe(1); // still cached
    await live.getCompany("T1");
    expect(factsFor(1)).toBe(2); // the oldest was evicted by the 51st

    t = 6 * 3600_000 + 1;
    await live.getCompany("T51");
    expect(factsFor(51)).toBe(2); // expired after six hours
    expect(count("companyfacts")).toBeGreaterThan(51);
  });

  it("labels a cached company with the ticker that asked for it", async () => {
    const tickers = { fields: tickerFile.fields, data: [[320193, "Apple", "AAPL", "Nasdaq"], [320193, "Apple", "AAPL2", "Nasdaq"]] };
    const { fetchFn } = stubFetch({ tickers });
    const live = edgarLiveSource(createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} }));
    expect((await live.getCompany("AAPL"))!.ticker).toBe("AAPL");
    expect((await live.getCompany("AAPL2"))!.ticker).toBe("AAPL2");
  });
});

describe("snapshotSource", () => {
  it("returns the same company as live, labeled as snapshot", async () => {
    const company = fixtureCompany("AAPL");
    const files: Record<string, unknown> = {
      "https://cdn.example/data/sec/tickers.json": { AAPL: 320193 },
      "https://cdn.example/data/sec/c/320193.json": company,
    };
    const fetchFn = (async (url: string) =>
      url in files ? new Response(JSON.stringify(files[url])) : new Response("no", { status: 404 })) as unknown as typeof fetch;
    const snap = snapshotSource("https://cdn.example/data/", fetchFn);
    const c = (await snap.getCompany("aapl"))!;
    expect(c).toEqual({ ...company, source: "snapshot" });
    expect(await snap.getCompany("MSFT")).toBeNull();
  });
});

describe("withFallback", () => {
  const fixed = (id: "edgar-live" | "snapshot", result: () => Promise<null | ReturnType<typeof fixtureCompany>>): FilingsSource =>
    ({ id, getCompany: result });

  it("falls back to the snapshot when live fails, and reports why", async () => {
    const aapl = fixtureCompany("AAPL");
    const chain = withFallback(
      fixed("edgar-live", async () => { throw new Error("SEC request failed with 429"); }),
      fixed("snapshot", async () => ({ ...aapl, source: "snapshot" })),
    );
    expect((await chain.getCompany("AAPL"))!.source).toBe("snapshot");
    expect(chain.lastErrors()).toEqual(["edgar-live: SEC request failed with 429"]);
  });

  it("returns each call's own errors when two calls run in parallel", async () => {
    const chain = withFallback(
      { id: "edgar-live", getCompany: async (t: string) => { await new Promise((r) => setTimeout(r, t === "A" ? 20 : 1)); throw new Error(`live down for ${t}`); } },
      { id: "snapshot", getCompany: async (t: string) => { await new Promise((r) => setTimeout(r, t === "A" ? 1 : 20)); throw new Error(`snapshot down for ${t}`); } },
    );
    const [a, b] = await Promise.all([
      chain.lookup("A").catch((e: Error & { errors?: string[] }) => e),
      chain.lookup("B").catch((e: Error & { errors?: string[] }) => e),
    ]);
    expect((a as Error & { errors: string[] }).errors).toEqual(["edgar-live: live down for A", "snapshot: snapshot down for A"]);
    expect((b as Error & { errors: string[] }).errors).toEqual(["edgar-live: live down for B", "snapshot: snapshot down for B"]);
  });

  it("lookup returns the company together with the errors from that call", async () => {
    const aapl = fixtureCompany("AAPL");
    const chain = withFallback(
      fixed("edgar-live", async () => { throw new Error("down"); }),
      fixed("snapshot", async () => ({ ...aapl, source: "snapshot" })),
    );
    const r = await chain.lookup("AAPL");
    expect(r.company!.source).toBe("snapshot");
    expect(r.errors).toEqual(["edgar-live: down"]);
  });

  it("treats a definite not-a-filer answer as final", async () => {
    let snapshotCalled = false;
    const chain = withFallback(
      fixed("edgar-live", async () => null),
      fixed("snapshot", async () => { snapshotCalled = true; return null; }),
    );
    expect(await chain.getCompany("XEQT.TO")).toBeNull();
    expect(snapshotCalled).toBe(false);
  });

  it("throws when no source answers", async () => {
    const chain = withFallback(fixed("edgar-live", async () => { throw new Error("down"); }));
    await expect(chain.getCompany("AAPL")).rejects.toThrow(/No filings source answered/);
  });
});

describe("holding-company successor registrants", () => {
  const holdco = { fields: tickerFile.fields, data: [[2115436, "ExxonMobil Holdings Corp", "XOM", "NYSE"]] };

  /** The new CIK has only a cover-page share count and no annual report; the old CIK has the AAPL fixture history. */
  function successorFetch(oldFails = false) {
    const { facts, sub } = loadFixture("AAPL");
    const emptyFacts = { cik: 2115436, entityName: "ExxonMobil Holdings Corp", facts: { dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ end: "2026-09-30", val: 4_079_222_444, accn: "0002115436-26-000020", form: "10-Q", filed: "2026-11-02", fy: 2026, fp: "Q3" }] } } } } };
    const newSub = { ...sub, cik: "2115436", name: "ExxonMobil Holdings Corp", filings: { recent: { accessionNumber: ["0002115436-26-000020"], filingDate: ["2030-01-02"], reportDate: ["2026-09-30"], form: ["10-Q"], items: [""], primaryDocument: ["x.htm"] } } };
    return (async (url: string) => {
      if (url.includes("company_tickers")) return new Response(JSON.stringify(holdco));
      if (url.includes("CIK0002115436") && url.includes("companyfacts")) return new Response(JSON.stringify(emptyFacts));
      if (url.includes("CIK0002115436") && url.includes("submissions")) return new Response(JSON.stringify(newSub));
      if (oldFails) return new Response("", { status: 500 });
      if (url.includes("companyfacts")) return new Response(JSON.stringify(facts));
      if (url.includes("submissions")) return new Response(JSON.stringify(sub));
      return new Response("missing", { status: 404 });
    }) as unknown as typeof fetch;
  }

  it("uses the predecessor's annual history with the holding company's name, cik and current share count", async () => {
    const live = edgarLiveSource(createSecClient({ userAgent: UA, fetch: successorFetch(), sleep: async () => {} }));
    const c = (await live.getCompany("XOM"))!;
    expect(c.annual.length).toBeGreaterThan(3);
    expect(c.name).toBe("ExxonMobil Holdings Corp");
    expect(c.cik).toBe(2115436);
    expect(c.ticker).toBe("XOM");
    expect(c.sharesOutstanding?.value).toBe(4_079_222_444);
    expect(c.filings[0].accn).toBe("0002115436-26-000020");
  });

  it("falls back to the registrant's own empty history when the predecessor cannot be read", async () => {
    const live = edgarLiveSource(createSecClient({ userAgent: UA, fetch: successorFetch(true), sleep: async () => {} }));
    const c = (await live.getCompany("XOM"))!;
    expect(c.annual.length).toBe(0);
    expect(c.name).toBe("ExxonMobil Holdings Corp");
  });
});

describe("D&A read from the filing's inline XBRL", () => {
  /** AAPL fixture with D&A reduced to a depreciation-plus-amortization sum; the filing document is served from `docFor`. */
  function setup(docFor: (start: string, end: string, sum: number, trailingEnd: string | undefined) => string | null, name: "AAPL" | "NVDA" = "AAPL") {
    const { facts, sub } = loadFixture(name);
    const cik = name === "NVDA" ? 1045810 : 320193;
    const tickers = { fields: tickerFile.fields, data: [[cik, name, name, "Nasdaq"]] };
    const f = structuredClone(facts) as typeof facts;
    const us = f.facts["us-gaap"] as Record<string, { units: Record<string, { val: number }[]> }>;
    const donor = us.DepreciationDepletionAndAmortization ?? us.Depreciation;
    const dep = { units: { USD: donor.units.USD.map((x) => ({ ...x, val: x.val * 0.6 })) } };
    delete us.DepreciationDepletionAndAmortization;
    delete us.DepreciationAndAmortization;
    us.Depreciation = dep;
    us.AmortizationOfIntangibleAssets = { units: { USD: donor.units.USD.map((x) => ({ ...x, val: x.val * 0.3 })) } };
    const base = buildCompanyFilings(f, sub, { ticker: name, source: "snapshot" });
    const last = base.annual.at(-1)!;
    const sum = last.items.depreciationAmortization!.value;
    expect(last.items.depreciationAmortization!.tag).toContain(" + ");
    const doc = docFor(last.start, last.end, sum, base.trailing?.basis === "ytd" ? base.trailing.end : undefined);
    const fetchFn = (async (url: string) => {
      if (url.includes("company_tickers")) return new Response(JSON.stringify(tickers));
      if (url.includes("companyfacts")) return new Response(JSON.stringify(f));
      if (url.includes("submissions")) return new Response(JSON.stringify(sub));
      if (url.includes("/Archives/")) return doc === null ? new Response("", { status: 500 }) : new Response(doc);
      return new Response("missing", { status: 404 });
    }) as unknown as typeof fetch;
    return { sum, name, trailing: base.trailing, live: edgarLiveSource(createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} })) };
  }
  const page = (start: string, end: string, value: number) =>
    `<xbrli:context id="c"><xbrli:period><xbrli:startDate>${start}</xbrli:startDate><xbrli:endDate>${end}</xbrli:endDate></xbrli:period></xbrli:context>` +
    `<ix:nonFraction contextRef="c" name="aapl:DepreciationAmortizationAndOther" scale="0">${value.toLocaleString("en-US")}</ix:nonFraction>`;

  it("replaces the sum with the company's own filed total", async () => {
    const { sum, trailing, live } = setup((s, e, sum) => page(s, e, Math.round(sum * 1.25)));
    const c = (await live.getCompany("AAPL"))!;
    const d = c.annual.at(-1)!.items.depreciationAmortization!;
    expect(d.tag).toBe("aapl:DepreciationAmortizationAndOther");
    expect(d.value).toBe(Math.round(sum * 1.25));
    // The trailing figure moves by the same correction and says its in-year change is still built from parts.
    const before = trailing!.items.depreciationAmortization!.value;
    const t = c.trailing!.items.depreciationAmortization!;
    expect(t.value).toBe(before + (Math.round(sum * 1.25) - sum));
    expect(t.tag).toBe(c.trailing!.basis === "annual" ? "aapl:DepreciationAmortizationAndOther" : "aapl:DepreciationAmortizationAndOther + quarterly change from parts");
  });

  it("keeps the sum when the filed figure is implausibly far from it", async () => {
    const { live } = setup((s, e, sum) => page(s, e, Math.round(sum * 5)));
    expect((await live.getCompany("AAPL"))!.annual.at(-1)!.items.depreciationAmortization!.tag).toContain(" + ");
  });

  it("keeps the sum when the filing cannot be read", async () => {
    const { live } = setup(() => null);
    expect((await live.getCompany("AAPL"))!.annual.at(-1)!.items.depreciationAmortization!.tag).toContain(" + ");
  });

  it("takes year-to-date and prior year-to-date totals from the same filing when it carries them", async () => {
    const day = 86_400_000;
    const shift = (d: string, n: number) => new Date(Date.parse(d) + n * day).toISOString().slice(0, 10);
    const ctx = (id: string, a: string, b: string) => `<xbrli:context id="${id}"><xbrli:period><xbrli:startDate>${a}</xbrli:startDate><xbrli:endDate>${b}</xbrli:endDate></xbrli:period></xbrli:context>`;
    const fact = (id: string, v: number) => `<ix:nonFraction contextRef="${id}" name="aapl:DepreciationAmortizationAndOther" scale="0">${v}</ix:nonFraction>`;
    const { sum, trailing, live } = setup((start, end, total, tEnd) => {
      if (!tEnd) return page(start, end, Math.round(total * 1.25));
      return ctx("y", start, end) + fact("y", Math.round(total * 1.25)) +
        ctx("q", shift(end, 1), tEnd) + fact("q", 1000) +
        ctx("p", start, shift(tEnd, -364)) + fact("p", 400);
    }, "NVDA");
    expect(trailing?.basis).toBe("ytd");
    const c = (await live.getCompany("NVDA"))!;
    const t = c.trailing!.items.depreciationAmortization!;
    expect(t.tag).toBe("aapl:DepreciationAmortizationAndOther");
    expect(t.value).toBe(Math.round(sum * 1.25) + 600);
  });
});

describe("SUCCESSOR_REGISTRANTS", () => {
  it("maps each new registrant to a different, older registrant, and never chains", async () => {
    const { SUCCESSOR_REGISTRANTS } = await import("@/lib/fundamentals/source");
    for (const [next, old] of Object.entries(SUCCESSOR_REGISTRANTS)) {
      expect(Number(next)).not.toBe(old);
      expect(SUCCESSOR_REGISTRANTS[old]).toBeUndefined();
    }
    expect(Object.keys(SUCCESSOR_REGISTRANTS).length).toBe(new Set(Object.values(SUCCESSOR_REGISTRANTS)).size);
  });
});

describe("cover share count read from the filing's inline XBRL", () => {
  const inst = (id: string, at: string) => `<xbrli:context id="${id}"><xbrli:period><xbrli:instant>${at}</xbrli:instant></xbrli:period></xbrli:context>`;
  const fact = (id: string, v: number) => `<ix:nonFraction contextRef="${id}" name="dei:EntityCommonStockSharesOutstanding" scale="0">${v}</ix:nonFraction>`;

  /** AAPL fixture with no company-facts count (as the SEC omits per-class counts), plus a filing document for any /Archives/ URL. */
  function setup(doc: (diluted: number, asOf: string) => string) {
    const { facts, sub } = loadFixture("AAPL");
    const f = structuredClone(facts) as typeof facts;
    delete (f.facts as Record<string, unknown>).dei;
    delete (f.facts["us-gaap"] as Record<string, unknown>).CommonStockSharesOutstanding;
    const base = buildCompanyFilings(f, sub, { ticker: "AAPL", source: "snapshot" });
    expect(base.sharesOutstanding).toBeNull();
    const diluted = base.annual.at(-1)!.items.dilutedShares!.value;
    const asOf = base.trailing?.end ?? base.annual.at(-1)!.end;
    const html = doc(diluted, asOf);
    const fetchFn = (async (url: string) => {
      if (url.includes("company_tickers")) return new Response(JSON.stringify(tickerFile));
      if (url.includes("companyfacts")) return new Response(JSON.stringify(f));
      if (url.includes("submissions")) return new Response(JSON.stringify(sub));
      if (url.includes("/Archives/")) return new Response(html);
      return new Response("missing", { status: 404 });
    }) as unknown as typeof fetch;
    return edgarLiveSource(createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} }));
  }

  it("fills a missing count from the cover page", async () => {
    const live = setup((diluted, asOf) => inst("a", asOf) + inst("b", asOf) + fact("a", Math.round(diluted * 0.6)) + fact("b", Math.round(diluted * 0.35)));
    const c = (await live.getCompany("AAPL"))!;
    expect(c.sharesOutstanding?.classes).toBe(2);
    expect(c.sharesOutstanding?.value).toBe(Math.round((await setupDiluted()) * 0.6) + Math.round((await setupDiluted()) * 0.35));
  });

  it("drops a multi-class sum far from the diluted average (Berkshire-style share classes)", async () => {
    const live = setup((diluted, asOf) => inst("a", asOf) + inst("b", asOf) + fact("a", Math.round(diluted * 0.01)) + fact("b", Math.round(diluted * 0.6)));
    expect((await live.getCompany("AAPL"))!.sharesOutstanding).toBeNull();
  });

  it("keeps a multi-class sum it cannot check (no diluted average), still marked as several classes", async () => {
    const { facts, sub } = loadFixture("AAPL");
    const f = structuredClone(facts) as typeof facts;
    delete (f.facts as Record<string, unknown>).dei;
    delete (f.facts["us-gaap"] as Record<string, unknown>).CommonStockSharesOutstanding;
    delete (f.facts["us-gaap"] as Record<string, unknown>).WeightedAverageNumberOfDilutedSharesOutstanding;
    const base = buildCompanyFilings(f, sub, { ticker: "AAPL", source: "snapshot" });
    expect(base.annual.at(-1)!.items.dilutedShares).toBeUndefined();
    const asOf = base.trailing?.end ?? base.annual.at(-1)!.end;
    const html = inst("a", asOf) + inst("b", asOf) + fact("a", 900) + fact("b", 100);
    const fetchFn = (async (url: string) => {
      if (url.includes("company_tickers")) return new Response(JSON.stringify(tickerFile));
      if (url.includes("companyfacts")) return new Response(JSON.stringify(f));
      if (url.includes("submissions")) return new Response(JSON.stringify(sub));
      if (url.includes("/Archives/")) return new Response(html);
      return new Response("missing", { status: 404 });
    }) as unknown as typeof fetch;
    const live = edgarLiveSource(createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} }));
    const c = (await live.getCompany("AAPL"))!;
    expect(c.sharesOutstanding).toMatchObject({ value: 1000, classes: 2 });
  });

  async function setupDiluted() {
    const { facts, sub } = loadFixture("AAPL");
    return buildCompanyFilings(facts, sub, { ticker: "AAPL", source: "snapshot" }).annual.at(-1)!.items.dilutedShares!.value;
  }
});
