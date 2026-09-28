# Portfolio Compass

Portfolio Compass is a local-first browser app for comparing stocks and ETFs, assembling a portfolio, and testing allocation assumptions.

Stack: Next.js (App Router), React, TypeScript, Bun, TanStack Query, Tailwind CSS.

## Architecture (local-first)

**No server database.** Nothing user-specific is stored in Postgres/Prisma.

| Data | Where |
|------|--------|
| Portfolio holdings (tickers, weights, shares) | Browser **LocalStorage** |
| Quotes, charts, search, fund details | **Live** Yahoo / scrapers via API routes |
| Reddit community links | Static config in repo |
| Fear & Greed gauge | Live CNN index |

Hosting, such as Vercel, runs the Next.js app and its API proxies. Clearing site data also clears the portfolio. Export a JSON backup before clearing browser data.

## Features

- Stock and ETF search with current quotes and price charts
- Side-by-side comparison without automatic winner labels
- Portfolio storage in the browser, with no login
- An experimental whole-share allocation score using explicit return and variance proxies; its candidates cannot be applied from the panel
- Constant-return projections and Monte Carlo model paths
- Fund holdings, sector, credit-quality, and market-data views when sources provide them

The allocation score is a heuristic, not a Sharpe optimizer. It uses a provider-reported yield and beta-based return proxy, with covariance estimated from overlapping price history when sufficient data exists or from a single-index fallback otherwise. Reported yield has not been independently reconciled for every fund, so the panel does not apply trades. Monte Carlo uses historical **price** returns and geometric Brownian motion for illustrative paths, not calibrated forecasts or investment advice. Portfolio totals and projections are withheld when a held quote is stale or unavailable, or when held currencies differ and dated FX conversion is unavailable.

## Pages

| Route | Purpose |
|-------|---------|
| `/` | The app |
| `/privacy` | What is stored locally, what reaches the server, which third parties see requests |
| `/terms` | Terms of use, including what the projections are and are not |
| `/robots.txt`, `/sitemap.xml` | Generated at build time |
| `/opengraph-image` | 1200×630 social card, generated at build time |

The `/api` routes are rate-limited to 120 requests per minute per IP in
`middleware.ts`, since each one proxies an upstream data provider.

## Getting started

### Prerequisites

- [Bun](https://bun.sh/)

### Setup

```bash
git clone https://github.com/MenuuTUX/Portfolio-Compass.git
cd Portfolio-Compass
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

No environment variables are required.

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server |
| `bun run build` | Production build |
| `bun test` | Unit tests |
| `bun run lint` | ESLint |
| `bun run lint:oxlint` | Oxlint |
| `bun run typecheck` | `tsc --noEmit` |

## License

MIT. See [LICENSE](LICENSE).
