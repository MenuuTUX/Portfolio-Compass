import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/etfs/search/route";

const call = (query: string) =>
  GET(new NextRequest(`http://localhost/api/etfs/search?${query}`));

describe("/api/etfs/search paging parameters (API-B19)", () => {
  it.each([
    "skip=12abc",
    "skip=1.5",
    "skip=-1",
    "skip=10001",
    "skip=",
    "limit=12abc",
    "limit=0",
    "limit=51",
    "limit=1e2",
  ])("answers 400 for %s", async (query) => {
    const res = await call(query);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("limit from 1 to 50");
  });
});
