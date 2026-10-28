# Portfolio Compass design

Portfolio Compass helps people inspect holdings before they change them. The interface answers a question, shows the evidence, and leaves room for doubt. It is an educational research tool. It does not place trades or assess whether an investment suits a person.

## Who it serves

- Someone starting out can search a fund, read its cost and currency, open the details, and build an empty or illustrative portfolio.
- Someone with holdings can check position sizes, exposure, overlap, source dates, and the effect of a contribution.
- Both can see unknown data and model assumptions. A missing quote never becomes a zero, and a modeled path never becomes a forecast.

The landing page offers two clear paths. "Build a portfolio" starts the optional educational example flow. "Explore funds" opens fund search. Returning visitors with saved holdings go to Portfolio.

## Design language

Two registers share one token set. Product name and logo stay Portfolio Compass.

- **Landing** feels like a public consumer-finance site: cream in light mode, near-black in dark mode, giant bold headlines, a floating nav bar, painted arch art, phone mocks, an index list, and full-width bands.
- **App** (Browse market and Portfolio) feels like a pro trading workspace: page `#0d0d0d`, three panels, a status bar, no side rail. Panels are `#0f0f0f` with 8px radius and a white 5% ring.

### Font

OpenAI Sans is the only typeface (`--font-openai-sans`, loaded in `app/layout.tsx`). `font-sans`, `font-display`, `font-serif`, and `font-mono` all resolve to it. Do not add another font.

### Tokens

Tokens live in [app/globals.css](app/globals.css). Each is a CSS variable redefined for `.dark`, wired to Tailwind through `@theme`.

| Role | Utility | Dark | Light |
| --- | --- | --- | --- |
| Canvas | `bg-canvas`, `.ws-page` | `#0d0d0d` | `#f5f3ef` |
| Card | `bg-surface-card` | `#1c1c1c` | `#fcfcfc` |
| Raised surface | `bg-surface-soft` | `#262626` | `#ebe8e2` |
| Panel | `.ws-panel`, `--panel` | `#0f0f0f` | `#fcfcfc` |
| Panel ring | `--panel-ring` | white 5% | `rgba(28,27,27,0.08)` |
| Hairline | `border-hairline` | white 10% | ink 10% |
| Main text | `text-ink` | `#ffffff` | `#1c1b1b` |
| Body | `text-body` | `#b6b6b6` | `#4a4846` |
| Muted | `text-muted`, `text-muted-soft` | `#868686`, `#5f5f5f` | `#6b6865`, `#8a8783` |
| Gain | `text-emerald-400` | `#6dc382` | `#059669` |
| Loss | `text-rose-400`, `text-red-400` | `#f0777b` | `#c74437` |
| Link and focus | `text-compass` | `#6dc382` | `#11745b` |

Light `--muted` is 5:1 on the cream canvas. `--muted-soft` is for decorative text only. Legacy `stone-*` and `neutral-*` utilities map onto the same scale.

### Color rule

Surfaces are neutral. Saturated color appears only for gain, loss, and links. Actions are neutral pills; the single emphasized action is an ink pill. A gain or loss always has a sign or label beside the color, so meaning never depends on color alone.

### Type

- Marketing: `.ws-display` (48 to 96px, 700), `.ws-title` (32 to 48px, 500), `.ws-lead` (18px, body color), `.ws-eyebrow` (14px, 500).
- App: 14px body, 12px captions (nothing smaller), 16px section titles, 32px for big numbers.
- Headings use positive tracking (+0.005em), set globally on `h1`, `h2`, `h3`. Never tight negative tracking.

### Shape and depth

8px for panels and dense controls, 12px for icon buttons and the floating nav, 16px for landing cards, full pills for chips and buttons. Depth is a 1px ring. Real shadows are allowed only on floating layers: menus, modals, drawers, tooltips, the nav. Scrims are `bg-black/60` with no blur.

### Motion

Motion is everywhere but never blocks reading.

