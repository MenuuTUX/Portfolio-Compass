# Portfolio Compass

Portfolio Compass is a financial analytics platform designed for ETF analysis, portfolio optimization, and wealth projection. It utilizes Next.js for the frontend and backend, with Bun as the JavaScript runtime.

## Technology Stack

*   **Runtime:** Bun v1.x
*   **Framework:** Next.js 15.1.7 (App Router)
*   **Language:** TypeScript
*   **Database:** PostgreSQL
*   **ORM:** Prisma
*   **State Management:** TanStack Query v5
*   **Styling:** Tailwind CSS v4

## Core Features

### Portfolio Optimization
The application implements a Greedy Marginal Utility algorithm to optimize portfolio allocations. This approach maximizes the Sharpe Ratio relative to a fixed budget constraint, handling integer constraints (whole shares) directly.

### Monte Carlo Simulation
The platform projects future portfolio performance using Monte Carlo simulations. It employs Cholesky Decomposition to generate correlated random price paths, preserving the statistical relationships between assets in the portfolio.

### Market Data Aggregation
Market data is sourced via `yahoo-finance2` and custom scrapers. The system implements an On-Demand Data Architecture, fetching granular history only when required for analysis to minimize bandwidth and API usage.

## Setup and Installation

See [wiki_content/SETUP.md](wiki_content/SETUP.md) for detailed instructions.

## Architecture

See [wiki_content/ADR.md](wiki_content/ADR.md) for architectural decision records.

## Known Limitations

See [wiki_content/LIMITATIONS.md](wiki_content/LIMITATIONS.md).

## License

MIT License.
