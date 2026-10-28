import Link from "next/link";
import type { Metadata } from "next";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="main"
      className="min-h-[100dvh] flex flex-col items-start justify-center gap-6 mx-auto max-w-[65ch] px-6"
    >
      <RevealGroup onMount stagger={0.1} className="flex flex-col items-start gap-6">
      <RevealItem><p className="text-sm text-muted tabular-nums">404</p></RevealItem>

      <RevealItem>
      <h1 className="font-display text-4xl sm:text-5xl font-bold text-ink" style={{ letterSpacing: "0.005em", lineHeight: 1.16 }}>
        That page is off the map.
      </h1>
      </RevealItem>

      <RevealItem>
      <p className="text-lg text-body leading-relaxed">
        The link may be outdated, or the ticker page you wanted never existed.
        Your portfolio is untouched. It lives in this browser, not on this
        server.
      </p>
      </RevealItem>

      <RevealItem className="flex flex-wrap items-center gap-3 pt-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full bg-ink px-6 text-sm font-medium text-canvas transition-colors duration-[70ms] hover:bg-body-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-compass"
        >
          Back to PortfolioCompass
        </Link>
        <a
          href="https://github.com/MenuuTUX/Portfolio-Compass/issues"
          className="inline-flex min-h-11 items-center rounded-full bg-surface-soft px-6 text-sm font-medium text-ink transition-colors duration-[70ms] hover:bg-surface-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-compass"
        >
          Report a broken link
        </a>
      </RevealItem>
      </RevealGroup>
    </main>
  );
}
