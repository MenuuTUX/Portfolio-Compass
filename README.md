# Portfolio Compass

ETF and stock analytics: compare assets, build a portfolio, run a Sharpe-oriented optimizer, and project outcomes with Monte Carlo simulation.

Stack: Next.js (App Router), React, TypeScript, Bun, PostgreSQL/Prisma, TanStack Query, Tailwind CSS.

## Features

- Live ETF/stock search with quotes and sparklines
- Portfolio builder with local-first storage
- Greedy optimizer (Sharpe / risk aversion under share constraints)
- Monte Carlo paths with correlated returns (Cholesky)
- Sector/holdings look-through, risk metrics, and quant scoring

## Getting started

### Prerequisites

- [Bun](https://bun.sh/)
- PostgreSQL

### Setup

```bash
git clone https://github.com/MenuuTUX/Portfolio-Compass.git
cd Portfolio-Compass
bun install
```

Copy `.example.env` to `.env` and set:

```bash
DATABASE_URL="postgresql://user:password@host:port/database"
CRON_SECRET="your-secure-random-string"
```

```bash
bun run db:generate
bun run db:push
bun run db:seed   # optional
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server |
| `bun run build` | Production build |
| `bun test` | Unit tests |
| `bun run db:sync-all` | Deep-sync all tickers in the DB |
| `bun run lint` | ESLint |
| `bun run typecheck` | `tsc --noEmit` |

## License

MIT — see [LICENSE](LICENSE).
