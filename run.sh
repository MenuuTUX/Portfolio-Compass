#!/bin/bash
set -e

echo "🧭 PortfolioCompass Initialization Sequence..."

# 1. Config
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating default configuration..."
    echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/portfolio_compass?schema=public"' > .env
    echo "✅ .env created."
fi

# 2. Dependencies
echo "📦 Installing Node.js dependencies..."
bun install --silent > /dev/null 2>&1

# 3. Database
echo "🗄️  Syncing Database Schema..."
bun run prisma db push

# 4. Seed
echo "🌱 Seeding initial market data..."
bun run scripts/seed_market.ts

# 5. Start
echo "🚀 Launching App..."
bun run dev
