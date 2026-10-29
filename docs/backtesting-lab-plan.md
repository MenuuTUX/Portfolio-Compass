# Compass Lab: plan for an advanced backtesting workspace

Status: proposal, not started. Date: 2026-10-28.

Compass Lab is a separate, opt-in side of Portfolio Compass for advanced users. In it they write strategies in code (or define allocation rules without code) and test them on their own portfolios and on any equity or ETF universe. It stays an educational research tool, like the rest of the site. It never places trades, connects to a broker, or runs live.

---

## 1. What advanced users code on today

| Tool | What people write | Why they use it | What they complain about |
| --- | --- | --- | --- |
| QuantConnect (LEAN) | Python or C#, event-driven algorithms, plus Jupyter research notebooks | Full portfolio modeling, multi-asset, open-source engine that can also run locally | Steep learning curve, tight free tier, IDE is "not polished", debugging is hard, notebook features are limited |
| TradingView (Pine Script) | Pine Script, a proprietary DSL, single-symbol strategies on a chart | Huge retail user base, the chart is the IDE | Weeks to learn for non-programmers, imprecise fills, weak at portfolio-level testing |
| vectorbt, NautilusTrader, Backtrader, Zipline | Python with pandas and numpy, run locally | Fast vectorized research (vectorbt), full control, free | No hosted workspace, people have to manage their own data and environment |
| Portfolio Visualizer | No code: allocation, rebalance schedule, cash flows, timing models (moving average, momentum, target volatility) | The standard way to "backtest my portfolio" | Form-based, can't express custom logic |
| Composer | No code: visual "symphonies" with if/then blocks, weighting, rebalancing | Logic without code, community strategies to copy | Locked to its own DSL and broker |

What this means for Compass Lab:

1. **Python is the language people already use.** pandas and numpy are standard in research. A Python editor matters more than any custom DSL.
2. **Portfolio-level testing is the gap.** Pine is per-symbol. Portfolio Visualizer is no-code only. QuantConnect does portfolios but asks a lot of setup. A strategy that is "my holdings plus a rule" is the opening for Compass Lab, since the site already knows the user's portfolio.
3. **The notebook and IDE experience is a known pain point** for QuantConnect. A fast, integrated editor plus a results workspace is a real advantage.
4. **Two tiers.** A code tier (Python, plus a TypeScript fast path) and a no-code allocation tier that covers the Portfolio Visualizer jobs. Both feed the same engine.

---

## 2. Constraints from the current codebase

These constraints shape the design. Each one is real today.

| Constraint | Where | Effect on the Lab |
| --- | --- | --- |
| History uses `close`, not `adjclose` | `lib/math/portfolio-returns.ts` header comment, `lib/fast-market.ts` | Phase 0 found Yahoo's `close` is already split-adjusted but not dividend-adjusted, so current returns are price returns that miss dividends. The Lab must use `adjclose` plus dividend events. |
| Daily bars only reach 1Y. 5Y is weekly and MAX is monthly | `RANGE_CONFIG` in `lib/fast-market.ts` | Long daily backtests need a new date-range endpoint. |
| 60-ticker cap per request | `parseTickers(..., 60)` in `app/api/market/chart/route.ts` | Universe tests have to batch. |
| 120 req/min per IP, in memory | `proxy.ts` | The client needs a local cache and must batch requests. |
| `maxDuration = 30` on the chart route | `app/api/market/chart/route.ts` | Long ranges for many tickers must be chunked. |
| 2000-entry in-memory server cache | `lib/fast-market.ts` | Not enough for history. The real cache has to live on the client. |
| Portfolio lives in localStorage | `lib/storage.ts` | localStorage holds a few MB. Price history needs IndexedDB. |
| S&P list is current constituents only (71 lines) | `config/sp500-heatmap.ts` | Universe backtests on it have survivorship bias. The UI must say so. |
| No login, no server database | README | "Advanced only" cannot mean an account tier without changing the architecture. See section 3. |
| The site does not place trades | DESIGN.md | No broker, no live or paper trading. |

Parts that can be reused directly:

- `alignPriceHistories` and `hasDailyObservationCoverage` in `lib/math/history.ts` (calendar-date alignment, gap checks)
- `convertPriceHistoryToCad` in `lib/math/fx-history.ts` and `/api/market/fx-history` (dated FX for mixed-currency portfolios)
- `estimateAnnualCovariance` in `lib/math/covariance.ts` and `calculatePortfolioHistoricalStats` in `lib/math/portfolio-stats.ts`
- Whole-share logic in `lib/optimizer.ts`
- `PaneResizer`, `AssetChart`, `Shimmer` in `components/workspace/`, plus `CommandPalette`
- The DESIGN.md "app" register: `#0d0d0d` page, `.ws-panel`, three panels, status bar, OpenAI Sans only, color used only for gain, loss and links

---

## 3. Gating "advanced users only"

There are two options. **This decision belongs to the product owner.**

**A. Separate route plus a local opt-in (recommended).** The Lab lives at its own route (for example `/lab`). On first visit it shows one screen: what the Lab is, that results are hypothetical, and that it assumes the user can read code. The user ticks an acknowledgment, which is stored locally. The main site links to it only from Settings and the command palette, never from the landing page. This keeps the local-first promise and needs no backend.

