import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mockModule } from "@/tests/helpers/mock-module";

const originalFetch = globalThis.fetch;

await mockModule("next/server", () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) { this.nextUrl = new URL(url); }
  },
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      _data: data,
      status: init?.status ?? 200,
      headers: new Headers(init?.headers),
    }),
  },
}));

const { GET } = await import("@/app/api/market/fx-history/route");
const { NextRequest } = await import("next/server");

describe("GET /api/market/fx-history", () => {
  beforeEach(() => { globalThis.fetch = originalFetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("validates ISO date bounds and range ordering before fetching", async () => {
    const invalid = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-02-30&end_date=2026-03-01",
    ) as any) as any;
    const reversed = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-03-02&end_date=2026-03-01",
    ) as any) as any;
    expect(invalid.status).toBe(400);
    expect(reversed.status).toBe(400);
  });

  it("rejects requests spanning more than two calendar years", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ observations: [] }), {
      status: 200,
    })) as unknown as typeof fetch;
    const tooWide = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-01-01&end_date=2028-01-02",
    ) as any) as any;
    const maxAllowed = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-01-01&end_date=2028-01-01",
    ) as any) as any;
    expect(tooWide.status).toBe(400);
    expect(maxAllowed.status).toBe(200);

    const ancientWide = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=0001-01-01&end_date=1902-01-01",
    ) as any) as any;
    expect(ancientWide.status).toBe(400);
  });

  it("requests the date range and returns only sorted positive dated rates", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ observations: [
        { d: "2026-09-22", FXUSDCAD: { v: "1.41" } },
        { d: "2026-09-21", FXUSDCAD: { v: "1.40" } },
        { d: "2026-09-23", FXUSDCAD: { v: "not available" } },
        { d: "not-a-date", FXUSDCAD: { v: "1.50" } },
        { d: "2026-09-20", FXUSDCAD: { v: "1.50" } },
      ] }), { status: 200 });
    }) as unknown as typeof fetch;

    const response = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-09-21&end_date=2026-09-22",
    ) as any) as any;
    const url = new URL(requestedUrl);
    expect(url.searchParams.get("start_date")).toBe("2026-09-21");
    expect(url.searchParams.get("end_date")).toBe("2026-09-22");
    expect(response.status).toBe(200);
    expect(response._data.series).toEqual([
      { date: "2026-09-21", usdCad: 1.4 },
      { date: "2026-09-22", usdCad: 1.41 },
    ]);
  });

  it("returns 502 when Valet fails", async () => {
    globalThis.fetch = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    const response = await GET(new NextRequest(
      "http://localhost/api/market/fx-history?start_date=2026-09-21&end_date=2026-09-22",
    ) as any) as any;
    expect(response.status).toBe(502);
  });
});