- One easing: `EASE = [0.16, 1, 0.3, 1]` (`components/motion/Reveal.tsx`); CSS equivalent `cubic-bezier(0.16, 1, 0.3, 1)`.
- Sections reveal on scroll (`Reveal`, `RevealGroup`, `RevealItem`), once.
- Charts draw in; numbers count up (`components/motion/CountUp.tsx`).
- Active pills and tabs slide between positions (shared `layoutId`).
- Overlays: scrim fades in 200ms, drawers slide from the edge in about 320ms, popups scale from .97 and fade in 240ms, list items stagger inside. Overlays animate out too (`AnimatePresence`).
- Loading uses the `.ws-skeleton` shimmer. Hover on cards may lift 2px (`.ws-hover-lift`).
- Hover and press on buttons change fill only, in 70ms.
- Reduced motion is respected twice: `MotionConfig reducedMotion="user"` for framer-motion, and a global `prefers-reduced-motion` block that disables every CSS animation above and shortens transitions to 0.01ms.

### Focus and touch

Every interactive element shows a 2px `compass` outline with a 2px offset on keyboard focus. Targets are at least 44px on touch. Dialogs trap focus and return it on close (`hooks/useDialogA11y`).

## Layout

Landing: floating nav bar (`.ws-nav`), hero with giant headline, painted arch art and phone mocks, an index list, then full-width bands. Footer closes the page.

App: a top bar, then three panels side by side on desktop (lists, detail, context), with a status bar at the bottom. There is no left rail. Panels scroll independently. On mobile the panels stack into tabs with visible labels.

## Utility classes

Defined in `app/globals.css`:

- `.ws-display`, `.ws-title`, `.ws-lead`, `.ws-eyebrow`: marketing type.
- `.ws-panel`, `.ws-page`: workspace panel and page background.
- `.ws-card`, `.ws-row`, `.ws-chip`, `.ws-pill` (`.ws-pill-primary`), `.ws-section-title`, `.ws-icon-btn`, `.ws-switch`, `.ws-nav`, `.ws-btn-solid`, `.ws-btn-outline`, `.ws-arrow-btn`: components (see the file for details).
- `.ws-floating`, `.ws-scrim`: modal surface with a real shadow, and the 60% black scrim.
- `.animate-ws-fade-up`, `.ws-stagger`, `.ws-skeleton`, `.animate-ws-ring`, `.ws-marquee`, `.animate-ws-float`, `.ws-hover-lift`: motion.
- `.glass-card`, `.glass-panel`: legacy names, now flat solid surfaces with a ring.
- `.app-panel-safe`, `.app-sheet-safe`, `.app-bottom-safe`: safe-area padding for fixed overlays.

## Information rules

1. Say what a value measures and over what period. "Daily +0.54%" means more than a green "+0.54%".
2. Put quote currency and date beside prices. Show a source or retrieval date for fee and yield fields.
3. Withhold portfolio totals and projections when a held quote or required FX rate fails validation. Explain how to recover.
4. Keep fund expense ratio separate from distribution yield. A provider ratio is not automatically a Canadian MER.
5. Expose scenario return assumptions before showing outputs. Call the result illustrative.
6. Call built-in allocations examples. The short quiz does not assess suitability or create an investment recommendation.
7. Keep holdings and share counts in local browser storage. Tickers travel to the app server for market data. Backup and restore belong in Settings.

## Interaction rules

Search comes before filters. On narrow screens, filters open when requested, so results stay near the search field. Add, remove, and details actions remain visible without hover. Navigation labels stay visible on mobile. Charts need text summaries or data tables for nonvisual access.

Use plain labels and errors. No "hot", "sale", "elite", "best", or personal-match language unless a defined measure supports it. Avoid all-caps eyebrow labels, fake live indicators, random particles, decorative gradients, and motion that hides content. A result can look unfinished when data is missing; state the missing input rather than filling the gap with decoration.

## Research used

- [SEC Investor.gov: asset allocation](https://www.investor.gov/introduction-investing/getting-started/asset-allocation) links allocation to time horizon, risk tolerance, diversification, and periodic rebalancing.
- [FINRA: evaluating performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance) supports clear review periods and context for performance.
- [FINRA: fees and commissions](https://www.finra.org/investors/investing/investing-basics/fees-commissions) explains how ongoing fees affect returns.
- [W3C: use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) requires meaning beyond color alone.
