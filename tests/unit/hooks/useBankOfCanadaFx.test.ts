import { describe, expect, it } from "bun:test";
import { selectLatestBankOfCanadaFx } from "@/hooks/useBankOfCanadaFx";

describe("selectLatestBankOfCanadaFx", () => {
  it("selects the newest valid observation from chronological Valet results", () => {
    expect(selectLatestBankOfCanadaFx([
      { d: "2026-09-24", FXUSDCAD: { v: "1.40" } },
      { d: "2026-09-25", FXUSDCAD: { v: "1.41" } },
      { d: "2026-09-26", FXUSDCAD: { v: "not available" } },
    ])).toEqual({ usdCad: 1.41, date: "2026-09-25" });
  });
});
