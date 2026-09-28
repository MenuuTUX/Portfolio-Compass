# Portfolio Compass design

Portfolio Compass helps people inspect holdings before they change them. The interface should answer a question, show the evidence, and leave room for doubt. It is an educational research tool. It does not place trades or assess whether an investment suits a person.

## Who it serves

- Someone starting out can search a fund, read its cost and currency, open the details, and build an empty or illustrative portfolio.
- Someone with holdings can check position sizes, exposure, overlap, source dates, and the effect of a contribution.
- Both can see unknown data and model assumptions. A missing quote never becomes a zero, and a modeled path never becomes a forecast.

The landing page offers two clear paths. "Build a portfolio" starts the optional educational example flow. "Explore funds" opens fund search. Returning visitors with saved holdings go to Portfolio. The app keeps Portfolio, Market, Funds, and Stocks in the main navigation.

## Visual system

The supplied Altitude reference informed the editorial type and stepped charcoal surfaces. The product uses its own data colors and keeps a light theme for people who prefer it. The source tokens are in [app/globals.css](app/globals.css).

| Role | Dark | Light |
| --- | --- | --- |
| Canvas | `#181818` | `#f7f6f3` |
| Card | `#1f1f1f` | `#ffffff` |
| Raised surface | `#262626` | `#eceae6` |
| Main text | `#eeeeee` | `#1c1c1b` |
| Muted text | `#aaa7a1` | `#625f59` |
| Action and focus | `#5b9cff` | `#155fc4` |
| Positive data | `#73c99a` | `#19744c` |
| Negative data | `#f39489` | `#b43b34` |

Blue marks an action, selection, or focus. Green and red describe financial direction, with a sign or label beside the color. Neutral borders separate content. Cards do not need a glow, blur, hover veil, or shadow to look interactive.

Libre Baskerville appears on the landing headline and major section headings. Inter handles controls and data. Numbers use tabular figures. Body text uses normal tracking and at least 14px in dense views; small labels should be at least 12px. Controls are at least 44px high on mobile. Cards use 8px corners and controls use 4px corners.

## Information rules

1. Say what a value measures and over what period. "Daily +0.54%" means more than a green "+0.54%".
2. Put quote currency and date beside prices. Show a source or retrieval date for fee and yield fields.
3. Withhold portfolio totals and projections when a held quote or required FX rate fails validation. Explain how to recover.
4. Keep fund expense ratio separate from distribution yield. A provider ratio is not automatically a Canadian MER.
5. Expose scenario return assumptions before showing outputs. Call the result illustrative.
6. Call built-in allocations examples. The short quiz does not assess suitability or create an investment recommendation.
7. Keep holdings and share counts in local browser storage. Tickers travel to the app server for market data. Backup and restore belong in Settings.

## Interaction rules

Search comes before filters. On narrow screens, filters open when requested, so results stay near the search field. Add, remove, and details actions remain visible without hover. Navigation labels stay visible on mobile. The main content area owns scrolling inside the app. Keyboard focus is visible on every interactive control. Reduced-motion settings suppress decorative transitions. Charts need text summaries or data tables for nonvisual access.

Use plain labels and errors. No "hot", "sale", "elite", "best", or personal-match language unless a defined measure supports it. Avoid all-caps eyebrow labels, fake live indicators, random particles, decorative gradients, and section-by-section reveal animations. A result can look unfinished when data is missing; state the missing input rather than filling the gap with decoration.

## Research used

- [SEC Investor.gov: asset allocation](https://www.investor.gov/introduction-investing/getting-started/asset-allocation) links allocation to time horizon, risk tolerance, diversification, and periodic rebalancing.
- [FINRA: evaluating performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance) supports clear review periods and context for performance.
- [FINRA: fees and commissions](https://www.finra.org/investors/investing/investing-basics/fees-commissions) explains how ongoing fees affect returns.
- [W3C: use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) requires meaning beyond color alone.
- The supplied [better-interface](https://www.ui-skills.com/skills/jakubkrehel/better-interface) and [frontend-design](https://www.ui-skills.com/skills/anthropics/frontend-design) references informed the evidence-based review and removal of generic decorative patterns.
- [OpenUI](https://github.com/thesysdev/openui) is a generative UI framework. This product does not need its runtime for the current redesign.
