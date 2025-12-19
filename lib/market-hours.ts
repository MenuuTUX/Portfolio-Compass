// lib/market-hours.ts

/**
 * Checks if the US Stock Market (NYSE/Nasdaq) is currently open.
 * Uses 'America/New_York' timezone for all checks.
 */

const HOLIDAYS_2025 = [
  '2025-01-01', // New Year's Day
  '2025-01-20', // Martin Luther King Jr. Day
  '2025-02-17', // Presidents' Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving Day
  '2025-12-25', // Christmas Day
];

const HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // Martin Luther King Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving Day
  '2026-12-25', // Christmas Day
];

const MARKET_HOLIDAYS = new Set([...HOLIDAYS_2025, ...HOLIDAYS_2026]);

export function isMarketOpen(date?: Date): boolean {
  const checkDate = date || new Date();

  // Create a formatter for New York time to extract components correctly
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(checkDate);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;

  const weekday = getPart('weekday');
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');

  // Note: Intl returns hour as '09' or '24' based on locale but usually 0-23 in en-US with hour12: false
  // It handles "24:00" vs "00:00" quirks by using the date object.
  // We parse the string integer.
  const hourStr = getPart('hour') || '0';
  const minuteStr = getPart('minute') || '0';

  // Handle specific case where midnight might be returned as 24 in some implementations,
  // though 'en-US' usually returns 00-23.
  const hour = parseInt(hourStr, 10) % 24;
  const minute = parseInt(minuteStr, 10);

  // 1. Weekend Check
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }

  // 2. Holiday Check
  const dateString = `${year}-${month}-${day}`;
  if (MARKET_HOLIDAYS.has(dateString)) {
    return false;
  }

  // 3. Trading Hours Check: 09:30 - 16:00 ET
  const timeInMinutes = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 09:30 -> 570
  const marketClose = 16 * 60;    // 16:00 -> 960

  // Open strictly at 09:30 inclusive and closes at 16:00 exclusive (market closes AT 4pm)
  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}
