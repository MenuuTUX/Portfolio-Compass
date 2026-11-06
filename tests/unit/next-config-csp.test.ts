import { describe, expect, it } from "bun:test";
import nextConfig from "@/next.config.js";

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

async function rules(): Promise<HeaderRule[]> {
  return (nextConfig as unknown as { headers: () => Promise<HeaderRule[]> }).headers();
}

const policy = (rule: HeaderRule | undefined) =>
  rule?.headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";

describe("Compass Lab content security policy", () => {
  it("is sent with every page and with JS chunks, where worker scripts come from", async () => {
    const all = await rules();
    const site = policy(all.find((r) => r.source === "/:path*"));
    const chunks = policy(all.find((r) => r.source === "/_next/static/chunks/:path*"));
    expect(site).not.toBe("");
    expect(chunks).toBe(site);
    expect(all.find((r) => r.source === "/lab")).toBeUndefined();
  });

  it("lets strategy code reach only this site, the CDN and the Bank of Canada rate feed", async () => {
    const lab = policy((await rules()).find((r) => r.source === "/:path*"));
    const connect = lab.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src")) ?? "";
    const hosts = connect.split(/\s+/).slice(1).filter((t) => !t.startsWith("ws"));
    expect(hosts.sort()).toEqual(["'self'", "https://cdn.jsdelivr.net", "https://www.bankofcanada.ca"].sort());
    expect(lab).toContain("object-src 'none'");
    expect(lab).toContain("frame-ancestors 'none'");
  });

  it("still sends the site-wide security headers everywhere", async () => {
    const all = await rules();
    const global = all.find((r) => r.source === "/:path*");
    expect(global?.headers.some((h) => h.key === "Strict-Transport-Security")).toBe(true);
  });
});
