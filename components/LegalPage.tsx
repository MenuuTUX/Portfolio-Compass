import Link from "next/link";
import React from "react";
import Reveal from "@/components/motion/Reveal";

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
    <main id="main" className="mx-auto max-w-[65ch] px-6 py-16 sm:py-24">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-muted transition-colors duration-[70ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass rounded"
      >
        ← Portfolio Compass
      </Link>

      <Reveal onMount y={20}>
        <h1 className="mt-6 font-display text-4xl font-bold text-ink" style={{ letterSpacing: "0.005em", lineHeight: 1.16 }}>{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {lastUpdated}</p>
      </Reveal>

      <Reveal onMount delay={0.1} y={16} className="mt-4">
      <div className="rounded-2xl bg-surface-card p-4 ring-1 ring-hairline text-sm text-body">
        Portfolio Compass is an open-source hobby project, not a registered
        broker, adviser, or financial institution. This page describes how the
        software behaves. It has not been reviewed by a lawyer and is not legal
        advice.
      </div>
      </Reveal>

      <Reveal onMount delay={0.2} y={16} className="legal-prose mt-10 space-y-8 text-body">{children}</Reveal>
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
      <h2 className="font-display text-xl font-medium text-ink">{heading}</h2>
      {children}
    </section>
  );
}
