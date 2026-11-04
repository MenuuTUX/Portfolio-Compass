# Portfolio Compass: design notes

First written at commit 1aa9790. Updated 2026-11-04 for the total-return change and the Lab's robustness tools. Code references are repo-relative `file:line` and were read directly; line numbers may drift. Where a claim comes from a planning document rather than code, it says so.

How the main pieces work, what they assume, and where they fall short.

## 1. How it works

### 1.1 Backtest engine (`lib/lab/engine/simulate.ts`, `backtest.ts`, `frame.ts`)

- **Inputs.** `buildFrame` aligns every ticker on the union of trading dates, in one base currency. Missing bars stay NaN and are never zero (`frame.ts` header). Non-base currencies are converted with dated FX, and the build throws when no FX series is supplied. Split-adjusted open, close and adjClose are kept, plus cash dividends on their ex-dates.
- **Timing and no execution lookahead.** The target row for bar t is decided after t's close. Its orders fill at bar t+1, at open by default (`simulate.ts:7-9`, `simulate.ts:114`, rebalance call at `simulate.ts:217-218`).
- **Fills and slippage.** A buy fills at price × (1 + slip) and a sell at price × (1 − slip) (`simulate.ts:137-145`). Slippage defaults to 5 bps (`DEFAULT_CONFIG`, `simulate.ts:34`).
- **Commissions.** `max(minCommission, notional × commissionBps)` on any trade (`simulate.ts:116-117`). The default is 0 bps.
- **Costs.** `costsPaid` adds commissions and the slippage cost, measured against the pre-slippage price (`simulate.ts:143`).
- **Dividends.** On the ex-date, each holding receives shares × dividend, based on shares held at the prior close (`simulate.ts:192-201`). The default reinvests the cash at that bar's fill price. The alternative is `dividends: "cash"`, which holds the cash until the next rebalance. An ex-date that is not a trading day falls forward to the next bar (`frame.ts`, `buildFrame`).
- **External cash flows.** A contribution or withdrawal lands on the first bar of each period (`simulate.ts:203-214`). A withdrawal larger than the portfolio is capped and a warning is raised.
- **Rebalancing.** Three modes (`simulate.ts:251-265`): on target change (default), on a calendar period (W, M, Q or Y, `simulate.ts:15`), or when any weight drifts past a band. A rebalance first sells down to target, then buys in order of size. Whole-share rounding and affordability are applied to the buys (`simulate.ts:157-190`).
- **Constraints.** Shorts and weights summing above 1 throw (`simulate.ts:84-102`). NaN weights are treated as 0 with a warning.
- **Benchmark.** A single ticker held buy-and-hold with no cash flows and no rebalancing (`backtest.ts:93-102`).
- **Run hash.** SHA-256 over the engine version, settings, strategy identity, dates, tickers, currency and the four price arrays the engine actually used (`run-hash.ts:18-37`).

### 1.2 Metrics (`lib/lab/engine/metrics.ts`)

Returns are time-weighted, so contributions are not counted as performance.

- **Daily return.** r_t = equity_t / (equity_{t-1} + flow_t) − 1 (`metrics.ts:47-54`). The flow is added to the base because the simulator invests it on the same bar.
- **Index.** Cumulative product of (1 + r_t) starting at 1 (`metrics.ts:109-111`). Drawdowns are measured on this index, so contributions cannot hide a loss.
- **CAGR.** index_T^(1 / years) − 1, where years = calendar days / 365.25 (`metrics.ts:113-115`). Years are calendar years, while volatility and Sharpe use 252 trading days.
- **Total return.** index_T − 1 (`metrics.ts:114`).
- **Volatility.** Sample standard deviation (n − 1) of daily returns, times √252 (`metrics.ts:116`, `std` at `metrics.ts:62-68`).
- **Sharpe.** Daily risk-free rate = rf / 252. Sharpe = (mean daily return − rf daily) × 252, divided by annual volatility (`metrics.ts:117-119`). It returns null when volatility is zero. The Lab UI never passes a risk-free rate, so the default of 0 applies (`components/lab/RunsPanel.tsx:13` labels it "risk-free rate 0%").
- **Sortino.** Downside deviation = √( Σ min(r_t − rf daily, 0)² / N ) × √252, where N is all daily observations, not only the down days (`metrics.ts:120-122`). Sortino = (mean excess × 252) / downside deviation (`metrics.ts:123`). Null when the downside deviation is zero.
- **Max drawdown.** On the index, depth = index_t / running peak − 1. The reported drawdown is the most negative depth, with peak date, trough date and recovery date, where recovery is the first date the index regains that peak (`drawdowns`, `metrics.ts:72-95`, recovery at `metrics.ts:82`). The longest underwater stretch is measured in calendar days (`metrics.ts:93-94`).
- **Calmar.** CAGR / |max drawdown depth| (`metrics.ts:125`). This uses full-period CAGR, not a trailing 36-month window.
- **Beta and alpha.** Beta = cov(r, r_bench) / var(r_bench) (`metrics.ts:127-140`). Alpha is annualized Jensen's alpha: (mean r − rf daily − beta × (mean r_bench − rf daily)) × 252 (`metrics.ts:141`).
- **Turnover.** Total absolute traded value at fill prices, halved, divided by mean equity and by years (`metrics.ts:156-159`). It is one-way turnover per year.

