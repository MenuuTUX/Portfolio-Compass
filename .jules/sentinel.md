## 2024-05-23 - Search API DoS Prevention
**Vulnerability:** The `/api/etfs/search` endpoint accepted an unlimited number of tickers via the `tickers` query parameter, allowing for potential Denial of Service (DoS) and external API exhaustion by sending thousands of tickers in a single request.
**Learning:** Query parameters that trigger external API calls or database writes must always be strictly capped in quantity and validated for format.
**Prevention:** Implemented a hard cap of 50 tickers per request and strict regex validation (`/^[A-Z0-9.-]{1,12}$/`) to filter out malicious or malformed inputs.
