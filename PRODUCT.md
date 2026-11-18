# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Young Canadians who have just opened a TFSA. They have contribution room and some cash, but no plan yet, and they need to decide what to put in it. Many are choosing between a few all-in-one or index ETFs for the first time. People who already hold investments can use every tool, but the landing speaks to the new TFSA holder first.

## Product Purpose

A free planning tool that makes a long-term, diversified TFSA plan easier to work out than a guess on a hot tip. A visitor checks contribution room, compares funds, builds a portfolio and tests how it would have held up. Success is a visitor who understands what they are comparing and what each number assumes before they put money anywhere. It never places trades and gives no investment advice.

## Positioning

Every figure shows what it assumes. Comparisons put fees, yields, currency and dates side by side with no "best fund" label. Projections say what they are not, and backtests show where a rule stopped working (the 70/30 split on every Lab result). Holdings stay in the visitor's browser: no account and no server database. A brokerage's marketing site cannot claim either.

## Operating Context

- TFSA rules come from the CRA: yearly limits, room that builds from the year a resident turns 18 (or 2009), withdrawals returned on January 1, and a 1% monthly tax on excess contributions.
- Visitors compare Canadian-listed ETFs priced in CAD (for example VEQT, XEQT, XBB, ZAG) alongside US-listed funds priced in USD.
- The full product is a desktop workspace with three panels; it also works on phones, where the panels become tabs.

## Capabilities and Constraints

- TFSA planner at `/tfsa`, using the CRA's published limits through 2026 (`lib/tfsa.ts`).
- Fund and stock search with quotes, charts, fees and yields from Yahoo Finance and scrapers, not cross-checked against a second source.
- Portfolio builder kept in browser LocalStorage; totals and projections are withheld when a quote is stale or dated FX is missing.
- Monte Carlo on a portfolio's own price history (total return when adjusted closes exist), and Compass Lab backtests with next-bar fills, costs, dividends and a 70/30 history split.
- Provider-reported expense ratios are not automatically a Canadian MER; the product keeps them labelled as provider figures.
- Terminology: "illustrative", "example", "model scenario"; never "forecast", "best" or a personal recommendation.

## Brand Commitments

- Name: Portfolio Compass. Open source under MIT, built by MenuuTUX.
- Voice: plain, first-person where the builder speaks, no hype, no em dashes.
- "For research and education, not financial advice" stays beside every primary action.

## Evidence on Hand

- `docs/example-backtest.md`: a 200-day trend filter on SPY, 2005 to 2026. Maximum drawdown fell from 55% to 26% over the full period; on a hold-out from 2020 the benefit disappeared.
- README "What I got wrong" section: four real corrections (allocator cash, Monte Carlo path count, mislabelled risk profiles, docs out of sync).
- Screenshots in `docs/screenshots/` and a 60-second demo in `docs/media/promo.mp4`.
- No testimonials, user counts, press or partner logos exist. Do not invent them. Landing mock figures are example data, not live quotes.

## Product Principles

1. Show the assumption next to the number, every time.
2. Never pick a winner for the visitor.
3. Keep the visitor's holdings in their browser.
4. Missing or stale data is stated, never filled in.
5. Speak to the new TFSA holder without talking down to them.
