# Plan: company financials from SEC filings

Status: step 1 (engine, no UI) built 2026-11-05 in `lib/fundamentals/`, tested on real filings for AAPL, MSFT, NVDA, JPM and TSM in `tests/fixtures/sec/` (rebuild them with `tests/fixtures/sec/trim.ts`). Learned while building:
- Tag fallback has to be per period, not per company: NVIDIA and Apple switched revenue tags mid-history.
- Stock splits make older diluted share counts look tiny (NVIDIA 10:1 in 2024), so dilution is measured on split-adjusted counts.
- Net debt subtracts short-term investments as well as cash. Some companies stop tagging those (NVIDIA after fiscal 2025), which overstates their net debt; the source tag on every number keeps that visible.
- Trailing twelve months use fiscal year + year to date - prior year to date, which covers cash flow statements that 10-Qs report only year to date. Separate quarters were not needed.
- Microsoft tags only "Depreciation", so its EBITDA is slightly understated.

Goal: when a user looks at a US-listed stock, show what an analyst would pull from its filings: five years of key figures, quality and balance-sheet measures, valuation against a few peers, and a short list of things worth a closer look, each linked to the filing it came from. It explains and checks; it does not rate, score or recommend.

## What exists today

- Asset detail lives in `components/workspace/AssetWorkspace.tsx`, a chart with a drawer that has three tabs: Portfolio, Verdict (`EtfVerdictCard.tsx`, fund screens with stated "screen bands") and Profile (`AssetProfileCard.tsx`, sector, industry and description from `/api/stock/info`).
- Server data routes sit under `app/api/` (`market/*`, `stock/info`, `etfs/*`). They validate tickers with zod (`/^[a-zA-Z0-9.-]+$/`, max 12), cache upstream calls in an in-process TTL map (`lib/fast-market.ts`), and set `Cache-Control` with `stale-while-revalidate`.
- `yahoo-finance2` is already a dependency and supplies quotes.
- The privacy promise: only ticker symbols leave the browser; holdings, weights and share counts do not.
- No SEC or fundamentals code exists.

## Scope

In:
- US domestic filers (10-K and 10-Q with XBRL, US GAAP taxonomy).
- A new "Financials" drawer tab for stocks.
- Peer valuation with a suggested, editable peer set.

Out (named so nobody builds them by accident):
- Canadian issuers. They file on SEDAR+, which has no public structured-data API. Most of this user's holdings are Canadian ETFs, so the tab states this plainly rather than hiding.
- Fund look-through from Form N-PORT. Valuable for US ETFs, but it is a different parser and UI; a separate plan.
- Full-text red flags such as going-concern language. XBRL rarely tags them; needs filing text parsing.
- Portfolio-level weighted fundamentals. Follows once per-company data is trustworthy.
- DCF or any price target. The app shows what the price implies, never a fair value.

## 1. Data source

All free, from the SEC, no key:

| Endpoint | Use | Size |
|---|---|---|
| `https://www.sec.gov/files/company_tickers.json` | Ticker to CIK map | about 1 MB |
| `https://data.sec.gov/submissions/CIK##########.json` | Company name, SIC code, fiscal year end, filing list with form types, dates, accession numbers, and 8-K item numbers | 50 KB to 1 MB |
| `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` | Every XBRL fact the company has filed, with period, form, filing date and accession | 1 to 15 MB |

SEC fair-access rules: a declared `User-Agent` naming the app and a contact address, and at most 10 requests a second. The contact is the maintainer's, set in an environment variable `SEC_USER_AGENT` (for example `Portfolio Compass admin@example.com`). It is never the user's details. The route refuses to call the SEC when the variable is missing and says so in its error.

**Decided:** the maintainer's own address, set in `.env.local` (gitignored, so it never lands in the public repo). Production needs the same variable in the host's environment settings.

Privacy: the browser sends only a ticker to our own route, which is the same as today. The server calls the SEC by CIK. Add "SEC EDGAR (company filings)" to the data sources listed on the privacy page.

## 1b. How filings reach users (no lock-in)

Checked 2026-11-05: `data.sec.gov` returns no `Access-Control-Allow-Origin` header, and browsers do not let a page set `User-Agent`. So a user's browser cannot read the SEC directly; something has to relay it. To keep that relay replaceable, the app reads filings through one small interface with two interchangeable sources, and never through a paid data vendor.

