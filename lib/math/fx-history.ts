import type { HistoryPoint } from "@/lib/fast-market";

export interface HistoricalFxRate {
  /** Bank of Canada observation date in YYYY-MM-DD. */
  date: string;
  /** Daily average Canadian dollars per US dollar. */
  usdCad: number;
}

function utcDay(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dateOnlyTimestamp = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(dateOnlyTimestamp) ||
      new Date(dateOnlyTimestamp).toISOString().slice(0, 10) !== value) return null;
    return value;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function calendarDaysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
    86_400_000;
}

/**
 * Convert one native-currency price series to CAD using only FX observations
 * dated on or before each price observation. Returns null on incomplete or
 * invalid input so callers can fail closed instead of mixing currencies.
 */
export function convertPriceHistoryToCad(
  points: HistoryPoint[],
  currency: string,
  fxRates: HistoricalFxRate[],
): HistoryPoint[] | null {
  if (currency !== "CAD" && currency !== "USD") return null;

  const normalizedPoints = points.map((point) => ({
    point,
    date: utcDay(point.date),
    price: Number(point.price),
  }));
  if (normalizedPoints.some(({ date, price }) =>
    !date || !Number.isFinite(price) || price <= 0
  )) return null;
  if (normalizedPoints.some(({ date }, index) =>
    index > 0 && normalizedPoints[index - 1].date! >= date!
  )) return null;

  if (currency === "CAD") {
    return normalizedPoints.map(({ point, price }) => ({ ...point, price }));
  }

  const normalizedRates = fxRates.map((rate) => ({
    date: rate.date,
    usdCad: Number(rate.usdCad),
  }));
  if (normalizedRates.some(({ date, usdCad }) =>
    !/^\d{4}-\d{2}-\d{2}$/.test(date) || utcDay(date) !== date ||
    !Number.isFinite(usdCad) || usdCad <= 0
  )) return null;

  normalizedRates.sort((a, b) => a.date.localeCompare(b.date));
  for (let index = 1; index < normalizedRates.length; index++) {
    if (normalizedRates[index - 1].date === normalizedRates[index].date) return null;
  }

  let rateIndex = 0;
  let latestRate: HistoricalFxRate | undefined;
  const converted: HistoryPoint[] = [];
  for (const { point, date, price } of normalizedPoints) {
    while (rateIndex < normalizedRates.length && normalizedRates[rateIndex].date <= date!) {
      latestRate = normalizedRates[rateIndex++];
    }
    if (!latestRate || calendarDaysBetween(latestRate.date, date!) > 7) return null;
    const cadPrice = price * latestRate.usdCad;
    if (!Number.isFinite(cadPrice) || cadPrice <= 0) return null;
    converted.push({ ...point, price: cadPrice });
  }
  return converted;
}
