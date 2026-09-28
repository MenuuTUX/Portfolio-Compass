import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="main"
      className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <p className="font-mono text-sm tracking-[0.3em] text-muted">404</p>

      <h1 className="font-serif text-4xl sm:text-5xl text-ink max-w-xl">
        That page is off the map.
      </h1>

      <p className="text-body max-w-md">
        The link may be outdated, or the ticker page you wanted never existed.
        Your portfolio is untouched — it lives in this browser, not on this
        server.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/"
          className="rounded-full bg-ink px-6 py-3 font-medium text-canvas transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-signal-mint focus:ring-offset-2 focus:ring-offset-canvas"
        >
          Back to Portfolio Compass
        </Link>
        <a
          href="https://github.com/MenuuTUX/Portfolio-Compass/issues"
          className="rounded-full border border-hairline-strong px-6 py-3 font-medium text-ink transition-colors hover:bg-surface-soft focus:outline-none focus:ring-2 focus:ring-signal-mint focus:ring-offset-2 focus:ring-offset-canvas"
        >
          Report a broken link
        </a>
      </div>
    </main>
  );
}
