/**
 * Offline check of the whole SEC universe against the SEC's two nightly bulk files, with no per-ticker requests.
 *
 *   bun --env-file=.env.local scripts/sec-bulk.ts download   # once a day at most, about 3 GB into ~/.cache
 *   bun scripts/sec-bulk.ts check [--limit N] [--tickers A,B] [--workers 4]
 *
 * `check` builds every filer with the production parser and prints counts plus the cases worth reading: parser
 * crashes, stale or missing share counts, filers with quarterlies but no annual report (and whether they filed an
 * 8-K12B, which marks a holding-company successor), D&A built from two tags, and share counts far from the
 * diluted average. The report is also written to report.json in the cache folder.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildCompanyFilings } from "@/lib/fundamentals/periods";
import { SUCCESSOR_REGISTRANTS } from "@/lib/fundamentals/source";
import type { SecCompanyFacts, SecSubmissions } from "@/lib/fundamentals/types";

const DIR = join(homedir(), ".cache", "portfolio-compass-sec-bulk");
const FILES = {
  "companyfacts.zip": "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip",
  "submissions.zip": "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip",
  "tickers.json": "https://www.sec.gov/files/company_tickers_exchange.json",
};
const MAX_AGE_MS = 24 * 3600_000;
const pad = (cik: number) => String(cik).padStart(10, "0");

async function download() {
  const ua = process.env.SEC_USER_AGENT;
  if (!ua) throw new Error("SEC_USER_AGENT is not set (run with --env-file=.env.local).");
  mkdirSync(DIR, { recursive: true });
  for (const [name, url] of Object.entries(FILES)) {
    const path = join(DIR, name);
    if (existsSync(path) && Date.now() - statSync(path).mtimeMs < MAX_AGE_MS) {
      console.log(`${name}: fresh, skipped`);
      continue;
    }
    console.log(`${name}: downloading`);
    const proc = Bun.spawn(["curl", "-sS", "-f", "-A", ua, "-o", `${path}.part`, url], { stdout: "inherit", stderr: "inherit" });
    if ((await proc.exited) !== 0) throw new Error(`Download of ${name} failed.`);
    await Bun.spawn(["mv", `${path}.part`, path]).exited;
  }
  console.log("done");
}

/** One entry out of a zip, parsed as JSON, or null if it is not in the archive. */
async function readEntry<T>(zip: string, entry: string): Promise<T | null> {
  const proc = Bun.spawn(["unzip", "-p", join(DIR, zip), entry], { stdout: "pipe", stderr: "ignore" });
  const text = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0 || !text) return null;
  return JSON.parse(text) as T;
}


/** CIK -> entity name for everything in the facts file, read once with python3 (head of each entry only) and kept. */
async function nameIndex(): Promise<Map<number, string>> {
  const path = join(DIR, "names.json");
  if (!existsSync(path) || statSync(path).mtimeMs < statSync(join(DIR, "companyfacts.zip")).mtimeMs) {
    const code = `import zipfile,re,json,sys\nz=zipfile.ZipFile(sys.argv[1]);o={}\nfor i in z.infolist():\n m=re.match(r"CIK(\\d{10})\\.json",i.filename)\n if not m: continue\n with z.open(i) as f: h=f.read(400).decode("utf8","ignore")\n n=re.search(r'"entityName":"([^"]*)"',h)\n if n: o[int(m.group(1))]=n.group(1)\njson.dump(o,open(sys.argv[2],"w"))`;
    const proc = Bun.spawn(["python3", "-c", code, join(DIR, "companyfacts.zip"), path], { stdout: "inherit", stderr: "inherit" });
    if ((await proc.exited) !== 0) throw new Error("Could not build the name index (needs python3).");
  }
  return new Map(Object.entries(JSON.parse(readFileSync(path, "utf8")) as Record<string, string>).map(([k, v]) => [Number(k), v]));
}

