# Architecture 🏗️

Portfolio Compass employs a **Hybrid Architecture** combining the interactivity of a modern React frontend with the data processing power of Python.

## System Overview

```mermaid
graph TD
    User[User Browser]

    subgraph Frontend [Next.js App Router]
        UI[React Components]
        Query[TanStack Query]
        API_Route[API Routes /api/*]
    end

    subgraph Backend [Backend Services]
        FastAPI[Modernized Backend (FastAPI)]
        PythonScripts[Data Scripts]
    end

    subgraph Data [Data Layer]
        DB[(PostgreSQL)]
        Redis[(Redis Cache)]
        Meili[(Meilisearch)]
    end

    User --> UI
    UI --> Query
    Query --> API_Route

    API_Route --> DB
    API_Route --> Meili
    API_Route -- "Sync Request" --> FastAPI

    FastAPI --> DB
    FastAPI --> Redis
    FastAPI -- "Fetch Prices" --> External[Yahoo Finance / AlphaVantage]

    PythonScripts --> DB
    PythonScripts --> Meili
```

---

## 🖥️ Frontend (Next.js)

*   **Framework**: Next.js 16 (App Router) with React 19.
*   **State Management**: `TanStack Query v5` for server state, handling caching, synchronization, and optimistic updates.
*   **Styling**: `Tailwind CSS v4` with a custom configuration for the Biopunk theme.
*   **Performance**:
    *   **React Compiler**: Automatic memoization.
    *   **Virtualization**: `react-window` for efficient rendering of large portfolio lists.
    *   **Suspense**: Progressive loading of UI components.

## ⚙️ Backend (Python & Node.js)

The backend is split into two parts:

1.  **Next.js API Routes (`app/api/`)**: Handles direct user interactions (CRUD for portfolios, Search proxy).
2.  **Modernized Backend (`modernized_backend/`)**: A Python-based service layer (likely FastAPI) responsible for:
    *   Heavy data processing.
    *   Fetching and normalizing market data (yfinance).
    *   Risk metric calculations (Standard Deviation, Z-Score).

## 💽 Data Layer

*   **PostgreSQL**: The primary source of truth for Users, Portfolios, and Asset Metadata. managed via **Prisma ORM**.
*   **Redis**: High-speed caching for asset prices and computed metrics. Uses `pickle` serialization for complex Python objects.
*   **Meilisearch**: Provides typo-tolerant, instant search capabilities. Data is synced from Postgres via `scripts/sync_db_to_search.py`.

## 🔄 Data Pipeline

1.  **Ingestion**: `scripts/fetch_market_snapshot.py` and `fetch_details.py` pull data from external providers (Yahoo Finance).
2.  **Storage**: Data is normalized and stored in Postgres (`Etf`, `EtfHistory` tables).
3.  **Indexing**: Relevant metadata is pushed to Meilisearch for the frontend search bar.
4.  **Serving**: The frontend requests data; if stale, a background task triggers a refresh while serving cached data (Stale-While-Revalidate pattern).
