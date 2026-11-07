import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { withFetch } from "@/tests/helpers/fetch";

const { GET } = await import("@/app/api/market/fx-history/route");

describe("GET /api/market/fx-history", () => {

  it("validates ISO date bounds and range ordering before fetching", async () => {
    const invalid = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-02-30&end_date=2026-03-01",
    ));
    const reversed = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-03-02&end_date=2026-03-01",
    ));
    expect(invalid.status).toBe(400);
    expect(reversed.status).toBe(400);
  });

  it("rejects requests spanning more than two calendar years", async () => {
    withFetch(async () => new Response(JSON.stringify({ observations: [] }), {
      status: 200,
    }));
    const tooWide = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-01-01&end_date=2028-01-02",
    ));
    const maxAllowed = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-01-01&end_date=2028-01-01",
    ));
    expect(tooWide.status).toBe(400);
    expect(maxAllowed.status).toBe(200);

    const ancientWide = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=0001-01-01&end_date=1902-01-01",
    ));
    expect(ancientWide.status).toBe(400);
  });

  it("requests the date range and returns only sorted positive dated rates", async () => {
    let requestedUrl = "";
    withFetch(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ observations: [
        { d: "2026-09-22", FXUSDCAD: { v: "1.41" } },
        { d: "2026-09-21", FXUSDCAD: { v: "1.40" } },
        { d: "2026-09-23", FXUSDCAD: { v: "not available" } },
        { d: "not-a-date", FXUSDCAD: { v: "1.50" } },
        { d: "2026-09-20", FXUSDCAD: { v: "1.50" } },
      ] }), { status: 200 });
    });

    const response = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-09-21&end_date=2026-09-22",
    ));
    const url = new URL(requestedUrl);
    expect(url.searchParams.get("start_date")).toBe("2026-09-21");
    expect(url.searchParams.get("end_date")).toBe("2026-09-22");
    expect(response.status).toBe(200);
    expect((await response.json()).series).toEqual([
      { date: "2026-09-21", usdCad: 1.4 },
      { date: "2026-09-22", usdCad: 1.41 },
    ]);
  });

  it("returns 502 when Valet fails", async () => {
    withFetch(async () => new Response("", { status: 503 }));
    const response = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-09-21&end_date=2026-09-22",
    ));
    expect(response.status).toBe(502);
  });

  it("stitches the older noon series onto the daily series across 2017-01-03", async () => {
    const requested: string[] = [];
    withFetch(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requested.push(url.pathname);
      const body = url.pathname.includes("IEXE0101")
        ? { observations: [{ d: "2016-12-30", IEXE0101: { v: "1.3427" } }] }
        : { observations: [{ d: "2017-01-03", FXUSDCAD: { v: "1.3435" } }] };
      return new Response(JSON.stringify(body), { status: 200 });
    });

    const res = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2016-12-28&end_date=2017-01-05",
    ));

    expect(res.status).toBe(200);
    expect(requested.some((p) => p.includes("IEXE0101"))).toBe(true);
    expect(requested.some((p) => p.includes("FXUSDCAD"))).toBe(true);
    expect((await res.json()).series).toEqual([
      { date: "2016-12-30", usdCad: 1.3427 },
      { date: "2017-01-03", usdCad: 1.3435 },
    ]);
  });
});
