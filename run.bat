@echo off
setlocal

echo 🧭 PortfolioCompass Initialization Sequence...

REM 1. Config
if not exist .env (
    echo ⚠️  No .env file found. Creating default configuration...
    echo DATABASE_URL="postgresql://postgres:postgres@localhost:5432/portfolio_compass?schema=public" > .env
    echo ✅ .env created.
)

REM 2. Dependencies
echo 📦 Installing Node.js dependencies...
call bun install --silent > nul 2>&1

REM 3. Database
echo 🗄️  Syncing Database Schema...
call bun run prisma db push

REM 4. Seed
echo 🌱 Seeding initial market data...
call bun run scripts/seed_market.ts

REM 5. Start
echo 🚀 Launching App...
call bun run dev

endlocal
