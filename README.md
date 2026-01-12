# Portfolio Compass

A professional-grade financial analytics platform for ETF analysis, portfolio optimization, and wealth projection. Built with **Next.js 16**, **React 19**, and **Bun**.

## 📚 Documentation

Detailed documentation is available in the **[Project Wiki](Portfolio-Compass.wiki/Home.md)**:
- **[Financial Mathematics](Portfolio-Compass.wiki/Financial-Math.md)**: Explanation of the Greedy Optimization algorithm, Monte Carlo simulations, and Quant Scoring models.
- **[System Architecture](Portfolio-Compass.wiki/Architecture.md)**: Overview of the tech stack, Local-First design, and database schema.

## ✨ Key Features

- **Advanced Search**: Real-time searching of ETFs and Stocks with rich metadata.
- **Portfolio Optimizer**: Client-side **Greedy Marginal Utility** optimizer to maximize Sharpe Ratio under budget constraints.
- **Monte Carlo Simulation**: Mathematical projection of portfolio performance using Cholesky Decomposition for correlated asset paths.
- **Deep Analysis**: Look-through exposure analysis (sectors, holdings), risk metrics (Beta, Volatility), and Factor Scoring.
- **Biopunk Aesthetic**: A custom, high-fidelity dark UI designed for immersive analysis.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Runtime**: Bun (v1.x)
- **Database**: PostgreSQL (via Prisma ORM)
- **State**: TanStack Query v5 + LocalStorage
- **Styling**: Tailwind CSS v4 + Framer Motion

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh/) installed.
- A PostgreSQL database (local or cloud).

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/portfolio-compass.git
   cd portfolio-compass
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Configure Environment**:
   Create a `.env` file in the root directory:
   ```bash
   DATABASE_URL="postgresql://user:password@host:port/database"
   CRON_SECRET="your-secure-random-string"
   ```

4. **Initialize Database**:
   ```bash
   bun run db:generate
   bun run db:push
   # Optional: Seed initial market data
   bun run db:seed
   ```

5. **Start Development Server**:
   ```bash
   bun run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🧪 Running Tests

This project uses `bun:test` for high-performance unit testing.

```bash
bun test
```

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