### 1.3 Covariance estimation (`lib/math/covariance.ts`, `history.ts`)

Two estimators, never mixed (`covariance.ts:28-30`, the reason being that mixing can give a matrix that is not positive semi-definite and a negative modelled variance).

- **Alignment.** Each holding's closes are matched on calendar dates shared by all holdings (`history.ts:32-66`). Series are not sliced to the same length, because equal indexes do not mean the same session.
- **History estimator.** Sample covariance of aligned daily log returns, annualized by observed samples per year rather than by 252 (`covariance.ts:111`, `covariance.ts:135`). It is used when there are at least 40 returns (`MIN_SAMPLES`, `covariance.ts:57`, check at `covariance.ts:95`) and the overlap spans more than 0.25 years (`covariance.ts:100`).
- **Single-index fallback.** Off-diagonal cov(i, j) = β_i × β_j × σ_m², with σ_m fixed at 15% (`covariance.ts:44`, `covariance.ts:62-84`). Diagonal variance = β_i² × σ_m² + idiosyncratic variance, with idiosyncratic volatility of 22% for STOCK, 6% for ETF and 0 for cash (`covariance.ts:51-54`, `covariance.ts:75-81`). Variance has a 1e-6 floor (`covariance.ts:60`).
- **Why the off-diagonals matter.** The header comment gives the concrete case: with the off-diagonals zeroed, sixteen S&P 500 trackers would show about 3.8% volatility. The correct figure is about 15% (`covariance.ts:12-16`).

### 1.4 Monte Carlo (`lib/monte-carlo.ts`, `components/simulation/MonteCarloSimulator.tsx`)

- **Model.** For each day, each asset's log return is μ_i + (L z)_i, where z is a vector of independent standard normals from Box-Muller (`monte-carlo.ts:231-242`, `boxMullerTransform` at `monte-carlo.ts:262-268`). Price_i is multiplied by exp(log return) (`monte-carlo.ts:241-242`).
- **Drift.** μ_i is the sample mean of that asset's daily log returns (`MonteCarloSimulator.tsx:255-257`).
- **Correlation.** L is the Cholesky factor of the daily sample covariance (`getCholeskyDecomposition`, `monte-carlo.ts:106-134`; the call at `MonteCarloSimulator.tsx:261`). If the matrix is not positive definite the run stops with an error.
- **Buy-and-hold.** Shares are fixed at time zero from the current market-value weights (`monte-carlo.ts:226-227`; weights from `getEffectiveWeights`, `MonteCarloSimulator.tsx:239`). There is no rebalancing, cost or dividend.
- **Horizon and output.** The number of days is years × 252 (`MonteCarloSimulator.tsx`, `numDays`). `calculateCone` returns the 5th percentile, median and 95th percentile of portfolio value on each day (`monte-carlo.ts:280-305`).
- **Preconditions.** At least 200 aligned daily returns for every holding (`MonteCarloSimulator.tsx:245`). A fresh, complete valuation in one currency is required, and mixed currencies are converted with dated FX before the run (`MonteCarloSimulator.tsx:168-216`).
- **Seeding.** The simulator takes a seed. The UI draws a random seed for each run, shows it under "What this simulation used", and has a checkbox to reuse it so a run can be reproduced exactly (`MonteCarloSimulator.tsx`, `monte-carlo.ts:180`).

### 1.5 Allocation heuristic (`lib/optimizer.ts`, `components/OptimizationPanel.tsx`)

