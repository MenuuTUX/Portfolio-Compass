# Setup Instructions

## Prerequisites

1.  **Bun**: Version 1.0.0 or later.
    *   Verify: `bun --version`
2.  **PostgreSQL**: Version 14 or later.
    *   Ensure the database server is running and accessible.

## Configuration

1.  Create a `.env` file in the project root.
2.  Define the following environment variables:

```env
# Connection string for PostgreSQL
DATABASE_URL="postgresql://username:password@localhost:5432/portfolio_compass?schema=public"

# Secret key for securing Cron API endpoints
CRON_SECRET="change_this_to_a_secure_random_string"

# Optional: API Key for Finnhub (fallback data source)
FINNHUB_API_KEY=""
```

## Installation

1.  Install dependencies:
    ```bash
    bun install
    ```

2.  Generate Prisma Client:
    ```bash
    bun run postinstall
    ```
    *Note: This command runs `prisma generate`.*

3.  Synchronize Database Schema:
    ```bash
    bun x prisma db push
    ```

4.  (Optional) Seed Market Data:
    ```bash
    bun run seed
    ```
    *This script populates the database with an initial set of ETFs and Stocks (SPY, QQQ, etc.).*

## Execution

1.  Start the development server:
    ```bash
    bun run dev
    ```

2.  Access the application at `http://localhost:3000`.

## Testing

Run the test suite using Bun's native test runner:

```bash
bun test
```
