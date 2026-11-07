/**
 * Chart colours as CSS variables, so SVG and Recharts marks follow the light
 * and dark themes defined in app/globals.css. Use these instead of hex values.
 */
export const GAIN = "var(--emerald-400)";
export const LOSS = "var(--loss)";
export const INK = "var(--ink)";
export const MUTED = "var(--muted)";
export const HAIRLINE = "var(--hairline)";
export const HAIRLINE_STRONG = "var(--hairline-strong)";

/** Monte Carlo mode colours: violet (Reshuffle), teal (Resample), amber (Randomize). */
export const MC_MODE_COLOR = {
  reshuffle: "var(--mc-reshuffle)",
  resample: "var(--mc-resample)",
  randomize: "var(--mc-randomize)",
} as const;

/** Second tone per mode, mixed with the first to give drawn paths some variety. */
export const MC_MODE_COLOR_ALT = {
  reshuffle: "var(--mc-reshuffle-alt)",
  resample: "var(--mc-resample-alt)",
  randomize: "var(--mc-randomize-alt)",
} as const;