- **Objective.** U(w) = μ_p − λ × σ_p², computed from market-value weights and the covariance matrix (`optimizer.ts:76-103`).
- **Risk penalty.** λ = 3 for conservative, 1.4 for balanced, 0.9 for growth, calibrated so a broad stock and bond fund pair lands near 30%, 60% and 90% equity (`LAMBDA_BY_PROFILE` in `optimizer.ts`). The earlier values (10, 5, 1) gave about 13%, 20% and 83% once the allocator spent the full budget.
- **Return proxy.** expected return = yield + β × 0.06, with the 6% named `BETA_PREMIUM_ASSUMPTION` in `OptimizationPanel.tsx` and described in the panel's "How it works" text. The 6% is a fixed assumption, not data.
- **Search.** Greedy. Each step tries one lot per asset, sized to about $100 of that asset (`STEP_VALUE`, `optimizer.ts:48`). The step grows to budget / 400 for large budgets (`optimizer.ts:57`, `optimizer.ts:181`). The asset with the best utility gain per dollar wins. The loop keeps buying until the cash left is below the cheapest share, even when the best lot slightly lowers utility. U depends only on weights, so a "stop when nothing improves U" rule left most of a new investor's budget in cash after one or two purchases; spending the budget instead converges on the fully invested mean-variance mix (a unit test checks it against the closed-form two-asset optimum). Assets with a non-positive return proxy are never bought, since cash dominates them.
- **Buy only.** The allocator cannot sell (`optimizer.ts:112-116`). Its budget is the target total minus current value (`OptimizationPanel.tsx:79`).
- **Display only.** The panel says Apply is unavailable (`OptimizationPanel.tsx:328`).

## 2. Known limitations

Each item below was verified in the code or docs, and the source is given.

**Data and returns**

1. **Main-site returns are total return only when every holding has adjusted closes.** History points carry `price` (split-adjusted close, what charts show) and an optional `adjPrice` (Yahoo `adjclose`). `selectReturnBasis` in `lib/math/history.ts` picks "total" only if every holding has `adjPrice` on 95% or more of its dates, else "price" for all holdings, never a mix. The index, covariance and Monte Carlo read the chosen basis and label it on screen; `calculatePortfolioHistoricalStats` returns the basis but has no UI consumer yet. Adjusted history needs one `chart()` call per ticker because the batched spark endpoint returns closes only, so only the paths feeding the math ask for it; 1D and 1W have no adjusted close. `adjclose` is revised retroactively after every distribution, so a series is only consistent with itself. Stored portfolios keep only ticker, shares and weight, so history is always refetched; Monte Carlo also refetches 1Y with `adjusted=1` when the history it holds has no adjusted closes. A 1Y total return is not the same as the sum of price return and the current yield: the app never adds a yield term on top of total-return history.
2. **Historical stats are withheld on sparse data.** Volatility is withheld when there are fewer than 100 observations or any gap over 10 days (`portfolio-stats.ts:54-56`).
3. **Yahoo is an unofficial source.** The Lab's bar fetcher uses the `yahoo-finance2` package (`package.json:60`, `lib/lab/bars.ts`). The Lab plan records that Yahoo re-adjusts history when a new dividend or split arrives, so cached history can change (plan, Phase 1, finding 1). The main site uses the same provider (`lib/fast-market.ts`).
4. **Missing bars are carried at the last close.** A ticker with a gap is valued at its last close (`frame.ts` header, `simulate.ts:161`, `simulate.ts:235`). A delisted or suspended holding can therefore look flat.
5. **Long-range FX is limited.** The Lab UI blocks mixed-currency portfolios because the FX history covers only two years of USD/CAD (plan, Phase 3 scope notes). Conversion needs a rate within 7 days (`lib/math/fx-history.ts:76`).

**Compass Lab engine**

