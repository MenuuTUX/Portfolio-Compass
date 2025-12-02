#!/bin/bash
set -e

echo "🧭 PortfolioCompass Initialization Sequence..."

# 1. Config
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating default configuration..."
    echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/portfolio_compass?schema=public"' > .env
    echo "✅ .env created."
fi

# 2. Python Environment
# Check for uv
if ! command -v uv &> /dev/null; then
    echo "⬇️  Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.cargo/env
fi

if [ ! -d "venv" ]; then
    echo "🔨 Creating Python virtual environment with uv..."
    uv venv venv
fi

source venv/bin/activate

# 3. Dependencies
echo "🐍 Installing Python dependencies with uv..."
uv pip install -r requirements.txt || echo "⚠️  Python dependencies installation warning"

echo "📦 Installing Node.js dependencies..."
npm install --silent > /dev/null 2>&1

# 4. Database
echo "🗄️  Syncing Database Schema..."
npx prisma db push

# 5. Seed
echo "🌱 Seeding initial market data..."
npx tsx scripts/seed_market.ts

# 6. Start
echo "🚀 Launching App..."
npm run dev
