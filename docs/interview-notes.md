# Portfolio Compass: interview notes

Reviewed at commit 1aa9790 (branch lab/phases-1-4). Code references are repo-relative `file:line` and were read directly. The unit tests were not run for these notes. Where a claim comes from a planning document rather than code, it says so.

## 1. Two-minute spoken explanation

I built Portfolio Compass, a browser app for looking at stocks and ETFs before deciding what to hold. You search for tickers, see quotes and charts, and assemble a portfolio. Everything you enter stays in your browser. There is no account and no database, so the server holds nothing about you.

The project has three parts I can explain. The first is an allocation panel. It estimates how the holdings move together using a covariance matrix, which comes from overlapping price history when there is enough of it and from a market-model shortcut when there is not. It then adds whole shares, one small lot at a time, to whichever purchase improves a simple score: expected return minus a risk penalty. It is a heuristic. It can only buy, and it does not place trades, so I describe it as a teaching tool and not an optimizer.

The second part is a Monte Carlo simulator. It takes each holding's historical daily returns, models them as geometric Brownian motion with correlated random shocks, and draws many possible paths. The output is a range of outcomes, not a forecast, and it uses price returns only, so dividends are left out.

The third part is Compass Lab, a backtesting engine. A strategy is either a set of rules or a short piece of Python or TypeScript that returns target weights. The engine owns cash, fills, costs, dividends and rebalancing, so every strategy gets the same accounting. Orders decided on one day fill on the next day. It reports CAGR, volatility, Sharpe, Sortino, drawdown and Calmar, and it hashes each run's inputs so the same run can be checked.

I would be upfront about the limits. The main site works with price returns, not total return. The S&P list in the repo is a current list, so backtests on it would carry survivorship bias. The lookahead check is a heuristic. The Lab does not yet have out-of-sample testing or sweep warnings.

## 2. How it works

### 2.1 Backtest engine (`lib/lab/engine/simulate.ts`, `backtest.ts`, `frame.ts`)

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

### 2.2 Metrics (`lib/lab/engine/metrics.ts`)

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

### 2.3 Covariance estimation (`lib/math/covariance.ts`, `history.ts`)

Two estimators, never mixed (`covariance.ts:28-30`, the reason being that mixing can give a matrix that is not positive semi-definite and a negative modelled variance).

- **Alignment.** Each holding's closes are matched on calendar dates shared by all holdings (`history.ts:32-66`). Series are not sliced to the same length, because equal indexes do not mean the same session.
- **History estimator.** Sample covariance of aligned daily log returns, annualized by observed samples per year rather than by 252 (`covariance.ts:111`, `covariance.ts:135`). It is used when there are at least 40 returns (`MIN_SAMPLES`, `covariance.ts:57`, check at `covariance.ts:95`) and the overlap spans more than 0.25 years (`covariance.ts:100`).
- **Single-index fallback.** Off-diagonal cov(i, j) = β_i × β_j × σ_m², with σ_m fixed at 15% (`covariance.ts:44`, `covariance.ts:62-84`). Diagonal variance = β_i² × σ_m² + idiosyncratic variance, with idiosyncratic volatility of 22% for STOCK, 6% for ETF and 0 for cash (`covariance.ts:51-54`, `covariance.ts:75-81`). Variance has a 1e-6 floor (`covariance.ts:60`).
- **Why the off-diagonals matter.** The header comment gives the concrete case: with the off-diagonals zeroed, sixteen S&P 500 trackers would show about 3.8% volatility. The correct figure is about 15% (`covariance.ts:12-16`).

### 2.4 Monte Carlo (`lib/monte-carlo.ts`, `components/simulation/MonteCarloSimulator.tsx`)

- **Model.** For each day, each asset's log return is μ_i + (L z)_i, where z is a vector of independent standard normals from Box-Muller (`monte-carlo.ts:231-242`, `boxMullerTransform` at `monte-carlo.ts:262-268`). Price_i is multiplied by exp(log return) (`monte-carlo.ts:241-242`).
- **Drift.** μ_i is the sample mean of that asset's daily log returns (`MonteCarloSimulator.tsx:255-257`).
- **Correlation.** L is the Cholesky factor of the daily sample covariance (`getCholeskyDecomposition`, `monte-carlo.ts:106-134`; the call at `MonteCarloSimulator.tsx:261`). If the matrix is not positive definite the run stops with an error.
- **Buy-and-hold.** Shares are fixed at time zero from the current market-value weights (`monte-carlo.ts:226-227`; weights from `getEffectiveWeights`, `MonteCarloSimulator.tsx:239`). There is no rebalancing, cost or dividend.
- **Horizon and output.** The number of days is years × 252 (`MonteCarloSimulator.tsx`, `numDays`). `calculateCone` returns the 5th percentile, median and 95th percentile of portfolio value on each day (`monte-carlo.ts:280-305`).
- **Preconditions.** At least 200 aligned daily returns for every holding (`MonteCarloSimulator.tsx:245`). A fresh, complete valuation in one currency is required, and mixed currencies are converted with dated FX before the run (`MonteCarloSimulator.tsx:168-216`).
- **Seeding.** The simulator accepts a seed, but the UI passes none, so each run draws new paths (`monte-carlo.ts:180`, `monte-carlo.ts:213-222`; call at `MonteCarloSimulator.tsx:292-299`).

