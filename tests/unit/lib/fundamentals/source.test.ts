import { describe, it, expect } from "bun:test";
import { createSecClient, normalizeTicker } from "@/lib/fundamentals/sec-client";
import { edgarLiveSource, snapshotSource, withFallback, type FilingsSource } from "@/lib/fundamentals/source";
import { fixtureCompany, loadFixture } from "./helpers";

const UA = "Portfolio Compass test@example.com";
const tickerFile = { fields: ["cik", "name", "ticker", "exchange"], data: [[320193, "Apple Inc.", "AAPL", "Nasdaq"], [1067983, "BERKSHIRE", "BRK-B", "NYSE"]] };

/** A fetch stub that serves the AAPL fixtures and records every request. */
function stubFetch() {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const { facts, sub } = loadFixture("AAPL");
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const body = url.includes("company_tickers") ? tickerFile : url.includes("companyfacts") ? facts : url.includes("submissions") ? sub : null;
    return body ? new Response(JSON.stringify(body)) : new Response("missing", { status: 404 });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("createSecClient", () => {
  it("refuses to run without a contact address", () => {
    expect(() => createSecClient({ userAgent: "" })).toThrow(/contact email/);
    expect(() => createSecClient({ userAgent: "Portfolio Compass" })).toThrow(/contact email/);
  });

  it("sends the declared User-Agent and nothing about the user", async () => {
    const { fetchFn, calls } = stubFetch();
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} });
    await client.submissions(320193);
    expect(calls[0].url).toBe("https://data.sec.gov/submissions/CIK0000320193.json");
    expect(calls[0].headers).toEqual({ "User-Agent": UA, Accept: "application/json" });
  });

  it("spaces requests to stay under the SEC rate limit", async () => {
    const { fetchFn } = stubFetch();
    const waits: number[] = [];
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, ratePerSecond: 5, now: () => 0, sleep: async (ms) => { waits.push(ms); } });
    await Promise.all([client.submissions(1), client.submissions(2), client.submissions(3)]);
    expect(waits).toEqual([200, 400]);
  });

  it("shares one request between concurrent callers and caches the result", async () => {
    const { fetchFn, calls } = stubFetch();
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} });
    await Promise.all([client.companyFacts(320193), client.companyFacts(320193)]);
    await client.companyFacts(320193);
    expect(calls.filter((c) => c.url.includes("companyfacts")).length).toBe(1);
  });

  it("looks up tickers, including class shares written with a dot", async () => {
    const { fetchFn } = stubFetch();
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} });
    expect((await client.lookup("aapl"))!.cik).toBe(320193);
    expect((await client.lookup("BRK.B"))!.cik).toBe(1067983);
    expect(await client.lookup("XEQT.TO")).toBeNull();
    expect(normalizeTicker(" brk.b ")).toBe("BRK-B");
  });
});

describe("sources", () => {
  it("live source builds a company and says null for non-filers", async () => {
    const { fetchFn } = stubFetch();
    const live = edgarLiveSource(createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} }));
    const c = (await live.getCompany("AAPL"))!;
    expect(c.source).toBe("edgar-live");
    expect(c.annual.length).toBeGreaterThan(3);
    expect(await live.getCompany("XEQT.TO")).toBeNull();
  });

  it("snapshot source returns the same company as live, labeled as snapshot", async () => {
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
