# Getting Started 🚀

Follow this guide to set up **Portfolio Compass** on your local machine.

## Prerequisites

Ensure you have the following installed:

*   **Node.js** (v18+ recommended)
*   **Python** (v3.10+ recommended)
*   **PostgreSQL** (Running locally or via Docker)
*   **Redis** (For caching)
*   **Meilisearch** (For the search engine)

---

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Shib-Das/Portfolio-Compass.git
cd Portfolio-Compass
```

### 2. Environment Configuration
The project uses a `run.sh` script that automatically generates a default `.env` file if one is missing. However, you can manually configure it:

Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/portfolio_compass?schema=public"

# Search & Cache
MEILI_HOST="http://localhost:7700"
MEILI_KEY="your_master_key"
REDIS_HOST="localhost"
```

### 3. Install Dependencies

**Frontend (Node.js)**
```bash
npm install
```

**Backend (Python)**
The project uses `uv` for fast Python package management.
```bash
# Install uv if needed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install deps
uv venv venv
source venv/bin/activate
uv pip install -r requirements.txt
```

---

## 🏃‍♂️ Running the Application

### The Easy Way (Automated Script)

Use the provided `run.sh` (Linux/Mac) or `run.bat` (Windows) script. It handles dependency checks, database syncing, seeding, and starting the app.

**Linux/macOS:**
```bash
./run.sh
```

**Windows:**
```bat
.\run.bat
```

### Manual Startup

If you prefer to run services manually:

1.  **Sync Database**: `npx prisma db push`
2.  **Seed Data**: `npx tsx scripts/seed_market.ts`
3.  **Start Dev Server**: `npm run dev`

The application will be available at `http://localhost:3000`.

---

## 🗄️ Database & Search Sync

To populate the search index from the database:
```bash
python scripts/sync_db_to_search.py
```

To fetch fresh market data manually:
```bash
python scripts/fetch_market_snapshot.py
```
