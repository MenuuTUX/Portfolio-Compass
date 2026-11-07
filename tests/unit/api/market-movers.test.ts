import { afterEach, describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/market/movers/route";
import { withFetch } from "@/tests/helpers/fetch";
const table = `<table><thead><tr><th>Symbol</th><th>% Change</th></tr></thead>
<tbody><tr><td>NVDA</td><td>5.1%</td></tr><tr><td>AMD</td><td>4.2%</td></tr></tbody></table>`;

const movers = (type = "gainers") =>
  GET(new NextRequest(`http://localhost/api/market/movers?type=${type}`));

describe("/api/market/movers (API-B24)", () => {
  it("answers 502 with an error when the upstream page is not OK, not an empty 200", async () => {
    withFetch(async () => new Response("down", { status: 503 }));
    const res = await movers();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Failed to fetch market movers" });
  });

  it("answers the tickers when the upstream page is fine", async () => {
    withFetch(async () => new Response(table, { status: 200 }));
    const res = await movers("losers");
    expect(res.status).toBe(200);
    expect((await res.json()).tickers).toEqual(["NVDA", "AMD"]);
  });

  it("still refuses an unknown type with 400", async () => {
    const res = await movers("sideways");
    expect(res.status).toBe(400);
  });
});