### 2.5 Allocation heuristic (`lib/optimizer.ts`, `components/OptimizationPanel.tsx`)

- **Objective.** U(w) = μ_p − λ × σ_p², computed from market-value weights and the covariance matrix (`optimizer.ts:76-103`).
- **Risk penalty.** λ = 10 for conservative, 5 for balanced, 1 for growth (`optimizer.ts:41-45`).
- **Return proxy.** expected return = yield + β × 0.06 (`OptimizationPanel.tsx:49-52`, the 0.06 constant at line 51). The 6% is a fixed assumption, not data.
- **Search.** Greedy. Each step tries one lot per asset, sized to about $100 of that asset (`STEP_VALUE`, `optimizer.ts:48`). The step grows to budget / 400 for large budgets (`optimizer.ts:57`, `optimizer.ts:181`). The asset with the best utility gain per dollar wins. The loop stops when nothing improves utility or the budget runs out (`optimizer.ts:184-231`).
- **Buy only.** The allocator cannot sell (`optimizer.ts:112-116`). Its budget is the target total minus current value (`OptimizationPanel.tsx:79`).
- **Display only.** The panel says Apply is unavailable (`OptimizationPanel.tsx:328`).

## 3. Known limitations, stated honestly

Each item below was verified in the code or docs, and the source is given.

**Data and returns**

1. **Main site returns are price returns.** The historical statistics use close prices and say so: "Price only" (`lib/math/portfolio-stats.ts:4-6`). The return helpers state that current yield does not reconstruct historical total return (`lib/math/portfolio-returns.ts:6-10`). Dividends are absent from these numbers. The README says the same in its Monte Carlo paragraph.
2. **Historical stats are withheld on sparse data.** Volatility is withheld when there are fewer than 100 observations or any gap over 10 days (`portfolio-stats.ts:54-56`).
3. **Yahoo is an unofficial source.** The Lab's bar fetcher uses the `yahoo-finance2` package (`package.json:60`, `lib/lab/bars.ts`). The Lab plan records that Yahoo re-adjusts history when a new dividend or split arrives, so cached history can change (plan, Phase 1, finding 1). The main site uses the same provider (`lib/fast-market.ts`).
4. **Missing bars are carried at the last close.** A ticker with a gap is valued at its last close (`frame.ts` header, `simulate.ts:161`, `simulate.ts:235`). A delisted or suspended holding can therefore look flat.
5. **Long-range FX is limited.** The Lab UI blocks mixed-currency portfolios because the FX history covers only two years of USD/CAD (plan, Phase 3 scope notes). Conversion needs a rate within 7 days (`lib/math/fx-history.ts:76`).

**Compass Lab engine**