```ts
// lib/fundamentals/source.ts
export interface FilingsSource {
  id: "edgar-live" | "snapshot";
  /** Clean periods, filing list and metadata for one company, or null if not a filer. */
  getCompany(ticker: string): Promise<CompanyFilings | null>;
}
```

`CompanyFilings` is the parsed shape from `periods.ts` plus the filing list, not raw XBRL, so both sources produce exactly the same input to `metrics.ts` and `flags.ts`.

**Source A, live (`edgar-live`).** The server route calls the SEC per request, as in section 2. Freshest: a new 10-K shows up the same day. Needs any Node host and `SEC_USER_AGENT`.

**Source B, nightly snapshot (`snapshot`).** Static per-company JSON files built once a day from the SEC's bulk downloads:
- `https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip` (about 1.4 GB, refreshed nightly around 06:00 UTC)
- `https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip`
- `https://www.sec.gov/files/company_tickers_exchange.json` (ticker, CIK and exchange)

A script, `scripts/sec-snapshot.ts` (bun), downloads these with the declared User-Agent, keeps companies listed on NYSE, Nasdaq or CBOE, runs each through the same `concepts.ts` and `periods.ts` code, and writes:
- `sec/tickers.json`: ticker to CIK, name, exchange.
- `sec/c/{CIK}.json`: one `CompanyFilings` per company, target 10 to 30 KB.
- `sec/meta.json`: build time and the SEC files' `Last-Modified` dates.

It unzips with the system `unzip` (present on CI runners), so no new dependency. Expected total around 100 to 300 MB; the script prints the size, and if it is over 500 MB the first cut is dropping periods older than ten years.

Where the snapshot lives is a setting, `SEC_SNAPSHOT_URL`, not a vendor:
- Default: a GitHub Actions workflow (`.github/workflows/sec-snapshot.yml`, daily at 07:00 UTC) force-pushes the files to an orphan `sec-data` branch served by GitHub Pages. Force-pushing an orphan branch keeps repo history from growing. GitHub Pages sends `Access-Control-Allow-Origin: *`, so browsers can read it directly.
- Anywhere else that serves static files works the same: any S3-compatible bucket, Cloudflare Pages, Netlify, or the app's own `public/` folder for a small universe.

**Order of use.**
1. The browser asks our route, `/api/stock/fundamentals`. The route tries the live source, then the snapshot (server-side) if the SEC errors, rate-limits, or `SEC_USER_AGENT` is unset. Setting `SEC_SOURCE=snapshot` skips live entirely.
2. If our route itself is unreachable (static export, a host without server functions), the client reads `{SEC_SNAPSHOT_URL}/sec/c/{CIK}.json` directly, after looking up the CIK in `sec/tickers.json`, which it caches for a day.

Every response carries `source` and `asOf`. The UI shows "From SEC filings, data as of 2026-11-05" when it came from the snapshot, so a day-old figure is never presented as live.

Privacy is unchanged in kind: only a ticker or CIK leaves the browser. When the client reads the snapshot directly, the static host sees that request, so the privacy page names the snapshot host too.

Why not a paid API (Financial Modeling Prep, Polygon and similar): keys, pricing and terms on redistributing their data are exactly the lock-in this avoids, and SEC data is public domain.

## 2. Server

Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `08-caching.md` first (AGENTS.md: this Next version has breaking changes).

### Route: `app/api/stock/fundamentals/route.ts`

`GET /api/stock/fundamentals?ticker=AAPL` returns a compact summary (target under 25 KB), never the raw company facts.

- Validate the ticker with the same zod schema as `stock/info`.
- 400 for a bad ticker, 404 with `{ reason: "not-sec-filer" }` when the ticker has no CIK (covers `.TO` and other non-US listings), 502 with a plain message when the SEC is unreachable, 503 when `SEC_USER_AGENT` is unset.
- `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`. Filings change at most a few times a quarter.

### Library: `lib/fundamentals/`

