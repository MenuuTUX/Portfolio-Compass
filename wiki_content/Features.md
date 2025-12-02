# Features ✨

## 📊 ETF & Stock Comparison

The core of Portfolio Compass is the ability to analyze and compare assets deeply.

*   **Unified Data Model**: Stocks and ETFs share the same interface, allowing seamless comparison.
*   **Risk Analysis**:
    *   **Volatility**: Calculated standard deviation of daily returns.
    *   **Risk Level**: Categorized into 5 levels (Very Safe to Very High Risk).
    *   **Consensus Price**: Uses Z-Score (1.5 threshold) to filter outliers from data sources.
*   **Advanced Charts**: Interactive visualizations using `Recharts` for price history, tailored to specific time intervals (1D, 1W, 1M, 1Y).

## 💼 Smart Portfolio

Manage your investments with a frictionless UI.

*   **Optimistic Updates**: When you add or remove an asset, the UI updates immediately. If the server request fails, the change is rolled back, ensuring a responsive feel.
*   **Real-Time Valuation**: Portfolio value is calculated on-the-fly using the latest cached prices.
*   **Yield Tracking**: Automatic calculation of Trailing Twelve-Month (TTM) yield based on dividend history.

## 🔍 Intelligent Search

Finding assets is faster than ever.

*   **Hybrid Search**: Results are served from **Meilisearch** for speed. If a ticker isn't found, the system can fallback to live fetching.
*   **Visual Feedback**:
    *   **Hover-to-Reveal**: Hovering over a search result blurs the background and shows action buttons.
    *   **Drawer Integration**: Clicking "Advanced View" opens a detailed slide-up drawer without navigating away.
*   **Smart Filtering**: Filter by Asset Type (Stock/ETF) directly in the search interface.

## ⚡ Performance Optimizations

*   **Virtualization**: Uses `react-window` FixedSizeList to render portfolios with hundreds of items without lag.
*   **Memoization**: React 16 Compiler handles component memoization automatically.
*   **Background Sync**: Stale data triggers asynchronous updates (`asyncio.create_task`) in the backend, keeping reads fast.
