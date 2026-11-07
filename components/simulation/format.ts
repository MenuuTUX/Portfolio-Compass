export function compactMoney(v: number, currency?: string) {
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined;
  return new Intl.NumberFormat("en-CA", {
    ...(code ? { style: "currency" as const, currency: code, currencyDisplay: "narrowSymbol" as const } : {}),
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}

/** Signed percent with a true minus sign, e.g. +4.2% or −3.0%. Input is already in percent. */
export const signedPercent = (v: number, digits = 1) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;

/** Whole years for an axis, thinned so long horizons stay readable. */
export function yearTicks(years: number) {
  const step = years <= 10 ? 1 : years <= 20 ? 2 : 5;
  const out: number[] = [];
  for (let y = 0; y <= years; y += step) out.push(y);
  return out;
}

/** Evenly spaced, rounded value ticks between min and max. */
export function valueTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}
