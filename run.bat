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
call bun install --ignore-scripts
if %errorlevel% neq 0 (
    echo ❌ Dependency installation failed.
    exit /b %errorlevel%
)

REM 3. Database
echo 🔄 Generating Prisma Client...
call bun run prisma generate
if %errorlevel% neq 0 (
    echo ❌ Prisma Client generation failed.
    exit /b %errorlevel%
)

echo 🗄️  Syncing Database Schema...
call bun run prisma db push
if %errorlevel% neq 0 (
    echo ❌ Database sync failed.
    exit /b %errorlevel%
)

REM 4. Seed
echo 🌱 Seeding initial market data...
call bun run scripts/seed_market.ts
if %errorlevel% neq 0 (
    echo ⚠️  Seeding failed or completed with errors. Continuing...
)

REM 5. Start
echo 🚀 Launching App...
call bun run dev

endlocal
