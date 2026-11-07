import { afterEach, describe, expect, it } from "bun:test";
import { getStockProfile } from "@/lib/scrapers/stock-analysis";
import { withFetch } from "@/tests/helpers/fetch";
describe("stockanalysis profile URL for share classes", () => {
  it.each(["BRK.B", "BRK-B"])("%s maps to /stocks/brk.b/, not another company", async (ticker) => {
    const urls: string[] = [];
    withFetch(async (url: string | URL | Request) => {
      urls.push(url.toString());
      return new Response("", { status: 404 });
    });

    await getStockProfile(ticker);

    expect(urls[0]).toBe("https://stockanalysis.com/stocks/brk.b/");
  });
});
