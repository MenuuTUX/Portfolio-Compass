import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

const statusOf = (path: string, headers: Record<string, string>) => proxy(req(path, headers)).status;

describe("API rate limit keys (API-B15)", () => {
  it("gives requests without any IP header their own buckets, split by user agent", () => {
    const a = { "user-agent": "agent-a" };
    for (let i = 0; i < 120; i++) expect(statusOf("/api/market/quotes", a)).toBe(200);
    expect(statusOf("/api/market/quotes", a)).toBe(429);
    expect(statusOf("/api/market/quotes", { "user-agent": "agent-b" })).toBe(200);
  });

  it("keys by x-real-ip when x-forwarded-for is missing", () => {
    const real = { "x-real-ip": "203.0.113.50" };
    for (let i = 0; i < 120; i++) expect(statusOf("/api/market/quotes", real)).toBe(200);
    expect(statusOf("/api/market/quotes", real)).toBe(429);
    expect(statusOf("/api/market/quotes", { "x-real-ip": "203.0.113.51" })).toBe(200);
  });

  it("keeps x-forwarded-for as the first key", () => {
    const fwd = { "x-forwarded-for": "198.51.100.7, 10.0.0.1", "x-real-ip": "203.0.113.90" };
    for (let i = 0; i < 120; i++) statusOf("/api/market/quotes", fwd);
    expect(statusOf("/api/market/quotes", fwd)).toBe(429);
    expect(statusOf("/api/market/quotes", { "x-forwarded-for": "198.51.100.7" })).toBe(429);
  });
});

describe("logo rate limit (API-B16)", () => {
  it("allows 600 logo requests a minute per IP, then answers 429", () => {
    const headers = { "x-forwarded-for": "192.0.2.10" };
    for (let i = 0; i < 600; i++) expect(statusOf("/api/logo/AAPL", headers)).toBe(200);
    expect(statusOf("/api/logo/AAPL", headers)).toBe(429);
  });

  it("does not let logo traffic use up the data route budget", () => {
    const headers = { "x-forwarded-for": "192.0.2.20" };
    for (let i = 0; i < 700; i++) statusOf("/api/logo/MSFT", headers);
    expect(statusOf("/api/market/quotes", headers)).toBe(200);
  });
});
