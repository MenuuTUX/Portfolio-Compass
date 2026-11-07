# Plan: three Monte Carlo modes

Status: implemented 2026-11-05 (uncommitted). Differences from the plan as written:
- Reshuffle's first two callouts read "Ending value" and "Halfway range" (8 in 10 paths at the middle of the horizon), since a p10 to p90 ending range is a single number for this mode.
- Benchmark (`MC_BENCH=1 bun test tests/unit/lib/monte-carlo-modes.test.ts`): default case about 95 ms, heaviest case about 670 ms on an Apple Silicon Mac, so no worker yet; the heavy case shows the "Simulating..." button state.
- Changing settings after a run shows "Press Run again to apply them" rather than re-running; mode switches reuse the last run's settings and inputs.

Goal: the Monte Carlo simulator supports all three common types (Reshuffle, Resample, Randomize), looks closer to the reference (three colored panels, path fans with a highlighted path and a dashed start line, a loss/gain histogram), and is easier to read. Nothing that exists today (seeded runs, ridge fallback, total-return basis, FX conversion, model details, 2,000-path risk run) is removed.

Out of bounds for this work: `components/OptimizationPanel.tsx`, `lib/optimizer.ts`, `hooks/usePortfolio.ts` (uncommitted optimizer rework from another session). `components/PortfolioShareCard.tsx` is also modified on this branch, so the simulator only changes the strings it passes to it.

## What exists today

- `lib/monte-carlo.ts`: one engine, `generateMonteCarloPaths`. It is **parametric**: geometric Brownian motion with correlated normal shocks (Cholesky of the sample covariance, ridge fallback for near-duplicate funds). It is **seeded**: Mulberry32 inlined inside the function, `Math.random` when no seed is given. Supports `stepDays` (k-day steps with drift k·μ and shock √k·L·Z). Also `calculateCone` (p05/p50/p95 per step), `calculateQuantile`, `calculateLogReturns`, covariance and Cholesky helpers.
- `components/simulation/MonteCarloSimulator.tsx` (888 lines), rendered from `components/WealthProjector.tsx` when "Use Monte Carlo model" is on.
  - Fetches `/api/market/chart?range=1Y&adjusted=1` when stored history is short or price-only. 1Y is the only daily range (5Y is weekly, MAX is monthly), so the sample is about 250 aligned daily returns. Mixed USD/CAD portfolios are converted with dated Bank of Canada rates.
  - Two runs per click: drawn paths (20/50/100, daily, seed `s`) and a stats run (2,000 paths, 21-day steps, seed `s+1`) for the cone and the p05/p50/p95 callouts.
  - Draws paths with one Recharts `<Line>` per path and animates by calling `setState` every frame, then swaps to a cone `AreaChart`.
  - Shows "Stronger end / Typical / Weaker end" (p95/p50/p05), a CAGR line, a sampling-error note on the drift, and a "What this simulation used" details panel with the seed and a "reuse this seed" checkbox.
- `SimulatorExplainer.tsx` describes only GBM. Tests: `tests/unit/lib/monte-carlo.test.ts`, `tests/unit/components/MonteCarloSimulator.test.tsx`, `tests/unit/components/WealthProjector.test.tsx`.

So Randomize already exists; Reshuffle and Resample are new, and both need the raw return matrix, which the component already builds (`returnsMatrix`) and then throws away after estimating μ and Σ.

## 1. Engine (`lib/monte-carlo.ts`)

### Shared seeded RNG

Lift the inlined Mulberry32 out of `generateMonteCarloPaths` into an exported `createRandom(seed?: number): () => number`, plus `randomIndex(random, n)` (`Math.floor(random() * n)`). `generateMonteCarloPaths` calls it with the same draw order, so the existing "identical paths for an explicit seed" test still holds and existing seeds still reproduce.

### One interface for the three modes