6. **Strategies see the full history in one call.** Execution cannot happen before the bar that decided it, but the signal can still read later prices. Only a heuristic check catches that (see 7, and section 1.1). The plan says the engine gives strategies only bars up to t (plan section 4.1). The code does not do this.
7. **The lookahead check is a heuristic.** It reruns the strategy with history cut at 60% and 85% of the sample and flags any earlier weight that changes (`lookaheadCutoffs` and `checkLookahead`, `lib/lab/strategy/weights.ts`; called from `ts-worker.ts:44` and `py-worker.ts:130`). It can miss leaks that do not show at those two cut points.
8. **Strategies see backward-adjusted prices.** The price matrix a strategy receives is adjClose (`lib/lab/strategy/types.ts`, `ts-runner.ts` `pricesView`). That series is adjusted backward from today, so its level at a past date depends on later dividends. Ratios are safe. Price levels can leak future information (plan, Phase 2, caveat 2).
9. **Overfitting guards are partial.** Each Lab run shows the first 70% and last 30% of its own equity curve side by side (`lib/lab/engine/holdout.ts`, with tests). The rule is not refit between the two pieces, so this is a consistency check, not a true out-of-sample test. For the no-code trend rule there is also a sweep over moving-average lengths and a walk-forward test (`lib/lab/engine/sweep.ts`, `walkforward.ts`, with tests). The walk-forward picks the best-Sharpe length on three years, applies it to the next year, and stitches the test years into one out-of-sample curve. Limits: each length is simulated once over the whole history, so a switch at a window edge pays no cost and carries the position it would already have held; the length list is our choice; it is one path through one history. Code strategies and the momentum rule are not swept. A variant count (distinct run hashes in the session, sweep values included) triggers a plain warning from 10, with no p-value, and resets on reload.
10. **Survivorship bias is not warned about.** The Lab does not offer the S&P heatmap list as a universe, so there is no live exposure. The plan requires a survivorship warning if it is added (plan, section 6, item 4). The plan describes the list as current constituents only. The file's own header does not say that.
11. **No taxes, withholding or broker constraints.** The engine has no tax or withholding step (none in `lib/lab/engine`).
12. **Floating point, not decimal.** Cash and shares are JavaScript numbers. The plan decided against `decimal.js` for speed, and relies on golden tests (plan, Phase 2, decision 1).
13. **Whole-share units are today's units.** Prices are split-adjusted, so before a split, rounding to whole shares is slightly coarser than it really was (plan, Phase 2, caveat 4).
14. **Run history is session-only.** Runs live in memory for the session (plan, Phase 3 scope notes).
15. **The worker sandbox is a guard, not a security boundary.** Network and storage APIs are removed inside the worker, which limits accidents but does not isolate hostile code (`lib/lab/strategy` workers, plan Phase 4).
16. **Matrix strategy identity uses a 32-bit hash.** For a weight matrix with no source code, the run identity is an FNV-1a 32-bit fingerprint of the matrix bytes (`backtest.ts:119-125`). Collisions are possible in principle. The price data is hashed separately, so this affects only the strategy part of the identity.

**Monte Carlo and allocator**

17. **GBM assumptions.** Constant drift and volatility, normal shocks (so no fat tails), independent days (no volatility clustering) and a constant correlation structure, all taken from history (`monte-carlo.ts:231-251`). A calm past produces a narrow cone.
18. **Buy-and-hold with no cash flows.** There are no separate dividend payments, costs, taxes or rebalancing in the simulation. Distributions are inside the drift only when the basis is total return (`monte-carlo.ts` header; README, Monte Carlo paragraph).
19. **Monte Carlo reproducibility is opt-in.** Each run draws a new random seed unless the user ticks the reuse-seed box.
20. **Two covariance estimators.** The Monte Carlo builds its own daily sample covariance and needs 200 returns with no fallback (`MonteCarloSimulator.tsx:245`, `254`). The allocator uses `covariance.ts` with a 40-return minimum and a single-index fallback. The two can disagree on the same portfolio.
21. **Single-index fallback uses fixed constants.** The 15% market volatility and the 22% and 6% idiosyncratic volatilities are assumptions, not estimates (`covariance.ts:44-54`).
22. **The allocator is not a Sharpe optimizer.** It maximizes a mean-variance utility with a hard-coded return proxy (`OptimizationPanel.tsx:51`). It is greedy and buy-only, and its results cannot be applied from the panel (README, Features; `OptimizationPanel.tsx:328`).

**Operations**

23. **Rate limiting is per process.** The API limit is 120 requests per minute per IP, kept in memory (`proxy.ts:14-15`). Users behind a shared IP can hit it together, and the limit resets when the process restarts.
24. **Local-first means local-only data.** Clearing site data erases the portfolio (README, Architecture). The Lab's strategies and cache live in IndexedDB and localStorage in the same browser.

## 3. Documentation versus code

These are the mismatches found while reading. None is hidden in this note.

