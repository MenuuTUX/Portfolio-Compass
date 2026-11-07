/**
 * Builds the trimmed SEC fixtures in this folder from full downloads.
 * Usage: bun tests/fixtures/sec/trim.ts <dir with facts_CIK.json and sub_CIK.json> TICKER=CIK ...
 * Keeps only the tags in lib/fundamentals/concepts.ts, facts ending 2014 or later,
 * and the newest 150 filings, so each fixture stays small.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tagsUsed } from "@/lib/fundamentals/concepts";

const [dir, ...pairs] = process.argv.slice(2);
const keep = tagsUsed();
for (const pair of pairs) {
  const [ticker, cik] = pair.split("=");
  const facts = JSON.parse(readFileSync(join(dir, `facts_${cik}.json`), "utf8"));
  const trimmed: Record<string, Record<string, unknown>> = {};
  for (const [ns, tags] of Object.entries(keep)) {
    const src = facts.facts[ns] ?? {};
    for (const tag of tags) {
      if (!src[tag]) continue;
      const units: Record<string, unknown[]> = {};
      for (const [unit, list] of Object.entries(src[tag].units as Record<string, { end: string }[]>)) {
        const recent = list.filter((f) => f.end >= "2014-01-01");
        if (recent.length) units[unit] = recent;
      }
      (trimmed[ns] ??= {})[tag] = { units };
    }
  }
  writeFileSync(join(import.meta.dir, `${ticker.toLowerCase()}-facts.json`),
    JSON.stringify({ cik: facts.cik, entityName: facts.entityName, facts: trimmed }));

  const sub = JSON.parse(readFileSync(join(dir, `sub_${cik}.json`), "utf8"));
  const r = sub.filings.recent;
  const n = Math.min(150, r.form.length);
  const pick = (k: string) => (r[k] as unknown[] | undefined)?.slice(0, n);
  writeFileSync(join(import.meta.dir, `${ticker.toLowerCase()}-submissions.json`), JSON.stringify({
    cik: sub.cik, name: sub.name, sic: sub.sic, sicDescription: sub.sicDescription,
    fiscalYearEnd: sub.fiscalYearEnd, tickers: sub.tickers, exchanges: sub.exchanges,
    filings: { recent: Object.fromEntries(
      ["accessionNumber", "filingDate", "reportDate", "form", "items", "primaryDocument"].map((k) => [k, pick(k)]),
    ) },
  }));
}
