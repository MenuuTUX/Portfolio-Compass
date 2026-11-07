import { DAY_MS } from "@/lib/dates";
/**
 * Some filers (Cisco, Microsoft) tag the cash-flow depreciation line with their own extension tag, such as
 * csco:DepreciationAmortizationAndOther. The SEC company-facts API leaves extension tags out, so the figure is
 * read from the filing's own inline XBRL instead.
 */

const DA_NAMES = /^(?!us-gaap:|dei:|srt:)[\w.-]+:(DepreciationAmortizationAndOther|DepreciationDepletionAndAmortization|DepreciationAndAmortization|DepreciationAmortizationAndAccretionNet)$/;
const near = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 3 * DAY_MS;

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

/**
 * Cover-page share count from the filing's inline XBRL. The SEC company-facts API leaves out dei:
 * EntityCommonStockSharesOutstanding when it is reported per share class (Meta, Visa, Mastercard, Berkshire), so
 * the per-class facts are read here and added up. Only the newest date on the cover counts, and each class once.
 */
export function coverShareCount(html: string, weights: Record<string, number> = {}): { value: number; asOf: string; classes: number; weighted: boolean } | null {
  const contexts = new Map<string, { at: string; member?: string }>();
  for (const m of html.matchAll(/<(?:xbrli:)?context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:xbrli:)?context>/g)) {
    const at = m[2].match(/<(?:xbrli:)?instant>\s*([^<\s]+)/)?.[1];
    if (at) contexts.set(m[1], { at, member: m[2].match(/<xbrldi:explicitMember[^>]*>\s*([^<\s]+)/)?.[1] });
  }
  const perContext = new Map<string, { value: number; asOf: string; member?: string }>();
  for (const m of html.matchAll(/<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/g)) {
    const attrs = m[1];
    if (attrs.match(/\bname="([^"]+)"/)?.[1] !== "dei:EntityCommonStockSharesOutstanding") continue;
    const ref = attrs.match(/\bcontextRef="([^"]+)"/)?.[1];
    const ctx = ref ? contexts.get(ref) : undefined;
    if (!ref || !ctx || perContext.has(ref) || /\bsign="-"/.test(attrs)) continue;
    const text = m[2].replace(/<[^>]+>/g, "").replace(/[,\s]/g, "");
    const num = Number(text);
    const value = num * 10 ** Number(attrs.match(/\bscale="(-?\d+)"/)?.[1] ?? 0);
    if (text !== "" && Number.isFinite(value) && value > 0) perContext.set(ref, { value, asOf: ctx.at, member: ctx.member });
  }
  if (perContext.size === 0) return null;
  const latest = [...perContext.values()].reduce((m, f) => (f.asOf > m ? f.asOf : m), "");
  const rows = [...perContext.values()].filter((f) => f.asOf === latest);
  // Share classes that are not one-for-one are counted at their weight when every class is in `weights`
  // (keyed by the member name without its prefix, such as CommonClassAMember).
  const weightOf = (member?: string) => (member ? weights[member.split(":").pop()!] : undefined);
  const weighted = rows.length > 0 && rows.every((r) => weightOf(r.member) !== undefined);
  return {
    value: rows.reduce((s, f) => s + f.value * (weighted ? weightOf(f.member)! : 1), 0),
    asOf: latest,
    classes: rows.length,
    weighted,
  };
}

/**
 * Conversion rates into the main class, as a filer tags them per share class (Visa: v:CommonStockConversionRate).
 * Returns the class member name without its prefix mapped to the rate on the newest date that has one. A class with
 * no numeric rate (the main class itself, shown as a dash) is left out.
 */
export function classConversionRates(html: string, factName: string): Record<string, number> {
  const contexts = new Map<string, { at: string; member: string }>();
  for (const m of html.matchAll(/<(?:xbrli:)?context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:xbrli:)?context>/g)) {
    const at = m[2].match(/<(?:xbrli:)?instant>\s*([^<\s]+)/)?.[1];
    const member = m[2].match(/<xbrldi:explicitMember[^>]*>\s*([^<\s]+)/)?.[1];
    if (at && member) contexts.set(m[1], { at, member: member.split(":").pop()! });
  }
  const best: Record<string, { at: string; rate: number }> = {};
  for (const m of html.matchAll(/<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/g)) {
    if (m[1].match(/\bname="([^"]+)"/)?.[1] !== factName) continue;
    const ctx = contexts.get(m[1].match(/\bcontextRef="([^"]+)"/)?.[1] ?? "");
    const rate = Number(m[2].replace(/<[^>]+>/g, "").replace(/[,\s]/g, ""));
    if (!ctx || !Number.isFinite(rate) || rate <= 0) continue;
    if (!best[ctx.member] || ctx.at > best[ctx.member].at) best[ctx.member] = { at: ctx.at, rate };
  }
  return Object.fromEntries(Object.entries(best).map(([k, v]) => [k, v.rate]));
}
