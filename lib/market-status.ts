
export type MarketStatus = 'OPEN' | 'CLOSED';

// US Market Holidays for 2024 and 2025
// Format: "YYYY-MM-DD"
const MARKET_HOLIDAYS = new Set([
  // 2024
  "2024-01-01", // New Year's Day
  "2024-01-15", // Martin Luther King, Jr. Day
  "2024-02-19", // Washington's Birthday
  "2024-03-29", // Good Friday
  "2024-05-27", // Memorial Day
  "2024-06-19", // Juneteenth National Independence Day
  "2024-07-04", // Independence Day
  "2024-09-02", // Labor Day
  "2024-11-28", // Thanksgiving Day
  "2024-12-25", // Christmas Day

  // 2025
  "2025-01-01", // New Year's Day
  "2025-01-20", // Martin Luther King, Jr. Day
  "2025-02-17", // Washington's Birthday
  "2025-04-18", // Good Friday
  "2025-05-26", // Memorial Day
  "2025-06-19", // Juneteenth National Independence Day
  "2025-07-04", // Independence Day
  "2025-09-01", // Labor Day
  "2025-11-27", // Thanksgiving Day
  "2025-12-25", // Christmas Day
]);

export function getMarketStatus(): MarketStatus {
  // 1. Get current time in 'America/New_York'
  const now = new Date();

  // Use Intl.DateTimeFormat to get parts in NY time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });

  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  parts.forEach(p => partMap[p.type] = p.value);

  // Reconstruct date string for holiday check: YYYY-MM-DD
  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const dateStr = `${year}-${month}-${day}`;

  // Check Holiday
  if (MARKET_HOLIDAYS.has(dateStr)) {
    return 'CLOSED';
  }

  // Check Weekend
  const weekday = partMap.weekday; // "Mon", "Tue", ...
  if (weekday === 'Sat' || weekday === 'Sun') {
    return 'CLOSED';
  }

  // Check Time (09:30 - 16:00)
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);

  // Convert to minutes from midnight
  const currentMinutes = hour * 60 + minute;
  const openMinutes = 9 * 60 + 30; // 09:30
  const closeMinutes = 16 * 60;    // 16:00

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return 'OPEN';
  }

  return 'CLOSED';
}
