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
- A greedy whole-share allocator using explicit return and variance proxies
- Constant-return projections and Monte Carlo model paths
- Fund holdings, sector, credit-quality, and market-data views when sources provide them

The allocator is a heuristic, not a Sharpe optimizer. It uses dividend yield plus a beta-based return proxy, a diagonal beta-based variance proxy, and no cross-asset correlations. Monte Carlo results use historical estimates and geometric Brownian motion. Both are model outputs, not forecasts or investment advice.

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

No `DATABASE_URL` needed. Optional env vars are documented in `.example.env`.

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server |
| `bun run build` | Production build |
| `bun test` | Unit tests |
| `bun run lint` | ESLint |
| `bun run lint:oxlint` | Anti-slop Oxlint rules |
| `bun run typecheck` | `tsc --noEmit` |

## License

MIT. See [LICENSE](LICENSE).
