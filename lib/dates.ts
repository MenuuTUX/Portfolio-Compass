export const DAY_MS = 86_400_000;
export const YEAR_DAYS = 365.25;

/** Calendar days from `from` to `to` (ISO dates or timestamps); fractional for timestamps. */
export function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / DAY_MS;
}

/** The ISO date `days` calendar days after `date` (negative goes back). */
export function shiftIsoDate(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}
