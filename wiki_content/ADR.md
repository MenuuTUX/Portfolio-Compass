# Architecture Decision Record (ADR)

## 1. Selection of Greedy Algorithm for Portfolio Optimization

### Context
The application requires a client-side mechanism to recommend portfolio adjustments (buying/selling shares) to maximize the Sharpe Ratio given a fixed budget.

### Decision
We implemented a Greedy Marginal Utility algorithm.

### Justification
*   **Integer Constraints:** Traditional Mean-Variance Optimization (MVO) outputs weights (percentages), which must be rounded to whole shares. This rounding introduces tracking error, especially for small portfolios or high-priced assets. The Greedy approach adds one share at a time based on the highest marginal improvement to utility, inherently respecting integer constraints.
*   **Performance:** While theoretically O(N * Budget), the budget in this context (number of shares to add) is small enough for modern client-side execution (< 50ms).
*   **Local-First:** This approach avoids sending portfolio state to a Python backend (e.g., `cvxpy`), keeping the architecture simple and privacy-preserving.

### Alternatives Rejected
*   **Mixed Integer Quadratic Programming (MIQP):** Computationally expensive and requires heavy solver libraries (e.g., GLPK) that are not optimal for browser execution.
*   **Brute Force:** Computational complexity is factorial, making it infeasible for portfolios larger than 3 assets.

## 2. Adoption of Bun Runtime

### Context
The project requires a JavaScript runtime for development and production.

### Decision
We selected Bun (v1.x).

### Justification
*   **Package Management:** Bun's package manager is significantly faster than npm/yarn, reducing CI/CD times.
*   **Native TypeScript:** Bun executes TypeScript natively, removing the need for `ts-node` or build steps during development.
*   **Test Runner:** `bun:test` provides a Jest-compatible API with faster execution, encouraging Test-Driven Development (TDD).

## 3. On-Demand Data Synchronization

### Context
Financial data (price history, sector breakdown) is voluminous. Syncing all tickers continually is resource-intensive.

### Decision
We implemented a "Stale-While-Revalidate" pattern with an "On-Demand" trigger.

### Justification
*   **Efficiency:** Deep analysis data (e.g., sector weighting) is only fetched when a user views the details of a specific ETF.
*   **Resilience:** The search list view uses lightweight snapshots. If deep data is missing, the application fetches it lazily in the background.

## 4. Database Schema: Decimal for Financials

### Context
Floating point arithmetic introduces precision errors in financial calculations (e.g., 0.1 + 0.2 != 0.3).

### Decision
We use the `Decimal` type in Prisma (mapped to `DECIMAL` in PostgreSQL) and `decimal.js` in the application layer.

### Justification
*   **Precision:** Ensures exact representation of currency and fractional shares.
*   **Consistency:** Avoids drift in iterative algorithms like the Monte Carlo simulation.
