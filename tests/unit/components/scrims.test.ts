import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Full-screen overlay class strings: the element that covers the viewport. */
function fullScreenOverlays(source: string): string[] {
  return Array.from(source.matchAll(/className="([^"]*fixed inset-0[^"]*)"/g)).map((m) => m[1]);
}

describe("full-screen scrims", () => {
  for (const file of ["components/SpHeatmap.tsx", "components/InstitutionalPortfolios.tsx"]) {
    it(`${file} uses a solid scrim without backdrop blur`, () => {
      const overlays = fullScreenOverlays(read(file));
      expect(overlays.length).toBeGreaterThan(0);
      for (const cls of overlays) {
        expect(cls).not.toMatch(/backdrop-blur/);
        expect(cls).toContain("ws-scrim");
      }
    });
  }
});
