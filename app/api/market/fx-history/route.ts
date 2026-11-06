import { cacheHeaders, CACHE } from "@/lib/http-cache";
import { NextRequest, NextResponse } from "next/server";
import type { HistoricalFxRate } from "@/lib/math/fx-history";

function isIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isRangeWithinTwoYears(startDate: string, endDate: string): boolean {
  const year = Number(startDate.slice(0, 4));
  const month = Number(startDate.slice(5, 7)) - 1;
  const day = Number(startDate.slice(8, 10));
  const endYear = Number(endDate.slice(0, 4));
  const endMonth = Number(endDate.slice(5, 7)) - 1;
  const endDay = Number(endDate.slice(8, 10));
  const yearDifference = endYear - year;
  if (yearDifference < 2) return true;
  if (yearDifference > 2) return false;

  const anniversaryYear = year + 2;
  const isLeapYear = anniversaryYear % 4 === 0 &&
    (anniversaryYear % 100 !== 0 || anniversaryYear % 400 === 0);
  const daysInMonth = month === 1
    ? (isLeapYear ? 29 : 28)
    : ([3, 5, 8, 10].includes(month) ? 30 : 31);
  const anniversaryDay = Math.min(day, daysInMonth);
  return endMonth < month || (endMonth === month && endDay <= anniversaryDay);
}

const DAILY_SERIES_START = "2017-01-03";
const LEGACY_SERIES_END = "2017-01-02";

async function fetchObservations(seriesId: string, startDate: string, endDate: string): Promise<HistoricalFxRate[]> {
  const url = new URL(`https://www.bankofcanada.ca/valet/observations/${seriesId}/json`);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Valet returned ${response.status}`);
  const data = await response.json() as { observations?: Record<string, { v?: string } | string | undefined>[] };
  return (data.observations ?? []).flatMap((observation) => {
    const date = observation.d;
    const raw = observation[seriesId];
    const usdCad = Number(typeof raw === "object" && raw !== null ? raw.v : NaN);
    return typeof date === "string" && isIsoDate(date) && date >= startDate && date <= endDate &&
        Number.isFinite(usdCad) && usdCad > 0
      ? [{ date, usdCad }]
      : [];
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const startDate = params.get("start_date");
  const endDate = params.get("end_date");
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate ||
    !isRangeWithinTwoYears(startDate, endDate)) {
    return NextResponse.json(
      { error: "Valid start_date and end_date are required" },
      { status: 400 },
    );
  }

  try {
    // The daily series starts on 2017-01-03; the older noon series covers the years before it.
    const [recent, legacy] = await Promise.all([
      endDate >= DAILY_SERIES_START
        ? fetchObservations("FXUSDCAD", startDate > DAILY_SERIES_START ? startDate : DAILY_SERIES_START, endDate)
        : [],
      startDate < DAILY_SERIES_START
        ? fetchObservations("IEXE0101", startDate, endDate < LEGACY_SERIES_END ? endDate : LEGACY_SERIES_END)
        : [],
    ]);
    const byDate = new Map<string, number>();
    for (const point of [...legacy, ...recent]) byDate.set(point.date, point.usdCad);
    const series: HistoricalFxRate[] = [...byDate]
      .map(([date, usdCad]) => ({ date, usdCad }))
      .sort((x, y) => x.date.localeCompare(y.date));

    return NextResponse.json(
      { series },
      { headers: cacheHeaders(CACHE.fxHistory) },
    );
  } catch (error) {
    console.error("[API] Bank of Canada FX history failed:", error);
    return NextResponse.json(
      { error: "Failed to load historical FX data" },
      { status: 502 },
    );
  }
}
