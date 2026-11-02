import { describe, expect, it } from "bun:test";
import { countVariants, VARIANT_WARNING_AT } from "@/lib/lab/engine/variants";

describe("countVariants", () => {
  it("counts each distinct hash once across runs and sweeps", () => {
    expect(countVariants(["a", "b", "a"], ["b", "c"])).toBe(3);
    expect(countVariants([], [])).toBe(0);
  });

  it("warns from ten variants", () => {
    expect(VARIANT_WARNING_AT).toBe(10);
  });
});
