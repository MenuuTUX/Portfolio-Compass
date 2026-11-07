import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteUrl } from "@/lib/site";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("site origin", () => {
  it("falls back to the production origin", () => {
    expect(siteUrl).toMatch(/^https:\/\//);
  });

  it("feeds the sitemap and robots sitemap pointer", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls[0]).toBe(siteUrl);
    expect(robots().sitemap).toBe(`${siteUrl}/sitemap.xml`);
  });

  it("is not exported from the root layout (keeps Fast Refresh clean)", () => {
    expect(read("app/layout.tsx")).not.toMatch(/export const siteUrl/);
  });

  it("layout exports a viewport with viewportFit cover", () => {
    expect(read("app/layout.tsx")).toMatch(/export const viewport(: Viewport)? = \{\s*viewportFit: "cover",?\s*\}/);
  });
});
