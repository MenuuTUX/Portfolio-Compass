# Known Limitations

## 1. Data Source Restrictions

*   **Rate Limiting:** The application relies on `yahoo-finance2`, which interfaces with public Yahoo Finance endpoints. Excessive requests may result in temporary IP bans (HTTP 429). The `market-service` implements exponential backoff, but sustained high-volume usage (e.g., syncing >500 tickers simultaneously) is not supported without a commercial data provider.
*   **Asset Coverage:** Support for international exchanges (outside US/Canada) is limited. Some metrics (e.g., Expense Ratio) may be missing for non-US assets.

## 2. Optimization Scale

*   **Client-Side Constraints:** The Greedy Optimization algorithm runs in the browser's main thread.
    *   **Max Assets:** Performance degrades noticeably for portfolios with >50 unique assets.
    *   **Max Budget:** Extremely large budgets relative to share price (e.g., allocating $10M to a $10 stock) increase the iteration count, potentially causing UI freezing.

## 3. Monte Carlo Simulation

*   **Assumption of Normality:** The simulation uses a Gaussian copula (Cholesky Decomposition), which assumes asset returns are normally distributed. This model may underestimate "fat tail" risks (extreme market events).
*   **Historical Bias:** Covariance matrices are derived from historical data (past 6 months to 2 years). Past correlations may not predict future relationships.

## 4. Mobile Responsiveness

*   **Visualization:** Detailed charts (e.g., Risk/Return Scatter, Correlation Heatmap) are optimized for desktop viewports (>1024px). On mobile devices, these components are hidden or simplified.
