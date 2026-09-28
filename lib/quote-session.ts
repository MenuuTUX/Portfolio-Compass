export const quoteSessionValues = [
  "pre-market",
  "regular",
  "after-hours",
  "closed",
  "unknown",
] as const;

export type QuoteSession = (typeof quoteSessionValues)[number];

export function quoteSessionLabel(session?: QuoteSession): string | undefined {
  switch (session) {
    case "pre-market": return "Pre-market";
    case "regular": return "Regular session";
    case "after-hours": return "After-hours";
    case "closed": return "Last close";
    default: return undefined;
  }
}

/** US and Canadian listings share Eastern time; extended trading runs 4 a.m.–8 p.m. ET. */
export function isExtendedMarketSession(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const weekday = part("weekday");
  const minuteOfDay = Number(part("hour")) * 60 + Number(part("minute"));
  return weekday !== "Sat" && weekday !== "Sun" && minuteOfDay >= 240 && minuteOfDay < 1200;
}
