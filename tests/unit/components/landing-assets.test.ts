import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const LANDING_FILES = ["components/Hero.tsx", "components/Footer.tsx", "components/PurposeSection.tsx"];

describe("landing logo", () => {
  for (const file of LANDING_FILES) {
    it(`${file} serves the logo through next/image with a sized request`, () => {
      const src = read(file);
      expect(src).not.toMatch(/<img[^>]*src="\/logo\.png"/);
      expect(src).toMatch(/import Image from "next\/image"/);
      expect(src).toMatch(/<Image src="\/logo\.png"[^>]*sizes="\d+px"/);
    });
  }
});

describe("landing naming", () => {
  it("uses Backtest in the PurposeSection headings", () => {
    const src = read("components/PurposeSection.tsx");
    expect(src).toContain('eyebrow="Backtest"');
    expect(src).toContain("Backtest what it assumes.");
    expect(src).not.toMatch(/eyebrow="Test"/);
  });

  it("keeps the #test anchor that the nav scrolls to", () => {
    expect(read("components/PurposeSection.tsx")).toContain('id="test"');
    expect(read("components/Hero.tsx")).toContain('{ label: "Backtest", id: "test" }');
  });
});
