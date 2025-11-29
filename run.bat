@echo off
setlocal

echo 🧭 PortfolioCompass Initialization Sequence...

REM 1. Config
if not exist .env (
    echo ⚠️  No .env file found. Creating default configuration...
    echo DATABASE_URL="postgresql://postgres:postgres@localhost:5432/portfolio_compass?schema=public" > .env
    echo ✅ .env created.
)

REM 2. Python Environment

REM Check for uv
where uv >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⬇️  Installing uv...
    powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
    REM uv usually installs to %USERPROFILE%\.cargo\bin
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)

if not exist venv (
    echo 🔨 Creating Python virtual environment with uv...
    uv venv venv
)
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ⚠️  Could not activate venv
    exit /b 1
)

REM 3. Dependencies
echo 🐍 Installing Python dependencies with uv...
uv pip install -r requirements.txt > nul 2>&1
if errorlevel 1 echo ⚠️  Python dependencies installation warning (check logs if needed)

echo 📦 Installing Node.js dependencies...
call npm install --silent > nul 2>&1

REM 4. Database
echo 🗄️  Syncing Database Schema...
call npx prisma db push

REM 5. Seed
echo 🌱 Seeding initial market data...
python scripts/fetch_prices.py

REM 6. Start
echo 🚀 Launching App...
call npm run dev

endlocal