```ts
export type SimulationMode = "reshuffle" | "resample" | "randomize";

export interface SimulationInput {
  /** Aligned daily log returns, [asset][day]. Every row the same length. */
  returns: number[][];
  currentPrices: number[];
  weights: number[];          // sum to 1
  initialValue: number;
  numPaths: number;
  numDays: number;            // horizon in trading days
  stepDays?: number;          // default 1; values are recorded every stepDays
  seed?: number;
  /** Resample only: days per bootstrap block. 1 = plain i.i.d. bootstrap. */
  blockDays?: number;
}

export interface SimulationRun {
  mode: SimulationMode;
  paths: number[][];          // value at each recorded step, paths[i][0] = initialValue
  /** Reshuffle only: the path in historical order, same step grid. */
  referencePath?: number[];
}

export function simulatePaths(mode: SimulationMode, input: SimulationInput): SimulationRun;
```

All three share one valuation loop: for each step, get a vector of per-asset log returns, multiply each simulated price by `exp(r)`, and mark the buy-and-hold portfolio (shares fixed at t=0, as today). Only the source of the return vector differs:

| Mode | Where each day's return vector comes from | Key property |
|---|---|---|
| Reshuffle | A Fisher-Yates permutation of the historical **days** (whole rows across assets, so same-day co-movement is kept). | Each asset's summed log return is unchanged by reordering, so every path ends at exactly the same value. Only the route differs. |
| Resample | Historical days drawn **with replacement** (whole rows again). With `blockDays > 1`, draws a random start and copies that many consecutive days (moving-block bootstrap, wraps at the end). | Ending values differ. No normality assumption; keeps the real fat tails and skew of the sample. |
| Randomize | Existing GBM: μ (mean log return per asset) and L (regularized Cholesky of Σ) estimated from `returns`, shocks from Box-Muller. Delegates to `generateMonteCarloPaths`. | Smooth parametric distribution. Same numbers as today for the same seed. |

**Horizon longer than history.** The daily sample is about one year (T is the aligned observation count, usually 248 to 251, not 252), but horizons go to 30 years. Reshuffle tiles exactly `years` copies of the sample, so it simulates `years * T` days, then permutes. Every path ends at the same value (the sample compounded `years` times), and each copy maps to one axis year, so the x-axis ticks and `medianCAGR` line up. The engine takes `numDays = years * T` for Reshuffle; the component converts step index to axis years with `T` instead of 252 for this mode. This is the same "the past year repeats" assumption the drift already makes; the copy says so literally: "the past year's days, repeated {years} times in a random order".

`referencePath` for Reshuffle is the tiled history in its real order, drawn as the highlighted white line, as in the reference image.

**`stepDays` for the stats run.** Reshuffle and Resample produce daily return vectors and sum each block of `stepDays` before marking, so recorded values are exact at step ends. Randomize keeps its existing √k shortcut.

