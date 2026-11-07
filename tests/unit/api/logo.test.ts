import { describe, expect, it } from "bun:test";
import { GET } from "@/app/api/logo/[ticker]/route";
import { NextRequest } from "next/server";

describe("/api/logo/[ticker]", () => {
  it("returns 400, not 500, for malformed percent-encoding", async () => {
    const res = await GET(new NextRequest("http://localhost/api/logo/%E0"), {
      params: Promise.resolve({ ticker: "%E0" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("/api/logo/[ticker] validation and caching", () => {
  const call = (ticker: string) =>
    GET(new NextRequest(`http://localhost/api/logo/${encodeURIComponent(ticker)}`), {
      params: Promise.resolve({ ticker: encodeURIComponent(ticker) }),
    });

  it("answers 400 for a value that is not a ticker, without any outbound fetch", async () => {
    const realFetch = globalThis.fetch;
    let fetched = 0;
    globalThis.fetch = (async () => {
      fetched += 1;
      return new Response("nope", { status: 404 });
    }) as unknown as typeof fetch;
    try {
      const res = await call("BAD/TICKER");
      expect(res.status).toBe(400);
      expect(fetched).toBe(0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("sends the CDN cache header for a found logo only", async () => {
    const realFetch = globalThis.fetch;
    const png = new Uint8Array(400);
    globalThis.fetch = (async () =>
      new Response(png, { status: 200, headers: { "content-type": "image/png" } })) as unknown as typeof fetch;
    try {
      const found = await call("ZZLOGOTEST");
      expect(found.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=86400, stale-while-revalidate=604800");
      expect(found.headers.get("Cache-Control")).toContain("max-age=86400");
    } finally {
      globalThis.fetch = realFetch;
    }

    globalThis.fetch = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    try {
      const missing = await call("ZZNOLOGO1");
      expect(missing.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
      expect(missing.headers.get("Cache-Control")).toBe("public, max-age=3600");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