6. **Strategies see the full history in one call.** Execution cannot happen before the bar that decided it, but the signal can still read later prices. Only a heuristic check catches that (see 7 and section 5, question 2). The plan says the engine gives strategies only bars up to t (plan section 4.1). The code does not do this.
7. **The lookahead check is a heuristic.** It reruns the strategy with history cut at 60% and 85% of the sample and flags any earlier weight that changes (`lookaheadCutoffs` and `checkLookahead`, `lib/lab/strategy/weights.ts`; called from `ts-worker.ts:44` and `py-worker.ts:130`). It can miss leaks that do not show at those two cut points.
8. **Strategies see backward-adjusted prices.** The price matrix a strategy receives is adjClose (`lib/lab/strategy/types.ts`, `ts-runner.ts` `pricesView`). That series is adjusted backward from today, so its level at a past date depends on later dividends. Ratios are safe. Price levels can leak future information (plan, Phase 2, caveat 2).
9. **No overfitting guards yet.** There is no in-sample and out-of-sample split, no walk-forward test and no count of how many variants were tried. These are in the plan's Phase 5 and are not in the code (`grep` for walk-forward, out-of-sample and sweep in `lib/lab`, `components/lab` and `app/lab` returns nothing).
10. **Survivorship bias is not warned about.** The Lab does not offer the S&P heatmap list as a universe, so there is no live exposure. The plan requires a survivorship warning if it is added (plan, section 6, item 4). The plan describes the list as current constituents only. The file's own header does not say that.
11. **No taxes, withholding or broker constraints.** The engine has no tax or withholding step (none in `lib/lab/engine`).
12. **Floating point, not decimal.** Cash and shares are JavaScript numbers. The plan decided against `decimal.js` for speed, and relies on golden tests (plan, Phase 2, decision 1).
13. **Whole-share units are today's units.** Prices are split-adjusted, so before a split, rounding to whole shares is slightly coarser than it really was (plan, Phase 2, caveat 4).
14. **Run history is session-only.** Runs live in memory for the session (plan, Phase 3 scope notes).
15. **The worker sandbox is a guard, not a security boundary.** Network and storage APIs are removed inside the worker, which limits accidents but does not isolate hostile code (`lib/lab/strategy` workers, plan Phase 4).
16. **Matrix strategy identity uses a 32-bit hash.** For a weight matrix with no source code, the run identity is an FNV-1a 32-bit fingerprint of the matrix bytes (`backtest.ts:119-125`). Collisions are possible in principle. The price data is hashed separately, so this affects only the strategy part of the identity.

**Monte Carlo and allocator**

17. **GBM assumptions.** Constant drift and volatility, normal shocks (so no fat tails), independent days (no volatility clustering) and a constant correlation structure, all taken from history (`monte-carlo.ts:231-251`). A calm past produces a narrow cone.
18. **Price-only and buy-and-hold.** There are no dividends, costs, taxes or rebalancing in the simulation (`monte-carlo.ts:226-227`; README, Monte Carlo paragraph).
19. **Not reproducible from the UI.** No seed is passed, so each run gives different paths (`MonteCarloSimulator.tsx:292-299`).
20. **Two covariance estimators.** The Monte Carlo builds its own daily sample covariance and needs 200 returns with no fallback (`MonteCarloSimulator.tsx:245`, `254`). The allocator uses `covariance.ts` with a 40-return minimum and a single-index fallback. The two can disagree on the same portfolio.
21. **Single-index fallback uses fixed constants.** The 15% market volatility and the 22% and 6% idiosyncratic volatilities are assumptions, not estimates (`covariance.ts:44-54`).
22. **The allocator is not a Sharpe optimizer.** It maximizes a mean-variance utility with a hard-coded return proxy (`OptimizationPanel.tsx:51`). It is greedy and buy-only, and its results cannot be applied from the panel (README, Features; `OptimizationPanel.tsx:328`).

**Operations**

23. **Rate limiting is per process.** The API limit is 120 requests per minute per IP, kept in memory (`proxy.ts:14-15`). Users behind a shared IP can hit it together, and the limit resets when the process restarts.
24. **Local-first means local-only data.** Clearing site data erases the portfolio (README, Architecture). The Lab's strategies and cache live in IndexedDB and localStorage in the same browser.

## 4. Documentation versus code

These are the mismatches found while reading. None is hidden in this note.

1. **README omits Compass Lab.** The README describes a site with no server database and only LocalStorage for user data. It does not mention the Lab, its IndexedDB store (`compass-lab`), or its localStorage keys (`pc:lab-ack:v1`, `pc:lab-form:v1`, per the plan). Commits 6b2fbc1 and 1aa9790 added the Lab.
2. **Price basis is described two ways.** `portfolio-returns.ts:6-10` says history comes from "unadjusted closes". The Lab's bar fetcher says Yahoo's `close` is split-adjusted (`lib/lab/bars.ts` header and the adjustment note at `lib/lab/yahoo-bars.ts:69`), and the plan says the same. Both can be true for different fields, but the main-site comment is at least imprecise about splits. Dividends are excluded in both cases.
3. **The plan says the strategy sees only bars up to t.** Plan section 4.1 claims "no lookahead by construction" and that the engine gives strategies "only bars up to t". The code passes the full matrix in one call and relies on a heuristic check (see limitations 6 and 7). Execution timing is enforced, signal timing is not.
4. **The plan says "proposal, not started".** Plan line 3 reads "Status: proposal, not started", while its phase sections say "built, not committed". The git history shows commits that contain the Lab. The plan is out of date.
5. **Daily rebalancing and bar-range slippage in the plan are not in the code.** Plan section 4.3 lists D (daily) rebalancing and slippage "as a fraction of the bar's range". The code's `Period` is W, M, Q and Y only (`simulate.ts:15`), and slippage is bps only (`simulate.ts:115`).
6. **Plan section 6.1 proposes a different open adjustment.** It suggests `open × adjClose / close`. The code uses split-adjusted open and close with dividends as explicit cash, and marks on close. That is internally consistent, so the plan is stale here, not the code.
7. **Plan section 4.5 describes guardrails that are not built.** In-sample and out-of-sample splits, walk-forward and sweep warnings are Phase 5 items, not in the code.
8. **README environment variables.** The README says none are required. `BRANDFETCH_CLIENT_ID` is read by the logo route (`app/api/logo/[ticker]/route.ts:38`), but the route falls back when it is absent. This is a footnote, not a contradiction.

