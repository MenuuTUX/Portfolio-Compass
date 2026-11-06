/**
 * Some filers (Cisco, Microsoft) tag the cash-flow depreciation line with their own extension tag, such as
 * csco:DepreciationAmortizationAndOther. The SEC company-facts API leaves extension tags out, so the figure is
 * read from the filing's own inline XBRL instead.
 */

const DA_NAMES = /^(?!us-gaap:|dei:|srt:)[\w.-]+:(DepreciationAmortizationAndOther|DepreciationDepletionAndAmortization|DepreciationAndAmortization|DepreciationAmortizationAndAccretionNet)$/;
const DAY = 86_400_000;
const near = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 3 * DAY;

/** Ids of the plain (no dimension) contexts whose duration is the given fiscal year. */
function yearContexts(html: string, start: string, end: string): Set<string> {
  const ids = new Set<string>();
  for (const m of html.matchAll(/<(?:xbrli:)?context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:xbrli:)?context>/g)) {
    const body = m[2];
    if (/explicitMember|typedMember/.test(body)) continue;
    const s = body.match(/<(?:xbrli:)?startDate>\s*([^<\s]+)/)?.[1];
    const e = body.match(/<(?:xbrli:)?endDate>\s*([^<\s]+)/)?.[1];
    if (s && e && near(s, start) && near(e, end)) ids.add(m[1]);
  }
  return ids;
}

/** The largest extension-tagged D&A total reported for the fiscal year, in dollars, or null. */
export function extensionDepreciation(html: string, start: string, end: string): { value: number; tag: string } | null {
  const contexts = yearContexts(html, start, end);
  if (contexts.size === 0) return null;
  let best: { value: number; tag: string } | null = null;
  for (const m of html.matchAll(/<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/g)) {
    const attrs = m[1];
    const name = attrs.match(/\bname="([^"]+)"/)?.[1];
    const ctx = attrs.match(/\bcontextRef="([^"]+)"/)?.[1];
    if (!name || !ctx || !DA_NAMES.test(name) || !contexts.has(ctx)) continue;
    const scale = Number(attrs.match(/\bscale="(-?\d+)"/)?.[1] ?? 0);
    const text = m[2].replace(/<[^>]+>/g, "").replace(/[,\s]/g, "");
    const num = Number(text);
    if (!Number.isFinite(num) || text === "" || /\bsign="-"/.test(attrs)) continue;
    const value = num * 10 ** scale;
    if (value > 0 && (!best || value > best.value)) best = { value, tag: name };
  }
  return best;
}
