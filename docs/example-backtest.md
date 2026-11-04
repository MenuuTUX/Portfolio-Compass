# Example backtest: SPY 200-day trend filter

Date of run: 2026-11-02. Engine: `lab-engine/0.1.0`. Status: one run, one parameter, not reviewed. Hypothetical results, not investment advice.

## Hypothesis

A 200-trading-day (about 10-month) simple moving average trend filter on SPY reduces drawdown compared with buying and holding SPY, at some cost to return.

## Results

Starting capital $100,000. Dates are trading dates. Sharpe and Sortino use a risk-free rate of 0. Beta and alpha are measured against SPY and are shown for the full period only.

| Metric | Full: buy and hold | Full: SMA filter | In-sample: buy and hold | In-sample: SMA filter | Hold-out: buy and hold | Hold-out: SMA filter |
| --- | --- | --- | --- | --- | --- | --- |
| Period | 2005-01-03 to 2026-10-30 | 2005-01-03 to 2026-10-30 | 2005-01-03 to 2020-04-09 | 2005-01-03 to 2020-04-09 | 2020-04-13 to 2026-10-30 | 2020-04-13 to 2026-10-30 |
| Ending equity ($) | 930,510 | 607,743 | 313,275 | 313,284 | 293,941 | 194,954 |
| Total return | 830.51% | 507.74% | 213.27% | 213.28% | 193.94% | 94.95% |
| CAGR | 10.76% | 8.62% | 7.77% | 7.77% | 17.90% | 10.74% |
| Volatility (annualized) | 18.86% | 12.37% | 19.60% | 12.18% | 16.97% | 12.79% |
| Sharpe | 0.637 | 0.732 | 0.480 | 0.676 | 1.057 | 0.863 |
| Sortino | 0.900 | 1.008 | 0.673 | 0.928 | 1.528 | 1.198 |
| Max drawdown | -55.21% | -25.85% | -55.21% | -22.85% | -24.49% | -25.85% |
| Max drawdown peak / trough | 2007-10-09 / 2009-03-09 | 2022-01-03 / 2023-03-13 | 2007-10-09 / 2009-03-09 | 2018-09-20 / 2019-08-05 | 2022-01-03 / 2022-10-12 | 2022-01-03 / 2023-03-13 |
| Recovered | 2012-08-16 | 2024-07-05 | 2012-08-16 | Not within period | 2023-12-13 | 2024-07-05 |
| Longest drawdown (calendar days) | 1,773 | 914 | 1,773 | 664 | 709 | 914 |
| Turnover (one-way, per year) | 1.56% | 81.50% | 2.88% | 67.93% | 4.74% | 95.63% |
| Costs paid ($) | 101.67 | 5,122.52 | 76.32 | 2,172.27 | 57.98 | 946.15 |
| Trades | 88 | 102 | 62 | 66 | 27 | 36 |
| Dividends received ($) | 103,450 | 86,929 | 52,721 | 50,814 | 16,025 | 11,585 |
| Beta / alpha vs SPY (full period) | 1.00 / 0.00% | 0.43 / 3.89% | n/a | n/a | n/a | n/a |

Maximum drawdown by window, close to close, from the full-period runs:

| Window | Buy and hold | SMA filter |
| --- | --- | --- |
| 2007-10-09 to 2009-03-09 (2008 crash) | -55.21% | -5.91% |
| 2020-02-19 to 2020-03-23 (COVID crash) | -33.72% | -11.90% |
| 2022-01-03 to 2022-10-12 (2022 bear market) | -24.49% | -17.34% |

## Setup

