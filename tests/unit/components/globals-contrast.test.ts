import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Body of a top-level rule such as `:root { ... }` or `.dark { ... }`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing block ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed block ${selector}`);
}

function decl(body: string, name: string): string {
  const m = body.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`missing --${name}`);
  return m[1].trim();
}

/** Resolve `--color-<name>` in @theme through one var() hop to a hex value. */
function themeToken(theme: string, name: string): string {
  const raw = decl(theme, `color-${name}`);
  const ref = raw.match(/^var\(--([\w-]+)\)$/);
  return ref ? ref[1] : raw;
}

function hexToLuminance(hex: string): number {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const x = hexToLuminance(a);
  const y = hexToLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const theme = block("@theme");
const light = block(":root");
const dark = block(".dark");

// Text colours used at 12px and surfaces they sit on, per theme.
const TEXT_TOKENS = {
  mutedSoft: () => themeToken(theme, "muted-soft"),
  emerald: () => themeToken(theme, "emerald-400"),
  rose: () => themeToken(theme, "rose-400"),
};

function resolveValue(body: string, token: string): string {
  // Token is either a literal var name or a theme-linked custom property.
  if (token.startsWith("#")) return token;
  return decl(body, token);
}

describe("globals.css text contrast (WCAG AA 4.5:1 for 12px text)", () => {
  const surfaces = ["canvas", "surface-card", "surface-soft"];
  const themes: Array<[string, string]> = [
    ["light", light],
    ["dark", dark],
  ];

  for (const [mode, body] of themes) {
    for (const surface of surfaces) {
      const bg = decl(body, surface);
      it(`${mode}: muted-soft text on ${surface} is at least 4.5:1`, () => {
        const fg = resolveValue(body, TEXT_TOKENS.mutedSoft());
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
      it(`${mode}: emerald text on ${surface} is at least 4.5:1`, () => {
        const fg = resolveValue(body, TEXT_TOKENS.emerald());
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
      it(`${mode}: rose text on ${surface} is at least 4.5:1`, () => {
        const fg = resolveValue(body, TEXT_TOKENS.rose());
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