The README's statements on rate limiting (120 per minute per IP in `proxy.ts`), quote staleness, FX withholding, and the description of the allocator and Monte Carlo all match the code.

## 5. Questions an interviewer might ask

**1. Why do you fill orders on the next bar?**
A signal computed from bar t's close cannot be traded at that same close, because the decision uses information that exists only after the close. The earliest realistic fill is the next open, and the engine does that (`simulate.ts:7-9`, `simulate.ts:217-218`). Filling at the next close is also available. The default of next open is the more conservative choice.

**2. What is lookahead bias, and does your engine prevent it?**
Lookahead bias means a test uses information that would not have been available when the decision was made. There are two kinds here. Execution lookahead is prevented by construction: orders decided at t fill at t+1. Signal lookahead is not prevented. Strategies get the whole price matrix in one call, so a strategy can read future prices. The engine detects this only heuristically: it reruns the strategy on truncated history at 60% and 85% of the sample and flags earlier weights that change (`lib/lab/strategy/weights.ts`). I would say that plainly rather than claim the engine guarantees no lookahead.

**3. Why can a high Sharpe ratio mislead?**
Sharpe divides the average excess return by volatility, so it assumes returns are roughly stable and that volatility captures the risk. It ignores crash risk and skew, and it can look excellent on a short or lucky sample. Here it uses a 0% risk-free rate, which is fine for this UI but is not the rate you would earn in cash (`metrics.ts:117-119`). Sortino and Calmar are shown alongside it because they answer different questions about the same returns.

**4. What does overfitting look like in this project?**
The most likely path is that a user edits the parameters or the code, reruns until the equity curve looks best, and reports that run. Each run has a hash, so a run can be reproduced, but nothing counts how many variants were tried. The Lab has no out-of-sample period and no sweep warning yet (plan Phase 5). The honest answer is that the current tool makes the result reproducible but does not protect against selecting the best of many runs. The fix is the Phase 5 work: a held-out period, walk-forward tests, and a count of runs in the report.

**5. What does the run hash guarantee?**
Two runs with the same hash used the same engine version, settings, strategy identity, dates, tickers, currency and the same price, open, close, adjusted close and dividend arrays (`run-hash.ts:18-37`). It does not guarantee the strategy is identical for matrix-only inputs, because that identity is a 32-bit fingerprint (`backtest.ts:119-125`), and it does not cover the runtime (for example the Python version).

**6. Why is the simulator built on time-weighted returns?**
Money added during the period would otherwise look like performance. A time-weighted return removes each day's flow before computing that day's return (`metrics.ts:47-54`). This makes a strategy with monthly contributions comparable to one without. Dollar-weighted (money-weighted) return answers a different question, the return on the investor's own cash.

**7. Why does Monte Carlo use GBM, and what are its weaknesses?**
GBM is simple and closed form, and it keeps prices positive because it works on log returns. The Cholesky step keeps the assets correlated the way history says they were. Its weaknesses are that it assumes constant drift and volatility, normal shocks with no fat tails, independent days and a stable correlation. A calm lookback produces a narrow cone, and a crash that is absent from the history is absent from the paths. The output should be read as a range given the past, not a forecast.

**8. Why is there no −σ²/2 term in the drift?**
The drift is the sample mean of daily log returns, applied to log returns (`MonteCarloSimulator.tsx:255-257`, `monte-carlo.ts:241-242`). The −σ²/2 correction appears when the drift is written for arithmetic returns. Here the estimated mean of log returns already includes that effect, so adding the term again would double-count it.

**9. Why do off-diagonal covariance terms matter?**
Portfolio variance is the sum of all pairwise covariances, so zeroing them makes variance fall with the number of holdings. The code's own example is sixteen S&P 500 trackers, which would show about 3.8% volatility instead of about 15% (`covariance.ts:12-16`). Two funds that track the same index are one bet, and only the covariance term shows it.