const STOP = /\b(holdings?|corp(oration)?|inc|incorporated|ltd|limited|group|plc|company|co|llc|the|md|nv|n v|de)\b/g;
const stem = (n: string) => n.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(STOP, "").replace(/\s+/g, "");

/** Predecessor candidates for a successor: same name stem and SIC, and a 15-12 filing within three weeks of its 8-K12B. */
async function suggestPredecessors(cik: number, name: string, sub: SecSubmissions, names: Map<number, string>): Promise<string[]> {
  const mine = stem(name);
  if (mine.length < 5) return [];
  const r = sub.filings.recent;
  const k12 = r.filingDate.find((_, i) => r.form[i] === "8-K12B");
  if (!k12) return [];
  const out: string[] = [];
  for (const [other, n] of names) {
    const theirs = stem(n);
    if (other === cik || theirs.length < 5 || !(theirs === mine || theirs.includes(mine) || mine.includes(theirs))) continue;
    const old = await readEntry<SecSubmissions>("submissions.zip", `CIK${pad(other)}.json`);
    if (!old || old.sic !== sub.sic) continue;
    const o = old.filings.recent;
    const term = o.filingDate.find((d, i) => o.form[i].startsWith("15-12") && Math.abs(Date.parse(d) - Date.parse(k12)) <= 21 * 864e5);
    // Exxon-style: still filing, so no termination form, but the same SIC, name stem and a 10-K history.
    out.push(`${other} ${n}${term ? ` (${o.form[o.filingDate.indexOf(term)]} ${term})` : " (no 15-12 filed)"}`);
  }
  return out;
}

interface Row { ticker: string; cik: number; name: string; note: string }
const report = {
  universe: 0, notFilers: 0, filers: 0, noAnnual: 0, noAnnualWithQuarterly: 0, noShareCount: 0, staleShares: 0, errors: 0,
  daTagSum: 0,
  crashes: [] as Row[], successors: [] as Row[], combinedFilers: [] as Row[], newRegistrants: [] as Row[], shareOutliers: [] as Row[], missingShares: [] as Row[],
};

