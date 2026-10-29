// Number formatting for Compass Lab. A missing value reads as "n/a", never 0.
// Float dust from cash accounting (like -0.000001) displays as zero.

const clean = (v: number, eps: number) => (Math.abs(v) < eps ? 0 : v);

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? "n/a" : `${clean(v * 100, 0.5 * 10 ** -digits).toFixed(digits)}%`;

export const signedPct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? "n/a" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(digits)}%`;

export const ratio = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "n/a" : v.toFixed(2);

export function money(v: number | null | undefined, currency = "USD") {
  if (v == null || !Number.isFinite(v)) return "n/a";
  v = clean(v, 0.005);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2,
  }).format(v);
}

export function compactMoney(v: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(v);
}