**10. Why use a single-index model when history is missing?**
With fewer than 40 aligned returns or less than about 3 months of overlap, a sample covariance is unreliable. The market-model fallback gives every pair a correlation driven by beta, so two funds on the same index still look correlated (`covariance.ts:62-84`). It rests on fixed assumptions (15% market volatility, 22% or 6% idiosyncratic), and the code says so.

**11. Is the allocator an optimizer?**
Not in the sense of a Sharpe optimizer. It maximizes expected return minus a risk penalty, using a return proxy of yield plus beta times 6% (`OptimizationPanel.tsx:51`). It is greedy and buy-only, so it can add but never sell (`optimizer.ts:112-116`). It does not solve for weights and its results cannot be applied from the panel. The README says the same.

**12. How did you check the engine is correct?**
The Lab plan records hand-computed unit cases and golden tests against recorded SPY and AGG data, with tolerances of 0.006% and 0.004% (plan, Phase 2). I have not run those tests for these notes. In an interview I would describe them as a claim from the plan and point to `tests/unit/lib/lab-engine.test.ts`, rather than say I re-ran them.

**13. Why local-first, with no server database?**
Portfolios are personal, and keeping them in the browser means the server never sees them. There is no login to build or secure, and the hosting stays cheap (README, Architecture). The trade-offs are that clearing site data erases the portfolio, there is no sync between devices, and the server cannot help with heavy computation. The Lab follows the same rule: user code runs in the user's browser, and the server only proxies market data (plan, section 4).

**14. Why does the Lab use a vectorized contract for Python?**
The strategy gets the whole matrix once and returns the whole weight matrix once. Crossing the JavaScript and Python boundary on every bar is slow, and the plan measured that the data copy takes milliseconds while Python's cost is mostly startup (plan, Phase 0).

**15. Why not use decimal arithmetic for money?**
Decimal arithmetic slows sweeps a lot, and float error is far below the noise in the price data. The plan records the decision and relies on golden tests to catch drift (plan, Phase 2, decision 1). For a student project I would say this openly, because a reviewer in finance may push on it.

**16. What would you add next?**
In order: an out-of-sample split and walk-forward tests, a count of runs with a warning when many were tried, a survivorship warning before any index list is used as a universe, total-return data from dated distributions or adjusted prices, longer FX history for mixed-currency portfolios, a seed in the Monte Carlo UI for reproducible paths, and saving runs to storage. These follow directly from the limitations above.

**17. Why does the allocator add lots of about $100?**
The step size keeps the search from being dominated by very cheap or very expensive shares, and it keeps runtime bounded (`optimizer.ts:48`, `optimizer.ts:51-57`). The comment records that a fixed $100 step made runtime linear in the budget, so a 100-asset, $20 million case blocked the main thread for 98 seconds. The step now grows to budget / 400.

## 6. Glossary

- **Time-weighted return.** The return of the portfolio with cash flows removed, so the investor's timing of contributions does not affect the number. Used for all Lab returns (`metrics.ts:47-54`).
- **CAGR.** Compound annual growth rate: the constant yearly rate that turns the start value into the end value over the period (`metrics.ts:115`).
- **Volatility.** The standard deviation of returns, annualized here by multiplying the daily figure by √252 (`metrics.ts:116`).
- **Sharpe ratio.** Average excess return per unit of volatility. Here it is annualized from daily returns and uses a 0% risk-free rate (`metrics.ts:117-119`).
- **Sortino ratio.** Like Sharpe, but it divides by downside deviation, so only returns below the target count as risk (`metrics.ts:120-123`).
- **Maximum drawdown.** The largest peak-to-trough fall in the value index, shown with its dates and recovery date (`metrics.ts:72-95`).
- **Calmar ratio.** CAGR divided by the size of the maximum drawdown (`metrics.ts:125`).
- **Covariance matrix.** A table of the variances of each holding and the covariances between each pair. It drives both the allocator and the Monte Carlo (`covariance.ts`).
- **Geometric Brownian motion (GBM).** A model where log returns are normal with constant drift and volatility, so prices stay positive. Used for the Monte Carlo paths (`monte-carlo.ts:231-251`).
- **Lookahead bias.** Using information that was not available when a decision was made. The engine prevents execution lookahead and only partly detects signal lookahead (section 2.1, question 2).
- **Survivorship bias.** A backtest that uses only the companies that still exist today overstates returns, because the failures are missing. The S&P list in the repo is a current list (plan, section 2).
- **Slippage.** The gap between the expected price and the fill price, here a fixed number of basis points against the trader (`simulate.ts:137-145`).
