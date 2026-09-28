export default function LocalFirstDiagram() {
  return (
    <section
      className="mb-24 rounded-card border border-stone-800 bg-stone-900/30 p-6 md:p-8"
      aria-labelledby="local-first-title"
    >
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-data-up">
            Local-first by design
          </p>
          <h3
            id="local-first-title"
            className="mt-2 font-display text-2xl font-bold text-stone-100 md:text-3xl"
          >
            Your portfolio stays with you
          </h3>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-stone-400">
          Market data comes in. Your working portfolio, recent tickers, and
          theme stay in this browser.
        </p>
      </div>

      <div className="hidden overflow-hidden md:block">
        <svg
          className="h-auto w-full text-stone-600"
          viewBox="0 0 780 220"
          role="img"
          aria-labelledby="local-first-svg-title local-first-svg-description"
        >
          <title id="local-first-svg-title">Portfolio Compass local-first workflow</title>
          <desc id="local-first-svg-description">
            Current market data flows into the browser. Portfolio tools read
            the local working set, while portfolio data remains in the browser.
          </desc>

          <defs>
            <marker
              id="local-first-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>

          <g className="text-stone-600" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="218" y1="78" x2="285" y2="78" markerEnd="url(#local-first-arrow)" />
            <line x1="495" y1="78" x2="562" y2="78" markerEnd="url(#local-first-arrow)" />
            <line x1="390" y1="124" x2="390" y2="164" strokeDasharray="3 5" />
          </g>

          <g className="text-stone-500">
            <rect x="20" y="38" width="198" height="82" rx="2" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeOpacity="0.35" />
            <text x="40" y="68" fill="currentColor" fontSize="12" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" letterSpacing="1.2">
              MARKET DATA
            </text>
            <text x="40" y="94" fill="currentColor" fontSize="15" fontFamily="ui-sans-serif, system-ui, sans-serif">
              Current quotes &amp; ETF facts
            </text>
          </g>

          <g className="text-data-up">
            <rect x="285" y="24" width="210" height="100" rx="2" fill="currentColor" fillOpacity="0.09" stroke="currentColor" strokeOpacity="0.8" />
            <text x="307" y="58" fill="currentColor" fontSize="12" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" letterSpacing="1.2">
              YOUR BROWSER
            </text>
            <text x="307" y="86" fill="currentColor" fontSize="18" fontFamily="ui-sans-serif, system-ui, sans-serif">
              Local working set
            </text>
            <text x="307" y="108" fill="currentColor" fillOpacity="0.75" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
              portfolio · recents · theme
            </text>
          </g>

          <g className="text-stone-500">
            <rect x="562" y="38" width="198" height="82" rx="2" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeOpacity="0.35" />
            <text x="582" y="68" fill="currentColor" fontSize="12" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" letterSpacing="1.2">
              TOOLS
            </text>
            <text x="582" y="94" fill="currentColor" fontSize="15" fontFamily="ui-sans-serif, system-ui, sans-serif">
              Compare · build · project
            </text>
          </g>

          <g className="text-stone-500">
            <line x1="290" y1="180" x2="490" y2="180" stroke="currentColor" strokeOpacity="0.25" />
            <text x="390" y="204" textAnchor="middle" fill="currentColor" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" letterSpacing="0.8">
              no account · no cookies · no cross-site tracking
            </text>
          </g>
        </svg>
      </div>

      <ol className="flex flex-col gap-3 md:hidden" aria-label="Local-first workflow">
        <li className="border-l border-stone-700 pl-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">
            01 · Market data
          </p>
          <p className="mt-1 text-sm text-stone-200">Current quotes and ETF facts enter the app.</p>
        </li>
        <li className="border-l border-data-up pl-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-data-up">
            02 · Your browser
          </p>
          <p className="mt-1 text-sm text-stone-200">Your portfolio, recents, and theme stay local.</p>
        </li>
        <li className="border-l border-stone-700 pl-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">
            03 · Portfolio tools
          </p>
          <p className="mt-1 text-sm text-stone-200">Compare, build, and project from that working set.</p>
        </li>
      </ol>
    </section>
  );
}