**B. Accounts.** Needed only for cloud-saved strategies, sharing, or server compute. This adds a database, auth, and privacy work, and breaks the "no login" promise in the README and `/privacy`. Defer it until there is evidence of demand.

**Decision (2026-10-29): A.** The rest of this plan assumes it.

---

## 4. Architecture

```
┌────────────────────────── Browser (all user code runs here) ───────────────────────────┐
│                                                                                       │
│  Lab UI (React)  ──run──▶  Engine worker (TypeScript, trusted)                         │
│   editor, results,          ├─ data loader  ◀── IndexedDB bar cache ◀── /api/market/bars │
│   params, console           ├─ strategy host                                          │
│                             │    ├─ TS strategies: run inside a sandboxed worker       │
│                             │    └─ Python strategies: Pyodide worker                  │
│                             ├─ simulator: fills, costs, cash, dividends, rebalances    │
│                             └─ metrics + reports                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
Server: only proxies market data, as it does today. It never executes user code.
```

### 4.1 Key decision: the engine is trusted TypeScript, and user code only returns weights

User code never touches cash, fills or metrics. It receives data and returns **target weights** (or signals that map to weights). The TypeScript engine does everything else. This gives:

- One engine, one set of `bun test` cases, the same numbers for Python, TypeScript and no-code strategies.
- No lookahead by construction. The engine gives the strategy only bars up to `t` and fills at `t+1`.
- Cheap Python. The strategy is **vectorized**: a prices frame goes in once and a weights frame comes out once. That avoids crossing the JS/Python boundary on every bar, which is the main cost of Pyodide.

An optional event mode (`on_bar`) can come later for path-dependent logic like stop-losses, with a clear warning that it is slower.

### 4.2 Strategy contract

Python:

```python
import pandas as pd

PARAMS = {"lookback": 126, "top_n": 3}

def weights(prices: pd.DataFrame, ctx) -> pd.DataFrame:
    """prices: adjusted closes, index = dates, columns = tickers.
    Return target weights with the same index. Rows may sum to < 1 (rest is cash).
    The engine fills each row at the NEXT bar's open."""
    mom = prices.pct_change(ctx.params["lookback"])
    rank = mom.rank(axis=1, ascending=False)
    w = (rank <= ctx.params["top_n"]).astype(float)
    return w.div(w.sum(axis=1), axis=0).fillna(0)
```

TypeScript (fast path, no Pyodide download):

```ts
export const params = { lookback: 126, topN: 3 };

export function weights(prices: Frame, ctx: Ctx): Frame {
  const mom = prices.pctChange(ctx.params.lookback);
  return mom.rankRows("desc").map((r) => (r <= ctx.params.topN ? 1 : 0)).normalizeRows();
}
```

