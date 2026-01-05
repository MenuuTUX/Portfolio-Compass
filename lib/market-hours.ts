const MARKET_HOLIDAYS = new Set([
  // 2025
  "2025-01-01", // New Year's Day
  "2025-01-20", // MLK Jr. Day
  "2025-02-17", // Presidents' Day
  "2025-04-18", // Good Friday
  "2025-05-26", // Memorial Day
  "2025-06-19", // Juneteenth
  "2025-07-04", // Independence Day
  "2025-09-01", // Labor Day
  "2025-11-27", // Thanksgiving Day
  "2025-12-25", // Christmas Day

  // 2026
  "2026-01-01", // New Year's Day
  "2026-01-19", // MLK Jr. Day
  "2026-02-16", // Presidents' Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day (Observed)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving Day
  "2026-12-25", // Christmas Day
]);

/**
 * Checks if the US Stock Market (NYSE/NASDAQ) is currently open.
 * Market Hours: 09:30 - 16:00 ET, Monday-Friday.
 * Excludes Weekends and Holidays.
 * @param date Optional date to check (defaults to now)
 */
export function isMarketOpen(date: Date = new Date()): boolean {
  // Convert to New York time parts
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  parts.forEach(({ type, value }) => {
    partMap[type] = value;
  });

  const year = parseInt(partMap.year);
  const month = partMap.month;
  const day = partMap.day;
  const hour = parseInt(partMap.hour);
  const minute = parseInt(partMap.minute);
  const weekday = partMap.weekday;

  // 1. Check Weekend
  if (weekday === "Saturday" || weekday === "Sunday") {
    return false;
  }

  // 2. Check Holidays
  // Note: month and day are 2-digit strings e.g. "01", "05"
  const dateString = `${year}-${month}-${day}`;
  if (MARKET_HOLIDAYS.has(dateString)) {
    return false;
  }

  // 3. Check Trading Hours (09:30 - 16:00)
  const time = hour * 100 + minute;
  // 930 is 9:30 AM, 1600 is 4:00 PM
  // We extend the check to 18:00 (6:00 PM) to allow cron jobs to catch the final closing price
  if (time >= 930 && time < 1800) {
    return true;
  }

  return false;
}