- `sec-client.ts`: fetch with the declared User-Agent, an in-process token bucket (8 a second), de-duplication of in-flight requests by URL, and a TTL cache shaped like the one in `fast-market.ts` (ticker map 24 h, submissions 6 h, company facts 6 h). Parsed summaries are cached, not the multi-megabyte raw JSON.
- `concepts.ts`: each line item maps to an ordered list of XBRL tags, first match wins, because companies switch tags over time. For example revenue tries `RevenueFromContractWithCustomerExcludingAssessedTax`, then `Revenues`, then `SalesRevenueNet`. Line items:
  - Revenue, gross profit, operating income, net income, depreciation and amortization, interest expense, income tax, share-based compensation.
  - Operating cash flow, capital expenditure.
  - Cash, total debt (long-term plus current portion), stockholders' equity, total assets, accounts receivable.
  - Diluted weighted shares; shares outstanding from `dei:EntityCommonStockSharesOutstanding`, summed across share classes.
  - Each value keeps the tag it came from and the accession number, so the UI can say exactly where a number came from.
- `periods.ts`: turns raw facts into clean periods.
  - Annual: facts from 10-K with a duration of 350 to 380 days. When the same period was reported more than once (restatements, comparatives in later filings), keep the value from the latest filing and remember that it changed.
  - Quarterly: 10-Q facts are often year-to-date, so derive single quarters by subtraction, and Q4 as the full year minus the first nine months.
  - Trailing twelve months: sum of the last four quarters for flow items; latest point-in-time value for balance-sheet items.
  - Fiscal years are labeled by the year they end, with the end month shown, since many companies do not end in December.