`ctx` exposes `params`, `portfolio` (the user's current holdings and weights from localStorage), `benchmark`, `calendar`, `dividends`, and a small indicator library (SMA, EMA, RSI, ATR, rolling volatility, z-score). Pyodide gets a matching `compass` Python module so the API is the same in both languages.

No-code tier: a form (allocation table, rebalance schedule, threshold bands, cash flows, and a few timing rules: moving-average filter, momentum rotation, target volatility). It compiles to the same `weights` function. A "View as code" button opens the generated Python so users can graduate to the code tier.

### 4.3 Simulator rules (the engine's job)

- **Adjusted data**: split-adjusted prices plus dated dividend events. Dividends are paid as cash on the ex-date, then reinvested or held as a toggle.
- **Fills**: at the next bar's open by default, or next close. Never at the same bar the signal used.
- **Costs**: commission per trade or bps, slippage in bps or a fraction of the bar's range, and an optional minimum ticket.
- **Shares**: fractional or whole shares. Cash is a plain float (see Phase 2 status for why not `decimal.js`).
- **Rebalancing**: on calendar (D/W/M/Q/Y), on drift bands, or whenever weights change.
- **Cash flows**: periodic contributions and withdrawals, which matter for "my portfolio" tests.
- **Currency**: convert to the base currency with dated FX (reuse `fx-history`). If FX is missing, refuse to run. Don't guess, following the rule the site already uses for totals.
- **Missing data**: a ticker before its first bar is not tradable. It never gets a zero price, matching the DESIGN.md rule that a missing quote never becomes a zero.
- **Reproducibility**: each run stores a hash of the code, the params, the data snapshot (tickers, range, last bar date, source), and the engine version. Rerunning the same hash must give identical numbers.

### 4.4 Metrics and reports

- Equity curve against a benchmark (default SPY or the user's current portfolio held without changes), on a log scale toggle
- Underwater drawdown chart, the longest drawdown, and time to recover
- CAGR, volatility, Sharpe, Sortino, Calmar, max drawdown, beta and alpha against the benchmark, hit rate, turnover, total costs paid
- Monthly returns heatmap and rolling 12-month return and Sharpe
- Holdings over time (stacked area of weights) and exposure
- Trade log (CSV export) and dividends received
- Run comparison: overlay up to 5 runs, with a diff of their params

### 4.5 Overfitting guardrails

Advanced users run sweeps. The Lab should make the honest result easy to see.

- **In-sample and out-of-sample split** by default. The last 30% is held out and drawn as a shaded region. Metrics are shown for each part.
- **Walk-forward** mode: rolling train and test windows.
- **Parameter sweep** grid with a heatmap of the result. The UI shows how many combinations were tried, and a deflated Sharpe or a simple "best of N" warning.
- **Bias notes on every report**: survivorship (if the universe came from today's list), data source and adjustment method, and "hypothetical results, not advice".

---

## 5. The workspace (UI)

Same visual system as the app register in DESIGN.md. Desktop layout:

```
┌ Top bar: strategy name · language (Py/TS/No-code) · data range · benchmark · [Run ⌘↵] ┐
├───────────────┬──────────────────────────────────────┬────────────────────────────────┤
│ Explorer      │ Editor (Monaco)                       │ Results                         │
│  Strategies   │  strategy.py / strategy.ts            │  tabs: Overview · Equity ·      │
│  Templates    │  inline errors, autocomplete for ctx  │  Drawdown · Trades · Holdings · │
│  Universes    │                                       │  Monthly · Sweep · Compare      │
│  Runs history ├──────────────────────────────────────┤                                 │
│               │ Console · Params · Data inspector     │                                 │
└───────────────┴──────────────────────────────────────┴────────────────────────────────┘
 Status bar: engine ready · Pyodide loaded · cache 412 MB · last run 1.8 s · data as of …
```

- Panes resize with the existing `PaneResizer`. Layout and open tabs persist locally.
- **Params panel** is generated from `PARAMS`. Sliders and number fields rerun on change when the run takes under 1 s.
- **Data inspector** shows the exact adjusted frame the strategy received, so users can check the input.
- **Console** captures `print` and `console.log` plus Python tracebacks mapped to editor lines.
- **Command palette** (reuse `CommandPalette`): run, sweep, new from template, switch universe, export.
- **Keyboard first**: run, rerun last, toggle panes, jump to error.
- **Mobile**: read-only results view. Editing code on a phone is out of scope.
- **Templates** to start from: 60/40 with rebalance bands, my portfolio vs SPY, dual momentum, SMA trend filter, risk parity, target volatility, sector rotation, dividend reinvest vs cash.

Strategies and runs are stored in IndexedDB. Import and export use `.py` / `.ts` plus a JSON manifest, the same way the site already backs up portfolios.

Monaco, Pyodide and the engine load **only on the Lab route**. The main site bundle does not change.

---

## 6. Data plan

1. **New endpoint** `/api/market/bars?tickers=…&start=YYYY-MM-DD&end=YYYY-MM-DD&interval=1d`
   - Returns OHLCV, adjusted close, and dividend and split events (`yf.chart(..., { interval: "1d", events: "div|split" })`).
   - Yahoo's `open` is split-adjusted only. Next-open fills must use `open * adjclose / close` so fills and marks are on the same basis.
   - Accepts explicit dates instead of `ChartRange`, so `/api/market/chart` is not changed.
   - Chunked to fit `maxDuration` and the per-request ticker cap. Long immutable ranges get long cache headers, since past bars don't change.
2. **Client cache in IndexedDB**, keyed by ticker and date. Only missing ranges are fetched. Refresh logic stays within the 120 req/min limit.
3. **Source stamp** on every dataset (provider, adjustment method, fetched at). This feeds the run hash and the report footer.
4. **Universes**: the user's portfolio, a hand-entered ticker list, CSV upload, and the S&P heatmap list with a survivorship warning. Point-in-time index membership is a later item and needs a dataset the project does not have today.
5. **User data upload**: a CSV of their own bars, for users with better data.

---

## 7. Phases

Each phase ends in something that can be shipped and tested.

**Phase 0: Spike (about 1 week).** Measure, don't assume.
- Pyodide cold start and warm start with pandas on desktop and mid-range laptops, and one 20-ticker, 15-year daily momentum backtest in Pyodide against the same in TypeScript.
- Check that the data provider returns adjusted closes and dividend events for the needed history.
- Before writing any route, layout or route-group code, read the relevant guide in `node_modules/next/dist/docs/` as AGENTS.md requires. This Next.js version differs from older ones.
- Exit criteria: numbers recorded in this file, go or no-go on Python in v1.

**Phase 0 results (2026-10-29).** Done. Measured on this Mac in the Claude desktop app's built-in browser (Chromium), Pyodide 0.29.0 from jsDelivr. Test: 20 ETFs, 4,231 daily bars each (2010-01-04 to 2026-10-28), monthly top-3 momentum, next-open fills, 5 bps costs. The spike page and data are scratch files, not committed.

| Step | Cold (first visit) | Warm (browser cache) |
| --- | --- | --- |
| Yahoo daily history, 1 ticker, 16 years, with div/split events (server side, Bun) | 234 ms | |
| Same, 20 tickers in parallel | about 0.7 to 0.8 s | |
| Pyodide boot | 1.1 s | 0.6 s |
| Load numpy + pandas packages | 1.4 s | 0.3 to 0.4 s |
| `import pandas` plus the frame copy | 1.4 s (measured together) | 1.3 s |
| Copy the 20 x 4,231 price frame from JS into pandas | | 4 ms |
| Python `weights()` plus copying the result back to JS | 16 ms | 5 to 8 ms |
| TS engine simulation of one run | 1.9 ms | 1.2 ms |
| Same strategy written in JS, weights only | 1.7 ms | 0.6 ms |
| 50-combination parameter sweep, Python weights + TS engine | 203 ms | 190 to 213 ms |
| 50-combination sweep, all JS | 34 ms | 33 ms |
| **Page open to first Python result** | **3.9 s** | **2.2 to 2.4 s** |
| Pyodide + numpy + pandas download size | about 14 MB compressed, once | 0 |

Findings:

1. **The vectorized contract works.** The Python and JS strategies produced the same final equity to the dollar (3,321,649 from 1,000,000), so a pandas `weights()` function plus the TS engine is exact.
2. **Python's cost is startup, not compute.** After boot, a full 16-year backtest in Python takes milliseconds, and a 50-run sweep takes about 0.2 s. Boot is 2 to 4 s and mostly `import pandas`.
3. **Data copying is not a problem** (4 ms) as long as data crosses the boundary once per run, which the vectorized contract guarantees.
4. **Yahoo provides everything Phase 1 needs**: adjusted close, dividends (split-adjusted amounts), and split events for 16+ years of daily bars, quickly.
5. **Next.js (read from `node_modules/next/dist/docs/`)**: the Lab can be a plain `app/lab/` segment under the existing root layout, so it keeps fonts, theme and tokens. Route groups with a second root layout would force a full page reload when moving between the site and the Lab, so they're not needed. Monaco and the engine load with `next/dynamic` and `ssr: false`, which must be called from a Client Component. Turbopack supports `new Worker(new URL(...))` with magic comments, which covers the engine worker.

**Decision: go on Python in v1**, with these mitigations:
- Start booting Pyodide in a worker as soon as the Lab opens, before the user clicks Run, so the 2 to 4 s is hidden while they read or edit.
- Run TypeScript and no-code strategies without Pyodide at all. Python loads only when a Python file is opened.
- Show boot progress in the status bar ("Python loading 60%").
- Not measured yet: a mid-range Windows laptop and Safari. Check both before Phase 4 ships.

**Phase 1: Data foundation.**
- `/api/market/bars`, adjusted prices, dividend and split events, IndexedDB cache, source stamps.
- Unit tests with fixtures for a split, a dividend, a missing day, and mixed currencies.

**Phase 1 status (2026-10-29): built, not committed.** Revised in Phase 4 for cost: see "Data layer revision" under Phase 4. The range API and tail-merge cache described below were replaced.

| File | What it does |
| --- | --- |
| `lib/lab/bar-types.ts` | `DailyBar`, `BarSeries`, dividend and split events, source stamp, `MAX_BAR_TICKERS` (20), `isPastRange`. No server imports, so the browser can use it. |
| `lib/lab/yahoo-bars.ts` | `mapChartResult`: Yahoo chart() to `BarSeries`. Dates use the exchange's own clock. Rows with missing prices are dropped, never zeroed. A repeated session keeps the later row. |
| `lib/lab/bars.ts` | Server fetcher: `yf.chart` with `interval: "1d"` and `events: "div|split"`, 4 tickers at a time, in-memory cache (1 h for past ranges, 5 min for recent). |
| `app/api/market/bars/route.ts` | `GET /api/market/bars?tickers=&start=&end=`. Validates dates, caps at 20 tickers, lists failed tickers in `missing`. |
| `lib/lab/bar-cache.ts` | `loadBars()` with an IndexedDB store (`compass-lab` / `bars`) and an in-memory store for tests. Splits universes into requests of 20. |
| `tests/fixtures/yahoo-chart-daily.json` | Recorded Yahoo responses: AAPL around the 2020 split and dividend, XIC.TO (CAD), BHP.AX (Sydney). |
| `tests/unit/lib/lab-bars.test.ts`, `lab-bar-cache.test.ts`, `tests/unit/api/market-bars.test.ts` | 21 tests. Full suite: 305 pass. |

What came up while building it:

1. **Yahoo re-adjusts history.** Every new dividend changes all earlier `adjClose` values, and every split changes `close`. So the cache can't treat old bars as permanent. `loadBars` refetches from the last cached bar. If that overlapping bar has changed, it refetches the ticker's whole history (about 0.2 s per ticker). A last bar from the past two days is always refreshed, because it may be a live session.
2. **Dates have to use the exchange's clock.** Yahoo stamps Sydney sessions at 23:00 UTC the day before, so a UTC date would put BHP.AX trades on Sundays. The mapper applies Yahoo's `gmtoffset`.
3. **Payload size.** A live call for 4 tickers over 2010 to 2026 returned about 2.8 MB of JSON before compression, so 20 tickers is about 14 MB. That's acceptable with gzip and the browser cache, but a columnar format (arrays per field instead of an object per bar) would cut it a lot. Do this if load times show it matters.
4. **FX is the next blocker for mixed currencies.** Bars carry their currency (USD, CAD and AUD verified live), but `/api/market/fx-history` only allows 2-year windows and only USD/CAD. Phase 2 needs longer FX history before it can run multi-currency portfolios.
5. **Not verified yet:** the IndexedDB store itself. Its logic is tested with the in-memory store, but the IndexedDB adapter first runs in a browser in Phase 3.

**Phase 2: Engine (TypeScript, in a worker).**
- Simulator from section 4.3, metrics from 4.4, reproducible run hash.
- Golden tests: buy-and-hold SPY should match the provider's adjusted total return within a tolerance. A 60/40 monthly rebalance should match a hand-checked spreadsheet.

**Phase 2 status (2026-10-29): built, not committed.**

| File | What it does |
| --- | --- |
| `lib/lab/engine/frame.ts` | Aligns all tickers on the union of trading dates. Missing bars stay NaN (not tradable, valued at the last close). Converts prices and dividends to the base currency at dated FX rates, and refuses to run without them. |
| `lib/lab/engine/simulate.ts` | The simulator: targets at bar t fill at t+1 (open or close). Slippage and commission with a minimum. Fractional or whole shares. Dividends as cash on the ex-date, reinvested or held. Rebalancing on change, on a calendar (W/M/Q/Y), or past a drift band. Monthly, quarterly or yearly contributions and withdrawals. Rejects shorts and leverage, and treats NaN weights as 0 with a warning. |
| `lib/lab/engine/metrics.ts` | Time-weighted returns (a flow joins the base on the day it arrives, since the simulator invests it that day), CAGR, volatility, Sharpe, Sortino, Calmar, max and longest drawdown with recovery date, beta and alpha against the benchmark, monthly returns, turnover, costs and dividends. |
| `lib/lab/engine/run-hash.ts` | SHA-256 over engine version, settings, strategy, and the exact price arrays used. |
| `lib/lab/engine/backtest.ts` | `runBacktest()`: frame, simulation, optional buy-and-hold benchmark, metrics, hash. Takes a weight matrix or a fixed allocation. |
| `lib/lab/engine/worker.ts` | Web Worker entry that runs `runBacktest` off the main thread. |
| `tests/unit/lib/lab-engine.test.ts` + `tests/fixtures/lab-spy-agg-2023-2024.json` | 19 tests: 11 hand-computed cases (including a contribution and a withdrawal on a day the price moves, and a drift band that actually fires), 3 currency, 3 metrics, 3 golden runs on recorded SPY and AGG. Full suite: 324 pass. |

Golden results:

- **Buy-and-hold SPY, 2023-2024, dividends reinvested:** the engine's return matches Yahoo's adjusted-close return within **0.006%**.
- **Monthly 60/40 SPY/AGG** matches an independent adjusted-close reference in the test within **0.004%**, with the reference rebalancing on the same bar as the engine. Both golden tests fail above 0.05%.
- **Speed:** 50 full runs of the 2-ticker, 2-year 60/40 with benchmark took 29 ms in Bun, so sweeps are cheap.

Decisions and caveats:

1. **No `decimal.js`.** It would slow parameter sweeps a lot, and float error is far below the cent-level noise in the price data. The golden tests above are the guard.
2. **Strategies should use returns, not price levels.** `adjClose` is adjusted backward from today, so its level at a past date depends on dividends paid later. Ratios such as momentum and moving-average crossovers are unaffected. A rule like "price above $100" would leak future information. The strategy docs in Phase 4 must say this.
3. **Dividend timing.** Dividends are credited on the ex-date (not the pay date) and reinvested at that day's fill. This is the convention adjusted closes assume.
4. **Whole shares are in today's share units**, because prices are split-adjusted. Before a split, whole-share rounding is slightly coarser than it really was.
5. **Not verified yet:** the worker file has typechecked but has not run in a browser. It runs for the first time when the Lab page loads in Phase 3.
6. **Still open from Phase 1:** long-range FX history. The engine supports dated FX, but `/api/market/fx-history` only serves USD/CAD over 2 years.

**Phase 3: Lab shell plus no-code tier.**
- Lab route, opt-in screen, three-pane workspace, results tabs, run history, compare.
- The no-code allocation form (covers the Portfolio Visualizer jobs) and "my portfolio vs benchmark" as a one-click template.

**Phase 3 status (2026-10-29): built, not committed.**

| File | What it does |
| --- | --- |
| `app/lab/page.tsx` | The `/lab` route, `noindex`. A plain segment under the root layout, so fonts and theme carry over. |
| `components/lab/LabApp.tsx` | Opt-in screen (stored as `pc:lab-ack:v1`), then the workspace. Desktop: strategy, results and metrics panes, resizable with `PaneResizer`. Below 1024 px: one pane at a time with labelled tabs. Status bar, ⌘/Ctrl+↵ to run, and a draft saved in `pc:lab-form:v1`. |
| `components/lab/StrategyPanel.tsx` | The no-code form: templates, "My portfolio", rule (fixed mix, trend filter, momentum), tickers and weights with a running total, period, benchmark, rebalancing, contributions, costs, fills, shares, dividends. |
| `components/lab/ResultsPanel.tsx` | Tabs: Overview (growth vs benchmark, log toggle, headline numbers), Drawdown, Monthly table, Holdings, Trades (newest 500, full CSV export), Compare (up to 5 runs as time-weighted growth of 1). |
| `components/lab/RunsPanel.tsx` | Metrics against the benchmark, engine warnings, this session's runs with compare checkboxes, and data and bias notes with the run hash. |
| `components/lab/LabChart.tsx` | SVG line chart in the style of `AssetChart`: lines differ by dash pattern and direct labels, not color. Hover readout and a text summary for screen readers. |
| `components/lab/useLabEngine.ts` | Loads bars through the IndexedDB cache and runs the engine in the Web Worker. |
| `lib/lab/no-code.ts` | Fixed, trend-filter and momentum rules compiled to weight matrices inside the worker. |
| `lib/lab/lab-form.ts` | Form model, the four templates, portfolio import, plain-language validation, and conversion to an engine request. |
| `components/SettingsDrawer.tsx` | New "Compass Lab" section with "Open the Lab" and "Delete Lab data". |
| `app/privacy/page.tsx`, `app/terms/page.tsx` | Lab storage listed on /privacy, and a Lab section in /terms. |
| `tests/unit/lib/lab-no-code.test.ts` | 9 tests for the rules, the form and portfolio import. Full suite: 333 pass. |

Checked in the browser (Claude desktop's built-in browser, dev server):

- Opt-in gate, then 60/40 and dual momentum over 2010 to 2026. The engine took 23 to 29 ms in the worker for 4,231 days. 60/40 came out at CAGR +9.7% and max drawdown −21.7%, against SPY's +14.1% and −33.7%.
- Every results tab and comparing two runs. CSV export was checked by capturing the downloaded file in the page: 268 rows for 268 trades, with the expected header.
- **The IndexedDB cache, unverified until now**, holds 16 years per ticker, and later runs fetch only the last bar (`start=2026-10-28`).
- Errors read in plain words: an unknown ticker, a CAD-listed fund, leverage, and bad dates.
- The phone layout at 375 px, and the Settings link.
- **Production build** (`bun run build`, then `next start`): it builds clean, with `/lab` static and `/api/market/bars` dynamic. In production the worker loads as its own chunk, and a trend-filter run over 2010 to 2026 took 19 ms.
- **"My portfolio"** with two seeded holdings that had share counts but no target weights (10 VTI, 40 BND). It imported value weights of 57.11% / 42.89% from the latest close and said so. The stored `weight` field is a user-set target that defaults to 0, so import follows the Portfolio tab's priority: value from shares × latest close, then target weights, then equal weights. The panel says which one it used, and an empty portfolio shows a message instead of doing nothing.
- **Settings → Delete Lab data** removed both keys and the `compass-lab` database.

Found and fixed while testing:

1. **Native form validation blocked Run.** `min=1 step=1000` made 10,000 an "invalid" amount. The form now uses `noValidate` and relies on its own checks.
2. **Two layouts rendered at once** (desktop and mobile, one hidden), which duplicated form ids. Only one now renders, chosen with the same `useIsLg` pattern TrendingTab uses.
3. Float dust showed as "−$0.00", and the drawdown axis padded above 0%. Both are fixed.
4. **A worker crash would have hung the UI.** Runs waited for a reply that never came. `onerror` and `onmessageerror` now fail every pending run with a plain message.
5. **Privacy and terms.** `/privacy` lists the two Lab keys and the `compass-lab` IndexedDB cache. `/terms` has a "Compass Lab backtests" section. Settings has "Delete Lab data", separate from "Clear portfolio" so clearing holdings doesn't wipe a strategy draft.

Scope notes:

- **Mixed currencies are blocked in the UI** with a plain message, because there's no long-range FX history yet. The engine itself already converts.
- **Run history lasts only for the session.** Runs hold full arrays, and persisting them needs a second IndexedDB store, which can come with Phase 4's saved strategies.
- **No command-palette entry.** `components/CommandPalette.tsx` isn't mounted anywhere in the app, so Settings is the only way in.
- **Not related to the Lab:** while testing, the dev server logged an existing Zod failure in ETF live search (`lib/fast-market.ts:814`, quotes without `symbol`). The main market view also hit 429s from the shared 120 req/min limit.

**Phase 4: Code tier.**
- Monaco editor, TypeScript strategies in a sandboxed worker, then Python through Pyodide with the `compass` module.
- Params panel, console, traceback mapping, templates.

**Phase 4 status (2026-10-29): built, not committed.** Includes a performance pass for Vercel's Hobby plan, which the user asked for mid-phase.

*Data layer revision (cost).* Phase 1 sent a date-range request per run. Measured, a cold 20-ticker run from 2010 returned 14 MB of JSON (2.5 MB gzipped). That was never cached at Vercel's CDN, because the route sent only `max-age`, and Vercel caches a function response only with `s-maxage` or `CDN-Cache-Control`. That design would have spent the Hobby plan's 10 GB of origin transfer within a few thousand runs. It is now:

| Before | Now |
| --- | --- |
| `?tickers=…&start=…&end=…`: any dates, so every URL was a cache miss | `?ticker=SPY&through=2026-10-28`: one URL per ticker per day, the same for every user |
| Objects per bar, OHLCV | Columns (`d`, `o`, `c`, `a`, dividends, splits), 8 significant digits: SPY's full history (8,495 bars since 1993) is 329 KB raw, about 100 KB gzipped |
| Includes the live session | Completed sessions only (`lastCompletedSession`: 18:00 New York time, handles daylight saving and weekends); the status bar shows "Data through" |
| `Cache-Control: public, max-age=3600` (browser only) | `Vercel-CDN-Cache-Control: max-age=86400, stale-while-revalidate=86400`, or 1,800 s when a history stops short of `through` |
| Unknown ticker: 502 | 404, cached for an hour; real upstream failures stay 502 and `no-store` |
| Any `through` date | Only the current or previous session; anything else is a 400 with `no-store`, which bounds cache entries per ticker |
| Client: tail fetch plus overlap check on every run | Client: a record built for the current session is reused with **zero requests**; otherwise the whole history is refetched and replaces the record. 6 requests in flight at most, one retry after a 429, falls back to the previous session's copy if the server fails |

Rounding to 8 significant digits moves the 60/40 golden result by less than 1e-6 (tested). Universes are capped at 50 tickers so a cold load stays inside the 120 requests per minute API limit.

*Cost model against Hobby limits* (per month: 10 GB Fast Origin Transfer, 100 GB Fast Data Transfer, 1M CDN requests, 1M function invocations, 4 hours Active CPU). Vercel does not say whether origin transfer counts compressed bytes, so this assumes the worst case, raw bytes.

| Resource | What drives it now | Rough headroom |
| --- | --- | --- |
| Fast Origin Transfer (10 GB) | CDN misses only: about 1 per ticker per CDN region per day, ~250–330 KB raw each | 100 distinct tickers × 3 regions × 30 days × 0.3 MB ≈ 2.7 GB raw (under 1 GB if compressed) |
| Fast Data Transfer (100 GB) | A user's first run of the day per ticker, ~75–100 KB gzipped each; repeat runs cost nothing | ~50,000 cold 20-ticker loads a month |
| Function invocations (1M) | CDN misses, plus `proxy.ts`, which runs on every `/api` request including CDN hits | ~50,000 cold 20-ticker loads a month |
| Active CPU (4 h) | Yahoo parsing on misses; the backtest itself runs in the user's browser | Misses are bounded per ticker per day, not per user |
| Monaco (~935 KB) and Pyodide (~14 MB) | Served by jsDelivr | **0 bytes** from Vercel |

*Measured in the browser:*

| Check | Result |
| --- | --- |
| Cold 20-ETF momentum run, 33 years | 20 price requests; no main-thread long tasks; engine ~220 ms in its worker |
| Same run again | **0 requests** ("Prices from browser cache"), same hash |
| `/lab` first load, no-code (production build) | 267 KB compressed JS from this site, 0 from CDNs; no sucrase, Monaco or Pyodide |
| Switching to code mode | +7 KB from this site; Monaco ~935 KB from jsDelivr |
| TypeScript worker chunk (sucrase + runner) | 52 KB gzipped, loaded only when a TS strategy runs |
| Python worker chunk | 3 KB gzipped; Pyodide from jsDelivr on first use |
| Python boot (Pyodide + numpy + pandas) | **3.9 s from page load to "Python ready"** (about 2.7 s of boot), measured with the page visible, in line with Phase 0. An earlier 10.7 s reading was taken with the Browser pane hidden, where Chromium throttles background pages. |
| `import scipy` | Loads on demand from the Pyodide CDN (scipy 1.14.1); the first run with it took 4.5 s including that download |
| Python run after boot | 0.6 s end to end; `weights()` 25–200 ms |
| Phone layout | Plain textarea, no Monaco, no jsDelivr requests; Python downloads only when run |

*Not verified locally:* real CDN hits (`x-vercel-cache: HIT`). That needs a deployment.

*Code tier.*

| File | What it does |
| --- | --- |
| `lib/lab/strategy/ts-runner.ts`, `ts-worker.ts` | TypeScript strategies: `sucrase` strips types without moving lines, so errors map to editor lines. Imports are refused. Runs in its own worker with network APIs removed (a guard, not a security boundary). |
| `lib/lab/strategy/py-worker.ts`, `python.ts` | Python strategies in Pyodide 0.29.0 from jsDelivr, loaded on first use. `import compass` gives `returns`, `sma`, `ema`, `stdev`, `rsi`, `top_n`, `inverse_vol`. Other Pyodide packages such as scipy load on import, from the same CDN only. Tracebacks map to `strategy.py` lines. |
| `lib/lab/strategy/weights.ts` | Accepts a DataFrame, an ndarray, rows, row objects, columns or a flat matrix; NaN means no position. **Lookahead check:** reruns the strategy with history cut at 60% and 85%, and flags it if any earlier weight changes. |
| `lib/lab/strategy/indicators.ts` | `ctx` helpers for TypeScript, matching the Python ones. |
| `lib/lab/strategy/templates.ts` | Three starters in both languages (sector momentum, inverse volatility, moving-average crossover), and **View as code** for every no-code rule. |
| `lib/lab/strategy/client.ts` | One worker per language, created on first use. A 30 s limit (120 s for Python's first load) kills runaway code, and the next run starts fresh. |
| `lib/lab/strategies.ts`, `lib/lab/db.ts` | Saved strategies in IndexedDB (database version 2 adds the store), with .py/.ts import and export. |
| `components/lab/CodeEditor.tsx`, `CodePane.tsx`, `CodeSettings.tsx` | Monaco 0.52.2 with autocomplete for `Prices` and `Context`, error markers, and ⌘↵. A console with output, errors and the lookahead verdict. Language, templates, saved strategies, and a params panel read from the code. |
| `lib/lab/engine/backtest.ts` | `alignWeights`: a strategy sees only its universe (not the benchmark), and its weights are mapped onto the engine's frame by date and ticker. |
| Tests | `lab-strategy.test.ts` (17), rewritten `lab-bars`, `lab-bar-cache` and `market-bars` tests, plus a rounding golden test. Full suite: 356 pass. |

*Checked in the browser:*

- **TypeScript and Python versions of the same template ended at the same value**, $70,323.
- **No-code dual momentum, its generated Python and its generated TypeScript** all ended at $36,178.
- A Python `KeyError` was marked on line 5, after the `print()` output.
- A strategy using `prices.shift(-1)` was flagged as reading the future.
- Save, reload, reopen, export, and import of a .py file all work.

*Found and fixed while testing (some from review):*

1. "View as code" overwrote the no-code rule's tickers. Code mode now has its own `universe`.
*Still session-only:* run history. Phase 3 suggested persisting runs alongside saved strategies; this phase saved strategies only. Runs hold full arrays, so persisting them needs its own store and a size cap.
2. The engine frame included the benchmark, so a strategy would have ranked it. Strategies now see only their universe.
3. Repeated conversions named a strategy "X (code) (code)".
4. **Worker sandboxes were incomplete.** The Python worker only wrapped `fetch`, so XHR (and Pyodide's `open_url`), WebSocket and IndexedDB still worked, and an imported strategy could have read saved strategies. Both workers now remove XHR, WebSocket, EventSource, `importScripts`, IndexedDB, Cache Storage and BroadcastChannel. Python's `fetch` reaches the Pyodide CDN only. Verified from inside each language: all blocked.
5. **The browser cache kept a short history all day.** A history that stops short of the session (Yahoo settling late) is now reused for 30 minutes from receipt, matching the server's CDN lifetime, then refetched (tested).
6. **Clock skew.** If a device clock runs ahead around 18:00 New York time, the server's 400 now names the session it expects, and the client retries once with it (tested). The server never clamps, since a clamped answer would be cached under the wrong URL.
7. The lookahead message now says the strategy "reads future prices or is not deterministic (seed any randomness)", so an unseeded random strategy is not accused of peeking.

*Out of scope, flagged:* none of the main app's API routes are CDN-cached. Measured: `/api/market/heatmap` (10 KB, `max-age=30`), `/api/market/chart` for 3 tickers over 1Y (38 KB, `max-age=30`), `/api/market/snapshot` (7 KB, `max-age=5`), and `/api/market/fear-greed` (no cache header). Each sends browser-only `max-age`, so every visitor request runs a function and calls an upstream provider. Responses are small, so the risk there is function invocations and Active CPU per visitor, not bytes. It also fits the 429s seen earlier.

**Phase 5: Research tools.**
- In-sample and out-of-sample split, walk-forward, parameter sweeps (run across several workers), overfitting warnings.

**Phase 6: Later, only on demand.**
- Event mode (`on_bar`) for path-dependent logic, intraday bars, point-in-time universes, accounts and sharing (option B).

---

## 8. Security and safety

- User code runs **only in the user's own browser**, in a Web Worker with no DOM access. The worker gets data by message passing only. Network access is blocked in the worker, with data fetched by the engine.
- A run time limit kills the worker. A memory limit applies through Pyodide where possible.
- Shared strategy files (later) are treated as untrusted: they open in the editor, but never run automatically.
- Copy on the opt-in screen and on every report: hypothetical, past performance, not advice, no trading. This should match `/terms`, which will need a short Lab section.

---

## 9. Open decisions

1. ~~Gating: local opt-in route (A) or accounts (B).~~ Decided 2026-10-29: **A, local opt-in route.**
2. ~~Python in v1, or later.~~ Decided by Phase 0: **Python in v1**, preloaded in a worker (see Phase 0 results).
3. Default benchmark: SPY, or the user's current portfolio held without changes.
4. Whether to accept user-uploaded data in v1.

---

## Sources

- [Backtesting platforms comparison (Quantt)](https://www.quantt.co.uk/resources/backtesting-platforms-comparison)
- [Best Backtesting Software for Traders 2026 (TradeZella)](https://www.tradezella.com/blog/best-backtesting-software)
- [Backtesting Software Ranked for Retail Quants (LuxAlgo)](https://www.luxalgo.com/blog/backtesting-software-ranked-for-retail-quants/)
- [Best Stock Backtesting Platforms of 2026 (LambdaFin)](https://www.lambdafin.com/articles/best-stock-backtesting-platforms-2026)
- [QuantConnect IDE docs](https://www.quantconnect.com/docs/v2/cloud-platform/projects/ide)
- [QuantConnect LEAN CLI research](https://www.quantconnect.com/docs/v2/lean-cli/research)
- [QuantConnect review (DEV Community)](https://dev.to/pickuma/quantconnect-review-running-2400-backtests-without-installing-a-single-python-library-6lb)
- [Pyodide: Python for the browser (LWN)](https://lwn.net/Articles/855875)
- [Pyodide performance issue #684](https://github.com/pyodide/pyodide/issues/684)
- [Try pandas in your browser](https://pandas.pydata.org/try.html)
- [Portfolio Visualizer guide (AlgoTrading101)](https://algotrading101.com/learn/portfolio-visualizer-guide/)
- [How backtests work in Composer](https://help.composer.trade/article/215-7-how-do-backtests-work-in-composer)
- [Composer review 2026 (Walnut)](https://walnutinvest.com/resources/composer-review)

Vendor blogs in this list sell competing products. Pyodide performance figures are from 2019 to 2021 sources, which is why Phase 0 measures them again.
