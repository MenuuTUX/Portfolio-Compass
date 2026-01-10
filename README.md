# Portfolio Compass

A Next.js 14 application for ETF analysis, portfolio optimization, and visualization.

## Features

- **ETF Search & Analysis**: Real-time data from Yahoo Finance.
- **Portfolio Construction**: Build and optimize portfolios with drag-and-drop interface.
- **Optimization**: Monte Carlo simulations and efficient frontier analysis.
- **Biopunk Design**: Custom Framer Motion animations and dark mode aesthetic.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma
- **Runtime**: Bun
- **Styling**: Tailwind CSS, Shadcn UI
- **Charts**: Recharts

## Getting Started

1. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your database connection string and cron secret:
   ```bash
   DATABASE_URL="postgresql://user:password@host:port/database"
   CRON_SECRET="your-secure-cron-secret-here"
   ```

2. **Install Dependencies**:
   ```bash
   bun install
   ```

3. **Database Setup**:
   This project uses Prisma with PostgreSQL.
   - Generate client: `bun run db:generate`
   - Push schema: `bun run db:push`
   - Seed data: `bun run db:seed`

4. **Run the Development Server**:
   ```bash
   bun run dev
   ```

5. **Access the Application**:
   Open [http://localhost:3000](http://localhost:3000) with your browser.

## Deployment

If you are deploying to Vercel:
1. Go to your Project Settings > Environment Variables.
2. Add `DATABASE_URL` with your connection string.
3. Add `CRON_SECRET` (generate a strong random string) to secure background jobs.
4. Redeploy the application.

## License

MIT