- `metrics.ts`: pure functions on clean periods. Each returns a value, or `null` with a reason, rather than a misleading number.
  - Growth: revenue three-year compound annual growth.
  - Margins: gross and operating.
  - Cash: free cash flow (operating cash flow minus capex), and free cash flow divided by net income.
  - Returns: return on invested capital, as after-tax operating income over (debt + equity minus cash).
  - Balance sheet: net debt over EBITDA (operating income plus D&A), interest coverage.
  - Shareholders: share-based compensation as a share of revenue, diluted share count change a year (negative means buybacks).
  - Valuation, from the current quote: market cap (price × shares outstanding, with the share count's date), enterprise value, EV/EBITDA, price to free cash flow, price to earnings, all on trailing twelve months.
- `flags.ts`: rule-based "worth a closer look" items. Each has a plain sentence, the threshold it used, and a link to the filing. No overall score.
  - From the filing list (reliable, no text parsing): 8-K Item 4.02 (earlier statements should no longer be relied on), 8-K Item 4.01 (auditor change), late-filing notices (NT 10-K, NT 10-Q), all in the last three years.
  - From the numbers:
    - receivables growing more than 1.5 times as fast as revenue for two years running
    - diluted shares up more than 3% a year over three years
    - share-based compensation above 10% of revenue
    - negative free cash flow in three of the last five years while net income was positive
    - net debt above 4 times EBITDA, or interest coverage below 2
    - a reported value restated by more than 5% in a later filing
- `sector.ts`: banks, insurers and REITs (SIC 6000 to 6799) make EBITDA, free cash flow and net debt meaningless. For them, hide those metrics and show return on equity and equity over assets instead, with a line saying why.

Foreign private issuers (20-F, 40-F) use the IFRS taxonomy and ADR share ratios we cannot read reliably. Show their reported figures where tags map, and mark valuation as unavailable rather than guessing.

### Peers

The SEC has no peer list. Suggest peers from `yahoo-finance2`'s `recommendationsBySymbol`, keep those that are SEC filers, and cap the list at five. The user can remove a suggestion or add a ticker. The peer list is stored per ticker in `localStorage`; only tickers go to the server, as today. Peer summaries come from the same route, at most three requests in parallel. The UI shows the company's multiple next to the peer median and the range.

## 3. UI: the "Financials" tab

Added to the drawer tabs in `AssetWorkspace.tsx` when the asset is a stock. Plain language first, numbers second, sources always one click away.

1. **Header line:** "From SEC filings. Latest annual report: 10-K for fiscal 2025, filed 2026-02-14." The report name links to the filing.
2. **Five-year table:** revenue, operating income, net income, free cash flow, net debt and diluted shares, with a trailing-twelve-month column and a small sparkline per row (reuse `components/Sparkline.tsx`). A small mark appears on any value that was later restated.
3. **Quality and balance sheet:** a grid of six measures (growth, operating margin, cash conversion, return on capital, net debt to EBITDA, dilution). Each shows the value plus one plain line, for example "Turns 94% of reported profit into cash".
4. **Valuation against peers:** EV/EBITDA, price to free cash flow and price to earnings, each with the peer median and range. The peer list sits right there and is editable. One line frames it: "A higher multiple means the price assumes more growth or less risk than for these peers."
5. **Worth a closer look:** the flags, each with its threshold and filing link. When there are none: "None of the checks below were triggered", with the list of checks run.
6. **Progressive disclosure:** a details panel, "Where each number comes from", lists the XBRL tag, period and accession for every figure.

Empty and edge states:
- ETF or fund: "Funds do not file company financials. See the Verdict tab for fund costs and liquidity."
- Non-US listing: "This company does not file with the SEC. Canadian issuers file on SEDAR+, which has no data feed this app can read."
- Missing line items: show a dash with the reason, never zero.

Copy rules: no em dashes, no "buy", "sell", "undervalued" or scores. Footer line: "Figures from company filings. Not a recommendation."

## 4. Performance

- Company facts for large filers can be over 10 MB. Parse on the server, cache the summary, send under 25 KB.
- First view of an uncached company makes three SEC calls (ticker map, submissions, facts). The ticker map is shared and cached for 24 h, so in practice it is two. Five peers add up to ten more, rate-limited and run three at a time. The tab shows the company first and fills in peers as they arrive.
- Serverless instances lose the in-process cache between cold starts. The CDN `Cache-Control` covers repeat views. A shared store is not needed for v1.
- Snapshot reads are one static file of 10 to 30 KB per company, so peers cost nothing extra on the SEC side. The nightly build is the only heavy step (a 1.4 GB download) and runs on CI, not on the app host.

## 5. Tests

Fixtures in `tests/fixtures/sec/`, trimmed from real responses to only the tags used:
- a December year-end company
- a non-December fiscal year
- a company that switched revenue tags mid-history
- a restatement
- a bank
- a 20-F filer
- a submissions file with 8-K Items 4.01 and 4.02

Unit tests (`tests/unit/lib/fundamentals/*.test.ts`):
- `periods`: annual selection by duration, keeping the latest filing on duplicates, Q4 derivation, trailing twelve months, fiscal-year labels.
- `concepts`: tag fallback order and the source attached to each value; share classes summed.
- `metrics`: hand-computed values for each measure, and `null` with a reason for zero or negative denominators.
- `flags`: each rule triggers just above its threshold and not just below; filing-list flags respect the three-year window.
- `sector`: bank SIC hides EBITDA-based metrics.
- `sec-client`: sends the declared User-Agent and nothing about the user; respects the token bucket; de-duplicates concurrent calls (mock `fetch`).

Source tests (`tests/unit/lib/fundamentals/source.test.ts`):
- The route uses live first and falls back to the snapshot on a live error, a 429, or a missing `SEC_USER_AGENT`; `SEC_SOURCE=snapshot` never calls live.
- Both sources return the same `CompanyFilings` for the same fixture company (run the fixture through the snapshot builder, then compare).
- The client falls back to reading the snapshot directly when the route fails, and the result carries `source: "snapshot"` and `asOf`.

Snapshot builder tests (`tests/unit/scripts/sec-snapshot.test.ts`), on a tiny zip built from the fixtures inside the test:
- Writes `tickers.json`, one file per kept company, and `meta.json`.
- Drops companies not on NYSE, Nasdaq or CBOE, and tags not in `concepts.ts`.
- Each company file stays under 40 KB.
- Sends the declared User-Agent on downloads (mock `fetch`).

Route tests (`tests/unit/api/stock-fundamentals.test.ts`):
- 400 for a bad ticker, 404 `not-sec-filer` for `XEQT.TO`, 502 on upstream failure, 503 without `SEC_USER_AGENT`, and a response under 25 KB for the largest fixture.

Component tests:
- The tab appears for stocks and not ETFs.
- Each empty state renders its message.
- Flags link to the filing.
- Peers can be removed and added, and persist.
- No em dash in rendered copy.

## 6. Order of work

1. `lib/fundamentals` (client, concepts, periods, metrics, flags, sector, source interface) with fixtures and unit tests. No UI.
2. The route with live and snapshot sources, its tests, and the privacy page source lines.
3. The snapshot builder script and the nightly workflow. Run it once by hand and record the total size here.
4. The Financials tab without peers, including the direct snapshot fallback and the "data as of" line.
5. Peers.
6. Separate plans afterwards: N-PORT fund look-through, then portfolio-level fundamentals.
