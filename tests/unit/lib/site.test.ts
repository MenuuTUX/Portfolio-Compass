import { describe, it, expect } from "bun:test";
import { siteUrl } from "@/lib/site";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

describe("site origin", () => {
  it("falls back to the production origin", () => {
    expect(siteUrl).toMatch(/^https:\/\//);
  });

  it("feeds the sitemap and robots sitemap pointer", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls[0]).toBe(siteUrl);
    expect(robots().sitemap).toBe(`${siteUrl}/sitemap.xml`);
  });
});