- **Universe:** SPY only. Cash earns nothing in the engine.
- **Data:** Yahoo Finance daily bars through `yahoo-finance2` `chart()` with dividend and split events, fetched by the project's `lib/lab/bars.ts` on 2026-11-02. Last bar 2026-10-30, the last completed session. `close` is split-adjusted, `adjClose` is split- and dividend-adjusted. Prices were not cross-checked against a second source.
- **Period:** 5,492 bars from 2005-01-03 to 2026-10-30. The first 70% by bar count (3,844 bars) is in-sample. The last 30% (1,648 bars) is the hold-out, starting 2020-04-13. The split was done by a script around the engine, not by a Lab feature. Each split was run as a fresh $100,000 portfolio, with signals computed on the full history so the moving average is warmed up at the split.
- **Costs:** 5 bps slippage on every fill, 0 bps commission, no minimum ticket.
- **Fills:** next bar's open. Orders are never filled on the bar that generated them.
- **Shares:** fractional. Dividends are paid as cash on the ex-date and reinvested.
- **Buy and hold:** buy SPY at the first bar, rebalance on change only (weight never changes, so no rebalances after the first buy). Its 88 trades are the first buy plus the quarterly dividend reinvestments.
- **SMA filter:** signal is SPY `adjClose` compared with the simple average of the last 200 trading days, including the current bar. Evaluated on the last trading day of each month. If above, 100% SPY, otherwise 100% cash. Orders fill at the next open, so the position changes on the first trading day of the following month.
- **Turnover:** engine definition, traded value divided by two, over average equity, per year.
- **Run hashes (SHA-256, engine `lab-engine/0.1.0`):**
  - Buy and hold, full: `ffd812b322539ba13f38e154d954d090e8c45a4cd8dfe2b92a72ac66ff273860`
  - Buy and hold, in-sample: `12bd3de4534316d6f291a684412a6d7c608803df6d58d990663fe199c13b5204`
  - Buy and hold, hold-out: `a9157282646150625d88f51eada155616345b8c0b5d4b2585d3c03ac1d066f98`
  - SMA filter, full: `87107aadd2dfb672cd75855c5147a0ec099160fd348c5c62e26b0231c2e23939`
  - SMA filter, in-sample: `1558422a6e1bbd0ea9fdc03938c7d6cd489005ed1eef4a14e565d07289d40bff`
  - SMA filter, hold-out: `6f6dc2b0f2b50c0ee84ac78f490221fdac9a36153c16e4fd1290509971bb3320`

## What the result suggests

- **Full period:** the filter behaved as the hypothesis predicts. Maximum drawdown fell from -55.21% to -25.85%, and volatility fell from 18.86% to 12.37%. The cost was 2.1 points of CAGR (10.76% to 8.62%).
- **In-sample:** the drawdown reduction is large and the return cost is zero (CAGR 7.77% for both). A large part of the benefit comes from 2007 to 2009, where the filter lost 5.91% against 55.21% for buy and hold. The filter's own worst in-sample drawdown (-22.85%, 2018 to 2019) came from whipsaw trades: it bought in December 2018, sold in January 2019, bought in March 2019, and sold in June 2019.
- **Hold-out:** the hypothesis did not hold. The filter's maximum drawdown (-25.85%) was slightly deeper than buy and hold's (-24.49%), and its CAGR was 7.2 points lower (10.74% against 17.90%). The filter's worst drawdown ran from January 2022 to March 2023, later than buy and hold's 2022 trough, so its 2022 protection did not carry into 2023. The hold-out starts shortly after the March 2020 low, so most of the rebound falls inside it.
- **Conclusion:** this run does not establish the hypothesis. It supports a drawdown reduction in the 2005 to 2020 period and through the COVID crash, with no return cost in-sample. The hold-out does not show the drawdown reduction and shows a large return cost. One split and one parameter cannot separate a real effect from the choice of period.

## What could be wrong with this

- **One parameter, no sweep.** Only the 200-day window was tested. It was chosen as the conventional 10-month proxy, not from a search, so there is no multiple-testing correction. A sweep over window lengths would show whether the result depends on this exact choice. When this run was made the Lab had no parameter sweep. It now has one for the trend rule, plus a walk-forward test and a warning once 10 or more variants have been tried, but that warning applies no formal correction, so any sweep result still needs one by hand.
- **Survivorship and one-asset bias.** SPY is a large-cap US index that has survived and grown. The result describes one market over one period. It says nothing about other indices, sectors, bonds or international markets.
- **Dividends and adjustment basis.** Dividends are treated as cash on the ex-date and reinvested. The `adjClose` series used for the signal is revised by the data provider when later dividends arrive, so a re-fetch can change the signal slightly. The data has not been cross-checked against another source.
- **Regime dependence.** Most of the in-sample drawdown benefit comes from the 2007 to 2009 episode. The filter also helped in the COVID window (-11.90% against -33.72%) and in 2022 (-17.34% against -24.49%), but the 2022 to 2023 whipsaw pushed its hold-out drawdown to the same depth as buy and hold's. The run does not test why the filter whipsawed in that period.
- **Costs and taxes ignored.** Costs are 5 bps of slippage per fill with no commission and no ETF expense ratio. The filter trades several times a year, so a taxable account would realize gains on each sale, which this run does not model.
- **Cash earns nothing.** The engine pays zero interest on cash and uses a zero risk-free rate for Sharpe and Sortino. Cash periods (which were common in 2008 and 2022 to 2023) therefore earn 0%, understating the filter's return in higher-rate years. Sharpe ratios are also measured against zero, not against T-bills.
- **Short hold-out.** The hold-out covers about 6.5 years and one bear market. That is too little to estimate a drawdown distribution reliably.
- **Hypothetical.** These are backtested results with a model fill rule and fixed cost assumptions. Past performance does not predict future results. This note is not investment advice.
