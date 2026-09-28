import { NextRequest, NextResponse } from "next/server";
import type { HistoricalFxRate } from "@/lib/math/fx-history";

interface ValetResponse {
  observations?: { d?: string; FXUSDCAD?: { v?: string } }[];
}

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

  const url = new URL("https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json");
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Valet returned ${response.status}`);

    const data = await response.json() as ValetResponse;
    const series: HistoricalFxRate[] = (data.observations ?? [])
      .flatMap((observation) => {
        const date = observation.d;
        const usdCad = Number(observation.FXUSDCAD?.v);
        return date && isIsoDate(date) && date >= startDate && date <= endDate &&
            Number.isFinite(usdCad) && usdCad > 0
          ? [{ date, usdCad }]
          : [];
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(
      { series },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1800" } },
    );
  } catch (error) {
    console.error("[API] Bank of Canada FX history failed:", error);
    return NextResponse.json(
      { error: "Failed to load historical FX data" },
      { status: 502 },
    );
  }
}
