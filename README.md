# Portfolio Compass

ETF and stock analytics: compare assets, build a portfolio, run a Sharpe-oriented optimizer, and project outcomes with Monte Carlo simulation.

Stack: Next.js (App Router), React, TypeScript, Bun, TanStack Query, Tailwind CSS.

## Architecture (local-first)

**No server database.** Nothing user-specific is stored in Postgres/Prisma.

| Data | Where |
|------|--------|
| Portfolio holdings (tickers, weights, shares) | Browser **LocalStorage** |
| Quotes, charts, search, fund details | **Live** Yahoo / scrapers via API routes |
| Reddit community links | Static config in repo |
| Market sentiment (optimizer) | Live CNN Fear & Greed |

Hosting (e.g. Vercel free tier) only runs the Next.js app + API proxies.  
Clearing site data clears the portfolio — use export/import if you need a backup.

## Features

- Live ETF/stock search with quotes and sparklines
- Portfolio builder with **local-first** storage (no login)
- Greedy optimizer (Sharpe / risk aversion under share constraints)
- Monte Carlo paths with correlated returns (Cholesky)
- Sector/holdings look-through, risk metrics, and quant scoring

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
| `bun run typecheck` | `tsc --noEmit` |

## License

MIT — see [LICENSE](LICENSE).
