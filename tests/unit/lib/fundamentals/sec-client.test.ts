import { describe, it, expect } from "bun:test";
import { createSecClient, normalizeTicker, SecHttpError } from "@/lib/fundamentals/sec-client";
import { loadFixture } from "./helpers";

const UA = "Portfolio Compass test@example.com";
const TICKERS = "https://www.sec.gov/files/company_tickers_exchange.json";
const SUB = "https://data.sec.gov/submissions/CIK0000320193.json";
const FACTS = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
const tickerFile = { fields: ["cik", "name", "ticker", "exchange"], data: [[320193, "Apple Inc.", "AAPL", "Nasdaq"], [1067983, "BERKSHIRE", "BRK-B", "NYSE"]] };
const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init);

/** A fetch stub whose response depends on the URL and the attempt number for that URL. */
function fakeFetch(handler: (url: string, attempt: number, init: RequestInit) => Promise<Response> | Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const attempts = new Map<string, number>();
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const n = (attempts.get(url) ?? 0) + 1;
    attempts.set(url, n);
    return handler(url, n, init);
  }) as unknown as typeof fetch;
  return { fetchFn, calls, count: (url: string) => attempts.get(url) ?? 0 };
}

const fixtureBodies = () => {
  const { facts, sub } = loadFixture("AAPL");
  return { facts, sub };
};

describe("createSecClient", () => {
  it("refuses to run without a contact address", () => {
    expect(() => createSecClient({ userAgent: "" })).toThrow(/contact email/);
    expect(() => createSecClient({ userAgent: "Portfolio Compass" })).toThrow(/contact email/);
  });

  it("sends the declared User-Agent and nothing about the user", async () => {
    const { sub } = fixtureBodies();
    const { fetchFn, calls } = fakeFetch(() => json(sub));
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} });
    await client.submissions(320193);
    expect(calls[0].url).toBe(SUB);
    expect(calls[0].init.headers).toEqual({ "User-Agent": UA, Accept: "application/json" });
  });

  it("gives every request a timeout signal and aborts a request that hangs", async () => {
    const { fetchFn, calls } = fakeFetch((_url, _n, init) => new Promise<Response>((_, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
    }));
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, timeoutMs: 20, sleep: async () => {} });
    await expect(client.submissions(320193)).rejects.toThrow(/timed out after 20 ms/);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0].init.signal!.aborted).toBe(true);
  });

  it("retries once on 503 after the Retry-After delay", async () => {
    const { sub } = fixtureBodies();
    const { fetchFn, count } = fakeFetch((_url, n) =>
      n === 1 ? new Response("busy", { status: 503, headers: { "Retry-After": "2" } }) : json(sub));
    const sleeps: number[] = [];
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async (ms) => { sleeps.push(ms); } });
    expect(await client.submissions(320193)).not.toBeNull();
    expect(count(SUB)).toBe(2);
    expect(sleeps).toContain(2000);
  });

  it("caps the Retry-After wait at 5 seconds and retries only once", async () => {
    const { fetchFn, count } = fakeFetch(() => new Response("slow down", { status: 429, headers: { "Retry-After": "60" } }));
    const sleeps: number[] = [];
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async (ms) => { sleeps.push(ms); } });
    await expect(client.companyFacts(320193)).rejects.toBeInstanceOf(SecHttpError);
    expect(count(FACTS)).toBe(2);
    expect(sleeps).toContain(5000);
  });

  it("treats a 404 on submissions or facts as not a filer (null), not an error", async () => {
    const { fetchFn } = fakeFetch(() => new Response("not found", { status: 404 }));
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} });
    expect(await client.submissions(320193)).toBeNull();
    expect(await client.companyFacts(320193)).toBeNull();
  });

  it("caches a failure for 30 seconds so a second caller does not hit the endpoint", async () => {
    let t = 0;
    const { fetchFn, count } = fakeFetch(() => new Response("boom", { status: 500 }));
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, now: () => t, sleep: async () => {} });
    await expect(client.submissions(320193)).rejects.toBeInstanceOf(SecHttpError);
    await expect(client.submissions(320193)).rejects.toThrow(/500/);
    expect(count(SUB)).toBe(1);
    t = 29_000;
    await expect(client.submissions(320193)).rejects.toThrow(/500/);
    expect(count(SUB)).toBe(1);
    t = 31_000;
    await expect(client.submissions(320193)).rejects.toThrow(/500/);
    expect(count(SUB)).toBe(2);
  });

  it("two concurrent callers on a failing endpoint share one attempt", async () => {
    const { fetchFn, count } = fakeFetch(() => new Response("boom", { status: 500 }));
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} });
    const results = await Promise.allSettled([client.companyFacts(320193), client.companyFacts(320193)]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(count(FACTS)).toBe(1);
  });

  it("spaces requests to stay under the SEC rate limit", async () => {
    const { sub } = fixtureBodies();
    const { fetchFn } = fakeFetch(() => json(sub));
    const waits: number[] = [];
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, ratePerSecond: 5, now: () => 0, sleep: async (ms) => { waits.push(ms); } });
    await Promise.all([client.submissions(1), client.submissions(2), client.submissions(3)]);
    expect(waits).toEqual([200, 400]);
  });

  it("builds the ticker map once and reuses it", async () => {
    const { fetchFn, count } = fakeFetch(() => json(tickerFile));
    const client = createSecClient({ userAgent: UA, fetch: fetchFn, sleep: async () => {} });
    expect((await client.lookup("aapl"))!.cik).toBe(320193);
    expect((await client.lookup("BRK.B"))!.cik).toBe(1067983);
    expect(await client.lookup("XEQT.TO")).toBeNull();
    expect(await client.tickers()).toBe(await client.tickers());
    expect(count(TICKERS)).toBe(1);
    expect(normalizeTicker(" brk.b ")).toBe("BRK-B");
  });
});