1. **README omitted Compass Lab (fixed).** The README now has a Compass Lab section. Earlier it described a site with no server database and only LocalStorage for user data. It does not mention the Lab, its IndexedDB store (`compass-lab`), or its localStorage keys (`pc:lab-ack:v1`, `pc:lab-form:v1`, per the plan). Commits 6b2fbc1 and 1aa9790 added the Lab.
2. **Price basis was described two ways (fixed).** `portfolio-returns.ts` used to say history comes from "unadjusted closes"; its header now matches the Lab. The Lab's bar fetcher says Yahoo's `close` is split-adjusted (`lib/lab/bars.ts` header and the adjustment note at `lib/lab/yahoo-bars.ts:69`), and the plan says the same. Both can be true for different fields, but the main-site comment was imprecise about splits. Dividends are now included in both: the main site reads dividend-adjusted closes, and the Lab pays dividends as explicit cash.
3. **The plan says the strategy sees only bars up to t.** Plan section 4.1 claims "no lookahead by construction" and that the engine gives strategies "only bars up to t". The code passes the full matrix in one call and relies on a heuristic check (see limitations 6 and 7). Execution timing is enforced, signal timing is not.
4. **The plan said "proposal, not started" (fixed).** Plan line 3 now marks the plan as a historical design document and points to the README for what is built.
5. **Daily rebalancing and bar-range slippage in the plan are not in the code.** Plan section 4.3 lists D (daily) rebalancing and slippage "as a fraction of the bar's range". The code's `Period` is W, M, Q and Y only (`simulate.ts:15`), and slippage is bps only (`simulate.ts:115`).
6. **Plan section 6.1 proposes a different open adjustment.** It suggests `open × adjClose / close`. The code uses split-adjusted open and close with dividends as explicit cash, and marks on close. That is internally consistent, so the plan is stale here, not the code.
7. **Plan section 4.5 guardrails are only partly built.** The first-70% and last-30% view exists. The sweep, walk-forward and variant warning exist for the trend rule only (see limitation 9); code strategies are not covered.
8. **README environment variables.** The README says none are required. `BRANDFETCH_CLIENT_ID` is read by the logo route (`app/api/logo/[ticker]/route.ts:38`), but the route falls back when it is absent. This is a footnote, not a contradiction.

The README's statements on rate limiting (120 per minute per IP in `proxy.ts`), quote staleness, FX withholding, and the description of the allocator and Monte Carlo all match the code.

## 4. Glossary

- **Time-weighted return.** The return of the portfolio with cash flows removed, so the investor's timing of contributions does not affect the number. Used for all Lab returns (`metrics.ts:47-54`).
- **CAGR.** Compound annual growth rate: the constant yearly rate that turns the start value into the end value over the period (`metrics.ts:115`).
- **Volatility.** The standard deviation of returns, annualized here by multiplying the daily figure by √252 (`metrics.ts:116`).
- **Sharpe ratio.** Average excess return per unit of volatility. Here it is annualized from daily returns and uses a 0% risk-free rate (`metrics.ts:117-119`).
- **Sortino ratio.** Like Sharpe, but it divides by downside deviation, so only returns below the target count as risk (`metrics.ts:120-123`).
- **Maximum drawdown.** The largest peak-to-trough fall in the value index, shown with its dates and recovery date (`metrics.ts:72-95`).
- **Calmar ratio.** CAGR divided by the size of the maximum drawdown (`metrics.ts:125`).
- **Covariance matrix.** A table of the variances of each holding and the covariances between each pair. It drives both the allocator and the Monte Carlo (`covariance.ts`).
- **Geometric Brownian motion (GBM).** A model where log returns are normal with constant drift and volatility, so prices stay positive. Used for the Monte Carlo paths (`monte-carlo.ts:231-251`).
- **Lookahead bias.** Using information that was not available when a decision was made. The engine prevents execution lookahead and only partly detects signal lookahead (section 1.1).
- **Survivorship bias.** A backtest that uses only the companies that still exist today overstates returns, because the failures are missing. The S&P list in the repo is a current list (plan, section 2).
- **Slippage.** The gap between the expected price and the fill price, here a fixed number of basis points against the trader (`simulate.ts:137-145`).


## 5. TFSA planner (`/tfsa`)

**What it is.** A page that works out TFSA contribution room and shows what steady monthly saving adds up to. It exists because the project was built for people who have just opened a TFSA.

**What it does.**
- Room is the sum of the CRA's yearly limits from the year the person turned 18 (or 2009, if later), minus what they put in, plus what they took out in earlier years (`lib/tfsa.ts`, `availableRoom`). Withdrawals come back on January 1 of the next year, as the CRA states.
- A planned monthly amount that exceeds the room is flagged, with the CRA's 1% per month tax on the excess.
- The projection is monthly compounding of a fixed contribution at three assumed returns (3%, 5%, 7%). It is arithmetic on assumptions, labelled as such.

**Where the facts came from.** The yearly limits, the 1% per month excess tax and the withdrawal rule are from the CRA page "Before you contribute to a TFSA". The foreign tax credit and carrying-on-a-business points link to CRA folios on the page. I did not use any statistic about young investors, because I have no source for one.

**Limits.** The planner only knows what the user types, so it can disagree with CRA My Account. It knows limits through 2026. It does not model taxable accounts, so it makes no claim about how much a TFSA saves in tax.