async function check(args: string[]) {
  const opt = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  for (const f of Object.keys(FILES)) if (!existsSync(join(DIR, f))) throw new Error(`${f} is missing. Run: bun --env-file=.env.local scripts/sec-bulk.ts download`);
  const raw = JSON.parse(readFileSync(join(DIR, "tickers.json"), "utf8")) as { fields: string[]; data: (string | number)[][] };
  const [ci, ni, ti] = ["cik", "name", "ticker"].map((n) => raw.fields.indexOf(n));
  const byCik = new Map<number, { ticker: string; name: string }>();
  for (const r of raw.data) if (!byCik.has(Number(r[ci]))) byCik.set(Number(r[ci]), { ticker: String(r[ti]).toUpperCase(), name: String(r[ni]) });
  let entries = [...byCik.entries()];
  const tickerArg = opt("--tickers");
  if (tickerArg) {
    const want = new Set(tickerArg.toUpperCase().split(","));
    entries = entries.filter(([, v]) => want.has(v.ticker));
  }
  const limit = opt("--limit");
  if (limit) entries = entries.slice(0, Number(limit));
  report.universe = entries.length;
  const workers = Number(opt("--workers") ?? 4);
  const t0 = Date.now();
  let next = 0;
  let done = 0;

  async function one([cik, { ticker, name }]: [number, { ticker: string; name: string }]) {
    const row = (note: string): Row => ({ ticker, cik, name, note });
    const [facts, sub] = await Promise.all([
      readEntry<SecCompanyFacts>("companyfacts.zip", `CIK${pad(cik)}.json`),
      readEntry<SecSubmissions>("submissions.zip", `CIK${pad(cik)}.json`),
    ]);
    if (!facts || !sub) { report.notFilers++; return; }
    try {
      const c = buildCompanyFilings(facts, sub, { ticker, source: "snapshot" });
      const forms = new Set(sub.filings.recent.form);
      const last = c.annual[c.annual.length - 1];
      if (!last) {
        report.noAnnual++;
        if (forms.has("10-Q")) {
          report.noAnnualWithQuarterly++;
          const old = SUCCESSOR_REGISTRANTS[cik];
          if (forms.has("10-K")) report.combinedFilers.push(row("files a 10-K together with its parent; no annual facts under its own entity"));
          else if (forms.has("8-K12B")) report.successors.push(row(old ? `8-K12B, mapped to predecessor ${old}` : "8-K12B, NOT MAPPED"));
          else report.newRegistrants.push(row("new registrant, quarterlies only"));
        }
        return;
      }
      report.filers++;
      const so = c.sharesOutstanding;
      if (!so) { report.noShareCount++; report.missingShares.push(row("no cover or balance-sheet count")); }
      else if (Date.parse(last.end) - Date.parse(so.asOf) > 400 * 864e5) { report.staleShares++; report.shareOutliers.push(row(`stale count from ${so.asOf}`)); }
      const diluted = last.items.dilutedShares?.value;
      if (so && diluted && (so.value / diluted > 5 || so.value / diluted < 0.2)) report.shareOutliers.push(row(`cover ${so.value} vs diluted average ${Math.round(diluted)}`));
      if (last.items.depreciationAmortization?.tag.includes(" + ")) report.daTagSum++;
    } catch (e) {
      report.errors++;
      report.crashes.push(row(e instanceof Error ? e.message.slice(0, 160) : String(e)));
    }
  }

  await Promise.all(Array.from({ length: workers }, async () => {
    for (;;) {
      const i = next++;
      if (i >= entries.length) return;
      await one(entries[i]);
      if (++done % 1000 === 0) console.log(`${done}/${entries.length} in ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }));

  writeFileSync(join(DIR, "report.json"), JSON.stringify(report, null, 1));
  const { crashes, successors, combinedFilers, newRegistrants, shareOutliers, missingShares, ...counts } = report;
  console.log(JSON.stringify(counts), `${Math.round((Date.now() - t0) / 1000)}s`);
  const show = (title: string, rows: Row[], n = 15) => {
    console.log(`\n${title}: ${rows.length}`);
    for (const r of rows.slice(0, n)) console.log(`  ${r.ticker.padEnd(7)} ${String(r.cik).padStart(8)}  ${r.name.slice(0, 34).padEnd(34)} ${r.note}`);
  };
  show("parser crashes", crashes);
  show("successor candidates (quarterlies, no annual, filed 8-K12B)", successors, 40);
  const names = report.successors.length ? await nameIndex() : new Map<number, string>();
  console.log("\nsuccessor suggestions (predecessor with the same name stem and SIC):");
  for (const r of report.successors) {
    const sub = await readEntry<SecSubmissions>("submissions.zip", `CIK${pad(r.cik)}.json`);
    const found = sub ? await suggestPredecessors(r.cik, r.name, sub, names) : [];
    const mapped = SUCCESSOR_REGISTRANTS[r.cik];
    const agrees = mapped !== undefined && found.some((f) => f.startsWith(`${mapped} `));
    console.log(`  ${r.ticker.padEnd(7)} ${mapped === undefined ? "UNMAPPED" : agrees ? "map agrees" : "MAP DISAGREES"}  ->  ${found.slice(0, 3).join(" | ") || "no candidate"}`);
  }
  show("combined filers (own CIK has a 10-K but no annual facts)", combinedFilers, 8);
  show("share counts far from the diluted average", shareOutliers);
  show("no share count at all", missingShares);
  console.log(`\nnew registrants with quarterlies only: ${newRegistrants.length} (full list in report.json)`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "download") await download();
else if (cmd === "check") await check(rest);
else console.log("usage: bun scripts/sec-bulk.ts download | check [--limit N] [--tickers A,B] [--workers 4]");
