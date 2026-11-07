/**
 * Quick look at what the live fundamentals source returns for a ticker, with every SEC response kept on disk so
 * repeat runs are instant and send no requests.
 *
 *   bun --env-file=.env.local scripts/sec-lookup.ts MSFT [CSCO ...]
 *   bun --env-file=.env.local scripts/sec-lookup.ts --refresh MSFT     # ignore the cache
 *
 * Responses are cached under ~/.cache/portfolio-compass-sec-cache for 24 hours.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSecClient } from "@/lib/fundamentals/sec-client";
import { edgarLiveSource, withFallback } from "@/lib/fundamentals/source";

const DIR = join(homedir(), ".cache", "portfolio-compass-sec-cache");
const MAX_AGE_MS = 24 * 3600_000;
const refresh = process.argv.includes("--refresh");
const tickers = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const userAgent = process.env.SEC_USER_AGENT;
if (!userAgent) throw new Error("SEC_USER_AGENT is not set (run with --env-file=.env.local).");
if (tickers.length === 0) throw new Error("Give at least one ticker.");
mkdirSync(DIR, { recursive: true });

let hits = 0;
let misses = 0;
const cachedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const path = join(DIR, createHash("sha1").update(url).digest("hex"));
  if (!refresh && existsSync(path) && Date.now() - statSync(path).mtimeMs < MAX_AGE_MS) {
    hits++;
    return new Response(readFileSync(path));
  }
  misses++;
  const res = await fetch(input, init);
  if (res.ok) writeFileSync(path, Buffer.from(await res.clone().arrayBuffer()));
  return res;
}) as typeof fetch;

const source = withFallback(edgarLiveSource(createSecClient({ userAgent, fetch: cachedFetch })));
const m = (n: number | undefined) => (n === undefined ? "-" : `${Math.round(n / 1e6).toLocaleString("en-US")}M`);

for (const t of tickers) {
  const { company: c } = await source.lookup(t);
  if (!c) { console.log(`${t}: not an SEC filer`); continue; }
  const last = c.annual[c.annual.length - 1];
  const da = last?.items.depreciationAmortization;
  const tda = c.trailing?.items.depreciationAmortization;
  console.log(`${t}  ${c.name}  CIK ${c.cik}`);
  console.log(`  annual periods ${c.annual.length}, latest ${last?.end ?? "-"}, revenue ${m(last?.items.revenue?.value)}`);
  console.log(`  D&A ${m(da?.value)}  (${da?.tag ?? "-"})`);
  console.log(`  trailing ${c.trailing ? `${c.trailing.basis} to ${c.trailing.end}` : "-"}, D&A ${m(tda?.value)}  (${tda?.tag ?? "-"})`);
  console.log(`  shares ${c.sharesOutstanding ? `${c.sharesOutstanding.value.toLocaleString("en-US")} as of ${c.sharesOutstanding.asOf}, ${c.sharesOutstanding.classes} class row(s)` : "none"}`);
  console.log(`  staleness ${JSON.stringify(c.staleness)}`);
}
console.log(`\n(cache: ${hits} hits, ${misses} requests)`);