**Seeds.** One run seed `s`, as today. Each mode adds a fixed offset `k`: Randomize `0` (so existing seeds reproduce today's paths exactly), Resample `1000`, Reshuffle `2000`. Drawn paths use `s + k`, the stats run `s + k + 1`, so no two runs share a seed. Arithmetic is `| 0` as today.

**Cholesky failure only disables Randomize.** Today a non-positive-definite covariance stops the whole run. Reshuffle and Resample never need Cholesky, so they still run; the Randomize option shows as unavailable with the existing explanation.

**Validation.** Same `RangeError` style as `generateMonteCarloPaths`: equal-length return rows, at least 2 days, finite values, positive prices, weights summing to 1, integer `blockDays >= 1` and `<= T`.

### Summary helpers (pure, testable)

```ts
export interface OutcomeSummary {
  p10: number; p50: number; p90: number;           // ending value
  chanceOfLoss: number;                            // share of paths ending below initialValue
  maxDrawdown: { p50: number; p90: number };       // fraction, from per-path peak-to-trough
  everBelowStart: number;                          // share of paths that dip below initialValue at some step
}
export function summarizeOutcomes(paths: number[][], initialValue: number): OutcomeSummary;

export function maxDrawdown(path: ArrayLike<number>): number;

export interface HistogramBin { from: number; to: number; count: number; loss: boolean }
/** Bins ending returns so that 0 is always a bin edge, so the loss/gain color split is exact. */
export function returnHistogram(endReturns: number[], targetBins = 30): HistogramBin[];

/** The path whose ending value is the median: a real path, not the pointwise median. */
export function medianPathIndex(paths: number[][]): number;
```

`calculateCone` gains p10/p90 alongside p05/p95 (sort once, read four quantiles), so the band and the callouts use the same definition.

Drawdowns from the stats run are measured at month ends (21-day steps), which slightly understates intramonth falls; the label says "measured month to month".

## 2. UI

### Layout

Keep the current page order (header, setup, answer, chart, details, explainer) and add one control and one alternate view:

1. **Mode switcher**, a three-option segmented control under the setup panel, styled with the existing `ws-chip` pattern plus a colored dot per mode. Each option has a one-line explanation under the control that changes with the selection. **Default: Resample.** It is the most honest default for a single sample: real return shapes, ending values that differ, no bell-curve assumption.
2. **"Compare all three"** toggle that swaps the single large chart for the stacked small-multiples view from the reference image (three short panels, numbered 1 to 3, mode name in its color). Clicking a panel selects that mode and returns to the single view. This view runs the other two modes lazily on first open.

Plain-language one-liners (no em dashes):

- **Reshuffle**: "Same returns as the past year, in a different order. Every path ends in the same place; the ride there is what changes."
- **Resample**: "Real past days picked at random, with repeats. Some paths get more good days, some more bad ones."
- **Randomize**: "Returns drawn from a smooth curve fitted to the past year's average, swings and links between holdings."

### Charts per mode

- **Reshuffle and Resample: path fan.** Drawn paths in the mode color at low opacity, varying lightness slightly per path (the reference uses a blue-to-violet and green-to-teal spread). One highlighted white path: the historical order for Reshuffle, the median-ending path for Resample. A dashed horizontal line at the starting value labeled "Start" (the reference's "0R"). Optional p10 to p90 band behind the fan, on by default for Resample, off for Reshuffle (all paths end together, so the band pinches to a point at the end, which is itself worth seeing; the toggle lives in Advanced).
- **Randomize: histogram of ending return** (percent change from start), 30ish bins with 0 on a bin edge. Bins below 0 use `--loss`, bins at or above 0 use the Randomize amber. A dashed vertical line at 0 labeled "Start". Under it, a small path fan of the drawn paths, so Randomize does not lose the "paths over time" view it has today.
- Resample also gets the same histogram, collapsed under "Show ending values as a histogram", since its endings differ too. Reshuffle has no histogram (one bar).

Rendering: replace the 100 Recharts `<Line>` elements and the per-frame `setState` animation with a small custom SVG `PathFan` component: each path downsampled to at most 160 points and drawn as a single `<path d>`, animated with a CSS `stroke-dashoffset` reveal (disabled under `prefers-reduced-motion`). Recharts stays for the histogram (`BarChart` with per-bar `Cell` fill) and for the tooltip-bearing band view. This removes per-frame React renders, which is the main cost today.

Hover on the fan shows the same tooltip content as today's cone (year, p90, p50, p10 at that point) from the stats run.

### Readable callouts

One row of four stat tiles above the chart, the same for every mode, so switching modes is a like-for-like comparison:

| Tile | Value | Plain label |
|---|---|---|
| Typical ending | p50 | "Half of paths finished above this" |
| Range | p10 to p90 | "8 in 10 paths finished between these" |
| Chance of loss | `chanceOfLoss` | "Paths that ended below where they started" |
| Worst drop | `maxDrawdown.p90` (with p50 as subtext) | "1 in 10 paths fell at least this far from a high point" |

Reshuffle adjusts two tiles because its endings are identical: "Range" reads "Every order ends at {value}", and "Chance of loss" becomes "Dipped below start" (`everBelowStart`), since the ending is either always a loss or never. The tiles switch from today's p05/p95 ("1 in 20") to p10/p90 ("1 in 10"), which is steadier at 2,000 paths and easier to say. p05/p95 move into the Advanced panel rather than disappearing.

The existing "In 10 years, a typical path ends near" headline, CAGR line and drift-uncertainty note stay above the tiles. Colors for up/down text use the existing `GAIN`/`LOSS` tokens from `lib/chart-colors.ts`, not raw `emerald`/`rose` classes.

### Sensible defaults

- Mode: Resample. Horizon: 10 years (unchanged). Drawn paths: 50 (unchanged). Stats paths: 2,000 (unchanged). Block length: 1 day.
- A first run happens only on "Run simulation", as now. That first run keeps its prepared inputs (return matrix, current prices, weights, μ and L when available, seed base, lookback stats) in a ref. Switching mode after a run reuses them and runs only the new mode, with no history refetch and no new seed. "Run again" and changes to horizon or investment go back through `prepareSimulation` as today.

### Progressive disclosure

Rename "What this simulation used" to **"Advanced and model details"** and keep everything already there. Add:

- Stats paths: 1,000 / 2,000 / 5,000.
- Resample block length: 1 day / 1 week (5) / 1 month (21), with the line "Longer blocks keep calm and stormy stretches together."
- Show p10 to p90 band on paths (toggle).
- Extra percentiles table: p05, p25, p75, p95 ending values.
- The current seed display and "reuse seed" checkbox (unchanged).
- Drift, volatility, observation count, lookback and return basis stay visible for every mode (they are sample statistics). The ridge line shows only for Randomize. Reshuffle and Resample add a note that the past year is repeated to fill the horizon.

### Theme tokens

Add to `app/globals.css`, light and dark, next to the existing chart tokens, and export from `lib/chart-colors.ts`:

- `--mc-reshuffle` (violet), `--mc-resample` (teal), `--mc-randomize` (amber).
- Loss bars reuse `--loss`. The highlighted path uses `--ink` (white in dark, near-black in light).

Check contrast of each against the panel background in both themes (3:1 for marks).

### Copy elsewhere

- `SimulatorExplainer.tsx`: the Monte Carlo card covers all three modes (it already imports `Shuffle`, `GitBranch` and `Binary` icons).
- The disclaimer paragraph under the setup panel: "Each simulated step applies a random daily return using the historical average..." becomes mode-aware.
- Share: pass `scenario: "Monte Carlo median (Resample)"` etc. No change to `PortfolioShareCard.tsx` itself.
- `app/terms/page.tsx` line 36 says Monte Carlo paths "apply geometric Brownian motion"; reword to cover the two historical modes. `components/PurposeSection.tsx` is generic and needs no change.
- `lib/glossary.ts`: add Reshuffle, Resample (bootstrap), Randomize (parametric) entries if the glossary has a Monte Carlo entry to sit beside.

## 3. Performance

Measured cost today is dominated by rendering, not math. Budgets for the worst case (30 years, 10 holdings, 5,000 stats paths):

| Run | Steps x paths | Work per step | Estimate |
|---|---|---|---|
| Drawn, any mode | 7,560 x 100 | n (bootstrap) or n² (GBM) | under 30 ms |
| Stats, Randomize | 360 x 5,000 | n², √k shortcut | about 20 ms |
| Stats, Resample / Reshuffle, default (10 y, 2,000) | 2,520 days x 2,000 | n per day (21 days summed per step) | about 40 ms |
| Stats, Resample / Reshuffle, heaviest (30 y, 5,000) | 7,560 days x 5,000 | same | about 150 to 300 ms |

Steps:

1. Typed arrays for the return matrix, stored day-major (`Float64Array` of `T * n`) so one draw copies a contiguous row. Precompute `exp` is not possible (prices compound), but per-asset log sums per step are, then one `exp` per asset per step instead of per day.
2. Reshuffle and Resample stats paths only need per-step sums, so for Resample with `blockDays = 1` the inner loop is index draw plus n adds.
3. Compute only the active mode. Cache runs by `(mode, seed, horizon, pathCounts, blockDays, inputs hash)` so flipping between tabs is instant after the first visit.
4. Budget: the default case (2,000 stats paths, 10 years, Resample) must stay under 100 ms on the main thread; estimate about 40 ms. The heavy options (5,000 paths, 30 years) can exceed that, so they run behind the existing "Loading" spinner state, yielding once with `await new Promise(requestAnimationFrame)` before the run so the button state paints. Move `simulatePaths` into a Web Worker only if the default case measures over 100 ms. If that happens, read `node_modules/next/dist/docs/` for the current worker bundling guidance first (AGENTS.md: this Next version has breaking changes).
5. Drawn paths are downsampled to at most 160 points each before reaching SVG, so 100 paths is at most 16,000 points in 100 `<path>` elements.

## 4. Tests

`tests/unit/lib/monte-carlo.test.ts` (bun):

- `createRandom`: same seed gives the same sequence; `generateMonteCarloPaths` output for a fixed seed is byte-identical before and after the refactor (snapshot a few values from the current code first).
- Reshuffle: every path's final value equals `initialValue * Π exp(sum of returns)` for single-asset and multi-asset buy-and-hold, to 1e-9 relative; paths differ in the middle; each path is a permutation (sorted step returns match the sorted history); `referencePath` matches the historical order; horizon rounding to a multiple of T is reported.
- Resample: ending values are not all equal; every drawn day is a row of the input (cross-asset rows stay together, checked with two assets whose returns encode the day index); seeded reproducibility; `blockDays = 21` produces runs of 21 consecutive source days; mean of final log value over many paths is close to `numDays * mean(daily log return)`.
- Randomize via `simulatePaths` equals `generateMonteCarloPaths` with the same μ, L and seed.
- `stepDays = 21` for Reshuffle/Resample equals the daily run sampled every 21 days (same seed, same draw order).
- `summarizeOutcomes`: hand-built paths give the expected p10/p50/p90, chance of loss, drawdowns, `everBelowStart`.
- `maxDrawdown`: monotonic path is 0; known peak-to-trough case.
- `returnHistogram`: 0 is a bin edge; counts sum to input length; `loss` is true exactly for bins with `to <= 0`; all-gain and all-loss inputs.
- `medianPathIndex`: returns the index whose final value is the median.
- Validation: ragged return rows, `blockDays` of 0 or above T, empty returns throw `RangeError`.
- A timing guard (skipped unless `MC_BENCH=1`) for the 30-year, 10-asset, 5,000-path Resample stats run.

`tests/unit/components/MonteCarloSimulator.test.tsx`:

- Default mode is Resample and its one-liner is visible.
- Switching to Reshuffle after a run shows "Every order ends at" and "Dipped below start"; switching to Randomize renders the histogram with at least one loss-colored bar when a loss bin exists.
- Callout tiles show p10/p50/p90, chance of loss and worst drop for each mode.
- "Compare all three" renders three labeled panels.
- A covariance that fails Cholesky still lets Resample and Reshuffle run, and marks Randomize unavailable.
- Switching mode after a run does not refetch `/api/market/chart` and keeps the seed base.
- Advanced panel: block length and stats path controls exist and change the next run; seed reuse still reproduces the same paths per mode.
- Existing tests keep passing (history checks, FX, return basis), with text assertions updated from "1 in 20" to "1 in 10" where needed.
- No em dash in the rendered copy (scan the container text for U+2014).

`tests/unit/components/WealthProjector.test.tsx`: unchanged unless it asserts simulator copy.

## 5. Order of work

1. Engine: extract RNG, add `simulatePaths`, summary helpers, tests. Ship-able on its own; the UI still calls Randomize.
2. Theme tokens and `PathFan` + histogram components.
3. Simulator: mode switcher, callout tiles, Advanced panel, mode-aware copy.
4. Compare-all-three view.
5. Explainer, glossary, share label. Measure performance; add a worker only if step 4 of Performance says so.

## Not in scope

- Longer daily lookback (the Lab's `lib/lab/bars.ts` has multi-year daily bars and could replace the 1Y fetch later; it would make Reshuffle and Resample much richer, but changes the data path and its tests).
- Fat-tailed parametric draws (Student-t) for Randomize.
- Contributions, withdrawals, rebalancing, fees, taxes (still excluded, as today).
