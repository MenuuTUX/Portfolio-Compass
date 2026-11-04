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
