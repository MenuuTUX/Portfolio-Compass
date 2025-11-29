#!/bin/bash
# PortfolioCompass - One Command Setup & Run

echo "🧭 PortfolioCompass Initialization Sequence..."

# 1. Config
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating default configuration..."
    echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/portfolio_compass?schema=public"' > .env
    echo "✅ .env created."
fi

# 2. Python Environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate || echo "⚠️  Could not activate venv"

# 3. Dependencies
echo "🐍 Installing Python dependencies..."
pip install -r requirements.txt > /dev/null 2>&1
echo "📦 Installing Node.js dependencies..."
npm install --silent > /dev/null 2>&1

# 4. Database
echo "🗄️  Syncing Database Schema..."
npx prisma db push

# 5. Seed
echo "🌱 Seeding initial market data..."
python3 scripts/fetch_prices.py

# 6. Start
echo "🚀 Launching App..."
npm run dev
