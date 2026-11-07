// Display formatting shared by every screen. A missing value reads as "n/a", never 0.
// Float dust from cash accounting (like -0.000001) displays as zero.

const clean = (v: number, eps: number) => (Math.abs(v) < eps ? 0 : v);
const isMissing = (v: number | null | undefined): v is null | undefined => v == null || !Number.isFinite(v);

/** A fraction as a percent: 0.123 -> "12.3%". */
export const pct = (v: number | null | undefined, digits = 1) =>
  isMissing(v) ? "n/a" : `${clean(v * 100, 0.5 * 10 ** -digits).toFixed(digits)}%`;

/** A fraction as a signed percent with a true minus sign: 0.042 -> "+4.2%". */
export const signedPct = (v: number | null | undefined, digits = 1) =>
  isMissing(v) ? "n/a" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(digits)}%`;

/** A value already in percent as a signed percent: 4.2 -> "+4.2%". Zero reads as positive. */
export const signedPercent = (v: number, digits = 1) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;

export const ratio = (v: number | null | undefined) => (isMissing(v) ? "n/a" : v.toFixed(2));

export function money(v: number | null | undefined, currency = "USD") {
  if (isMissing(v)) return "n/a";
  v = clean(v, 0.005);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2,
  }).format(v);
}

/**
 * 1_200_000 -> "$1.2M". Without a valid ISO currency code the amount is
 * shown as a bare number; `locale` only matters for the symbol and grouping.
 */
export function compactMoney(v: number, currency?: string, locale = "en-CA") {
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined;
  return new Intl.NumberFormat(locale, {
    ...(code ? { style: "currency" as const, currency: code, currencyDisplay: "narrowSymbol" as const } : {}),
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}

/** A value already in percent units, no scaling: 4.2 -> "4.2%". */
export const percent = (v: number, digits = 1) => `${v.toFixed(digits)}%`;
