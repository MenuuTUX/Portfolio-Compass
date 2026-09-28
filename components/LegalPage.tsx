import Link from "next/link";
import React from "react";

/**
 * Shared chrome for /privacy and /terms.
 *
 * `lastUpdated` is rendered as written rather than derived from the build date,
 * so the date always reflects a real review of the text.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <Link
        href="/"
        className="text-sm text-muted underline underline-offset-4 hover:text-ink focus:outline-none focus:ring-2 focus:ring-signal-mint rounded"
      >
        ← Portfolio Compass
      </Link>

      <h1 className="mt-8 font-serif text-4xl text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {lastUpdated}</p>

      <div className="mt-4 rounded-card border border-hairline-strong bg-surface-soft p-4 text-sm text-body">
        Portfolio Compass is an open-source hobby project, not a registered
        broker, adviser, or financial institution. This page describes how the
        software behaves. It has not been reviewed by a lawyer and is not legal
        advice.
      </div>

      <div className="legal-prose mt-10 space-y-8 text-body">{children}</div>
    </main>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl text-ink">{heading}</h2>
      {children}
    </section>
  );
}
