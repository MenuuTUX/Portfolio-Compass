# Portfolio Compass 🧭

**Professional Portfolio Intelligence for Retail Investors.**

Portfolio Compass is an interactive, high-performance web application designed to help retail investors analyze, compare, and build diversified portfolios with precision. Merging algorithmic insights with a modern aesthetic, it offers a unique and engaging way to visualize wealth generation.

![Landing Page](public/screenshots/landing_page.png)

## ✨ Features

### 🚀 Interactive Landing Experience
- **Modern Interface**: A visually clean interface featuring smooth animations and dynamic lighting.
- **Growth Simulation**: Real-time wealth projection slider that visualizes the impact of risk and time horizon on your potential returns.
- **Live Market Status**: Real-time indicator of market status (Open/Closed).

### 📈 Trending & Analysis
- **Market Pulse**: View trending stocks and ETFs with real-time data.
- **Sector Weightings**: Deep dive into ETF compositions and sector allocations.
- **"Just Buy" & "Mag 7"**: Curated lists of popular investment strategies and top-performing assets.

![Trending Tab](public/screenshots/trending_tab.png)

### 💼 Portfolio Builder
- **Drag & Drop Interface**: Easily add stocks and ETFs to your portfolio.
- **Dynamic Rebalancing**: Adjust weights and shares to see how they affect your overall portfolio composition.
- **Visual Feedback**: Immediate visual cues for portfolio health and diversification.

![Portfolio Tab](public/screenshots/portfolio_tab.png)

### 🌱 Wealth Projector
- **Long-term Visualization**: Project your portfolio's growth over 10, 20, or 50 years.
- **Scenario Planning**: Adjust contribution rates and expected returns to model different financial futures.

![Growth Tab](public/screenshots/growth_tab.png)

### 🔍 Comparison Engine
- **Side-by-Side Analysis**: Compare ETFs and stocks on key metrics like Yield, MER (Management Expense Ratio), and historical performance.
- **Data-Driven Insights**: Make informed decisions based on comprehensive financial data sourced from Yahoo Finance.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Charts**: [Recharts](https://recharts.org/)
- **Data Source**: [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2)

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
- Node.js (v18+)
- PostgreSQL installed and running

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Shib-Das/Portfolio-Compass.git
    cd Portfolio-Compass
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory (or copy `.example.env` if available) and add your database connection string:
    ```env
    DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/portfolio_compass?schema=public"
    ```

4.  **Database Migration**
    Run Prisma migrations to set up your database schema:
    ```bash
    npx prisma migrate dev
    ```

5.  **Seed Data**
    Populate the database with initial market data (ETFs, Stocks):
    ```bash
    npm run seed
    ```

6.  **Run the Application**
    Start the development server:
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License.
