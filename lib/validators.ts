export function isValidTicker(ticker: string): boolean {
  return /^[A-Z0-9.-]{1,12}$/.test(ticker);
}
