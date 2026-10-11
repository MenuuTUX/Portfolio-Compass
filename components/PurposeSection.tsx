"use client";

import { useState } from "react";

const tools = [
  { title: "Model portfolios", description: "Review the model allocations included in the app and compare them with your own." },
  { title: "Heuristic allocation", description: "Allocate whole shares under a cash limit using explicit return and variance proxies." },
  { title: "Monte Carlo simulation", description: "Generate paths from historical estimates. The results are model scenarios, not forecasts." },
];

export default function PurposeSection() {
  const [shareStatus, setShareStatus] = useState("");

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "PortfolioCompass", text: "PortfolioCompass: ETF comparison and portfolio tools", url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus("Link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Could not share the link. Copy the address from your browser.");
    }
  };

  return (
    <section id="tools" className="py-16 sm:py-24 bg-canvas">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl md:text-5xl font-display font-normal text-ink mb-6">
            Portfolio tools in <span className="text-compass">one browser tab</span>
          </h2>
          <p className="text-base sm:text-lg text-body leading-relaxed">
            Search market data, compare holdings, test allocations, and run projections in the browser.
          </p>
        </div>

        <dl className="divide-y divide-hairline border-y border-hairline mb-16 sm:mb-24">
          {tools.map((tool) => (
            <div key={tool.title} className="grid md:grid-cols-3 gap-3 md:gap-8 py-7 sm:py-9">
              <dt className="text-xl md:text-2xl font-display text-ink">{tool.title}</dt>
              <dd className="md:col-span-2 text-sm sm:text-base text-body leading-relaxed">{tool.description}</dd>
            </div>
          ))}
        </dl>

        <div className="border-l-2 border-compass pl-6 md:pl-10 mb-16 sm:mb-24">
          <h3 className="text-2xl font-display font-normal text-ink mb-5">Why this exists</h3>
          <blockquote className="text-lg md:text-2xl text-body-strong leading-relaxed mb-5">
            I wanted the portfolio math I kept rebuilding in spreadsheets:
            allocation checks, side-by-side comparisons, and model projections.
            I put them in one browser app and connected them to current market data.
          </blockquote>
          <p className="text-muted text-sm">Jim Cramer</p>
        </div>

        <div className="border-t border-hairline pt-12 text-center">
          <h3 className="text-2xl sm:text-3xl font-display font-normal text-ink mb-4">Support the project</h3>
          <p className="text-body text-sm sm:text-base">The code is open source. A GitHub star helps other people find the project.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
            <a href="https://github.com/MenuuTUX/Portfolio-Compass" target="_blank" rel="noopener noreferrer" className="px-8 py-3.5 rounded-lg bg-ink text-canvas font-medium hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-compass">
              Star on GitHub
            </a>
            <button onClick={share} className="px-8 py-3.5 rounded-lg bg-surface-card text-ink font-medium border border-hairline-strong hover:bg-surface-soft transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-compass">Share</button>
          </div>
          <p role="status" className="mt-4 text-sm text-body">{shareStatus}</p>
        </div>
      </div>
    </section>
  );
}
