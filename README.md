# Portfolio Compass

A browser app for comparing stocks and ETFs, building a portfolio, and backtesting allocation rules. Built by MenuuTUX as a research tool. It never places trades and gives no investment advice.

**Live demo: [portfolio-compass.vercel.app](https://portfolio-compass.vercel.app)**

![Portfolio Compass landing page](docs/screenshots/01-landing.png)

| Market workspace | Portfolio builder |
|---|---|
| ![Asset workspace with a price chart and valuation panel](docs/screenshots/02-workspace.png) | ![Portfolio builder with target allocation](docs/screenshots/03-portfolio.png) |

![Compass Lab guided lesson with backtest results](docs/screenshots/04-lab.png)

## What it does

- **Compare.** Search stocks and ETFs, view quotes and price charts, and put funds side by side without automatic winner labels.
- **Build.** Hold a portfolio in the browser with no login. Check position sizes, sector exposure and overlap. Totals and projections are withheld when a quote is stale or currencies differ and dated FX is unavailable.
- **Test.** Project a portfolio with constant-return and Monte Carlo paths, or backtest a strategy in Compass Lab.

## Compass Lab

Lab is a backtesting workspace at `/lab` with a guided mode, a no-code mode and a code mode (Python through Pyodide, or TypeScript).

- Strategy code only returns target weights. A TypeScript engine in `lib/lab/engine/` handles fills, costs, dividends, rebalancing and metrics, so every mode produces comparable numbers.
- Orders fill at the next bar's open, never on the bar that produced the signal.
- Metrics: CAGR, volatility, Sharpe, Sortino, Calmar, maximum drawdown, beta and alpha, turnover and costs.
- Each run stores a hash of the code, parameters, data and engine version, so a run can be reproduced.
- Daily bars are cached in the browser (IndexedDB) and fetched through `/api/market/bars`.

Not built yet: parameter sweeps, walk-forward tests and a multiple-testing warning. See the limitations below.

### Example

[docs/example-backtest.md](docs/example-backtest.md) tests a 200-day trend filter on SPY from 2005 to 2026. The filter cut maximum drawdown from 55% to 26% over the full period. On a hold-out period starting in 2020 the benefit disappeared. The note covers what could be wrong with that result.

## Architecture

**No server database.** Nothing user-specific is stored on a server.

| Data | Where |
|------|--------|
| Portfolio holdings (tickers, weights, shares) | Browser LocalStorage |
| Lab strategies, runs and cached price bars | Browser IndexedDB |
| Quotes, charts, search, fund details | Live Yahoo and scraper data through API routes |
| Fear & Greed gauge | Live CNN index |

Hosting runs the Next.js app and its API proxies. Clearing site data clears the portfolio, so export a JSON backup first. The `/api` routes are limited to 120 requests per minute per IP in `proxy.ts`.

Stack: Next.js (App Router), React, TypeScript, Bun, TanStack Query, Tailwind CSS, Recharts, Pyodide and Monaco (Lab only).

## Known limitations

- The main site shows price returns, not total returns. Dividends are not included. The Lab models dividends.
- The allocation score is a heuristic, not a Sharpe optimizer. It uses a provider-reported yield and a beta-based return proxy, and it cannot apply trades.
- Monte Carlo uses historical price returns and geometric Brownian motion. The paths are illustrative, not forecasts.
- Lookahead in strategy code is detected heuristically, not prevented by construction.
- Market data comes from Yahoo Finance and scrapers and has not been cross-checked against a second source.
- Lab results depend on one data source and one cost model, and ignore taxes.

More detail is in [docs/interview-notes.md](docs/interview-notes.md), including the places where design docs and code disagree.

## Getting started

Requires [Bun](https://bun.sh/).

```bash
git clone https://github.com/MenuuTUX/Portfolio-Compass.git
cd Portfolio-Compass
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required.

| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server |
| `bun run build` | Production build |
| `bun test` | Unit tests |
| `bun run lint` | ESLint |
| `bun run typecheck` | `tsc --noEmit` |

## License

MIT. See [LICENSE](LICENSE).
